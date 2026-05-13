/**
 * commentEngine.ts
 * No-code YouTube comment scraper using youtubei.js (no API key required).
 * Extracts: video likes, total comment count, top comment (by likes), reply count.
 */

import { Innertube } from "youtubei.js";

export interface ScrapedComment {
  commentId: string;
  author: string;
  text: string;
  likeCount: string; // e.g. "239K", "1.8K", "125"
  likeCountNum: number; // parsed numeric value for sorting
  replyCount: number;
  isTopComment: boolean;
}

export interface ScrapedVideoStats {
  videoId: string; // raw YouTube ID (without yt_ prefix)
  likeCount: number | null; // video likes
  commentCount: string | null; // e.g. "2,437,584"
  commentCountNum: number | null; // parsed numeric
  topComment: ScrapedComment | null;
  scrapedAt: number; // UTC ms timestamp
  error?: string;
}

/** Parse YouTube abbreviated numbers: "239K" -> 239000, "1.8M" -> 1800000, "125" -> 125 */
function parseYtNumber(raw: string | undefined | null): number {
  if (!raw) return 0;
  const s = raw.replace(/,/g, "").trim();
  if (s.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith("K")) return Math.round(parseFloat(s) * 1_000);
  return parseInt(s, 10) || 0;
}

let _yt: Innertube | null = null;
async function getYt(): Promise<Innertube> {
  if (!_yt) {
    _yt = await Innertube.create({ generate_session_locally: true });
  }
  return _yt;
}

/**
 * Scrape a single YouTube video for likes, comment count, and top comment.
 * @param rawVideoId  bare 11-char YouTube video ID (no "yt_" prefix)
 */
export async function scrapeVideoComments(rawVideoId: string): Promise<ScrapedVideoStats> {
  const result: ScrapedVideoStats = {
    videoId: rawVideoId,
    likeCount: null,
    commentCount: null,
    commentCountNum: null,
    topComment: null,
    scrapedAt: Date.now(),
  };

  try {
    const yt = await getYt();

    // 1. Get video likes from getInfo
    try {
      const info = await yt.getInfo(rawVideoId);
      const likes = info.basic_info?.like_count;
      if (typeof likes === "number") {
        result.likeCount = likes;
      }
    } catch (_e) {
      // non-fatal — continue to comments
    }

    // 2. Get comments
    const commentsPage = await yt.getComments(rawVideoId);

    // Extract total comment count from header
    const header = commentsPage.header as any;
    const countText: string | undefined =
      header?.count?.text ?? header?.comments_count?.text;
    if (countText) {
      result.commentCount = countText;
      result.commentCountNum = parseYtNumber(countText);
    }

    // 3. Find top comment by like count from first page (20 comments)
    let topComment: ScrapedComment | null = null;
    let topLikes = -1;

    for (const item of commentsPage.contents ?? []) {
      const c = (item as any).comment;
      if (!c) continue;

      const likeStr: string = c.like_count ?? "0";
      const likeNum = parseYtNumber(likeStr);
      const text: string =
        c.content?.runs?.map((r: any) => r.text).join("") ?? "";
      const author: string = c.author?.name ?? "Unknown";
      const replyCount: number = typeof c.reply_count === "number" ? c.reply_count : 0;
      const commentId: string = c.comment_id ?? "";

      if (likeNum > topLikes) {
        topLikes = likeNum;
        topComment = {
          commentId,
          author,
          text,
          likeCount: likeStr,
          likeCountNum: likeNum,
          replyCount,
          isTopComment: true,
        };
      }
    }

    result.topComment = topComment;
  } catch (e: any) {
    result.error = e?.message?.slice(0, 300) ?? "Unknown error";
    // Reset singleton on error so next call gets a fresh session
    _yt = null;
  }

  return result;
}

/**
 * Scrape stats for a batch of video IDs.
 * Adds a 1-second delay between requests to avoid rate limiting.
 */
export async function scrapeVideoBatch(
  rawVideoIds: string[]
): Promise<ScrapedVideoStats[]> {
  const results: ScrapedVideoStats[] = [];
  for (const id of rawVideoIds) {
    const stat = await scrapeVideoComments(id);
    results.push(stat);
    // Small delay to be polite to YouTube
    await new Promise((r) => setTimeout(r, 1200));
  }
  return results;
}
