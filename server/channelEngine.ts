/**
 * channelEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * YouTube channel discovery and video tracking engine.
 * Uses youtubei.js (InnerTube) — no API key required.
 *
 * Responsibilities:
 *  1. Resolve a channel URL / handle / ID → canonical channel metadata
 *  2. Fetch the last N uploads from a channel WITH full stats
 *  3. Detect new videos uploaded since a channel was last checked
 *  4. Pull per-video stats (views, likes, duration, title, thumbnail)
 *
 * NOTE: yt.getBasicInfo() is blocked by YouTube bot-detection (LOGIN_REQUIRED).
 * All stats are sourced from the channel's Videos tab listing, which is freely
 * accessible without authentication. The channel listing provides:
 *   - title, view_count, duration.seconds, published.text, thumbnails
 */

import { Innertube } from "youtubei.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ChannelInfo {
  channelId: string;
  channelName: string;
  channelHandle: string | null;
  thumbnailUrl: string | null;
  subscriberCount: number;
  videoCount: number;
  description: string | null;
}

export interface DiscoveredVideo {
  videoId: string;       // raw YouTube video ID (e.g. "dQw4w9WgXcQ")
  ytVideoId: string;     // prefixed form used in our DB (e.g. "yt_dQw4w9WgXcQ")
  title: string;
  videoUrl: string;
  publishedDate: string; // YYYY-MM-DD
  thumbnailUrl: string | null;
  durationSeconds: number;
  viewCount: number;
  likeCount: number;
}

export interface VideoStats {
  videoId: string;       // raw YouTube video ID
  viewCount: number;
  likeCount: number;
  durationSeconds: number;
  title: string;
  thumbnailUrl: string | null;
  publishedDate: string; // YYYY-MM-DD
}

// ─── Innertube singleton ──────────────────────────────────────────────────────

let _yt: Innertube | null = null;
let _ytCreatedAt = 0;
const YT_SESSION_TTL_MS = 30 * 60 * 1000; // reset session every 30 min to avoid stale tokens

async function getYT(): Promise<Innertube> {
  const now = Date.now();
  if (!_yt || now - _ytCreatedAt > YT_SESSION_TTL_MS) {
    _yt = null;
    _yt = await Innertube.create({ cache: undefined, generate_session_locally: true });
    _ytCreatedAt = now;
  }
  return _yt;
}

/** Reset the Innertube singleton — call after a Service Unavailable / parse error. */
export function resetYTSession(): void {
  _yt = null;
  _ytCreatedAt = 0;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Extract a bare YouTube video ID from any URL format or bare ID. */
export function extractVideoId(input: string): string | null {
  if (!input) return null;
  // youtu.be short link
  const short = input.match(/youtu\.be\/([A-Za-z0-9_-]{11})/);
  if (short) return short[1]!;
  // watch?v=
  const watch = input.match(/[?&]v=([A-Za-z0-9_-]{11})/);
  if (watch) return watch[1]!;
  // /shorts/
  const shorts = input.match(/\/shorts\/([A-Za-z0-9_-]{11})/);
  if (shorts) return shorts[1]!;
  // /embed/
  const embed = input.match(/\/embed\/([A-Za-z0-9_-]{11})/);
  if (embed) return embed[1]!;
  // bare 11-char ID
  if (/^[A-Za-z0-9_-]{11}$/.test(input)) return input;
  return null;
}

/** Convert a raw YouTube video ID to our internal prefixed form. */
export function toDbVideoId(rawId: string): string {
  return `yt_${rawId}`;
}

/** Strip the yt_ prefix to get the raw YouTube video ID. */
export function toRawVideoId(dbId: string): string {
  return dbId.startsWith("yt_") ? dbId.slice(3) : dbId;
}

/** Parse a subscriber count string like "1.2M" → number. */
function parseSubscriberCount(raw: string | undefined | null): number {
  if (!raw) return 0;
  // Strip commas and trim, then extract the numeric+suffix token
  // e.g. "232K subscribers" → "232K", "1.2M subscribers" → "1.2M", "299,000" → "299000"
  const s = raw.replace(/,/g, "").trim();
  const match = s.match(/([\d.]+)\s*([KkMmBb])?/);
  if (!match) return 0;
  const num = parseFloat(match[1]);
  const suffix = (match[2] ?? "").toUpperCase();
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "K") return Math.round(num * 1_000);
  return Math.round(num) || 0;
}

/** Format a Date to YYYY-MM-DD. */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Parse a "X time ago" relative text into an approximate YYYY-MM-DD date.
 * The channel listing provides published.text like "1 hour ago", "2 days ago", etc.
 */
function parseRelativeDate(text: string): string {
  try {
    const t = text.toLowerCase();
    if (t.includes("year")) {
      const y = parseInt(t) || 1;
      const d = new Date();
      d.setFullYear(d.getFullYear() - y);
      return toDateStr(d);
    }
    if (t.includes("month")) {
      const m = parseInt(t) || 1;
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      return toDateStr(d);
    }
    if (t.includes("week")) {
      const w = parseInt(t) || 1;
      const d = new Date();
      d.setDate(d.getDate() - w * 7);
      return toDateStr(d);
    }
    if (t.includes("day")) {
      const dy = parseInt(t) || 1;
      const d = new Date();
      d.setDate(d.getDate() - dy);
      return toDateStr(d);
    }
    if (t.includes("hour") || t.includes("minute") || t.includes("second")) {
      return toDateStr(new Date()); // today
    }
  } catch {
    // ignore
  }
  return toDateStr(new Date());
}

/** Safe number parse from any value (string with commas, number, etc.). */
function safeNum(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v.replace(/[^0-9]/g, ""), 10) || 0;
  return 0;
}

/** Extract best thumbnail URL from a thumbnail object or array. */
function bestThumb(thumbnails: any): string | null {
  if (!thumbnails) return null;
  if (Array.isArray(thumbnails)) {
    const sorted = [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    return sorted[0]?.url ?? null;
  }
  return thumbnails?.url ?? null;
}

/**
 * Extract all available stats from a single channel-listing video item.
 * The channel Videos tab returns rich metadata without requiring authentication.
 */
function extractItemStats(item: any): {
  rawId: string;
  title: string;
  viewCount: number;
  durationSeconds: number;
  publishedDate: string;
  thumbnailUrl: string | null;
} {
  // Raw video ID — channel listing uses video_id (not id)
  const rawId: string =
    item?.video_id ??
    item?.id ??
    item?.endpoint?.payload?.videoId ??
    "";

  // Title
  const title: string =
    item?.title?.toString() ??
    item?.title?.text ??
    "Untitled";

  // View count — "2,064 views" or "2K views"
  const viewRaw: string =
    item?.view_count?.toString() ??
    item?.short_view_count?.toString() ??
    "0";
  const viewCount = safeNum(viewRaw);

  // Duration — item.duration is { text: "9:17", seconds: 557 }
  const durationSeconds: number =
    typeof item?.duration?.seconds === "number"
      ? item.duration.seconds
      : safeNum(item?.duration?.text ?? "0");

  // Published date — item.published is { text: "1 hour ago" }
  const publishedText: string = item?.published?.text ?? "";
  const publishedDate = publishedText ? parseRelativeDate(publishedText) : toDateStr(new Date());

  // Thumbnail
  const thumbnailUrl = bestThumb(item?.thumbnails ?? item?.thumbnail);

  return { rawId, title, viewCount, durationSeconds, publishedDate, thumbnailUrl };
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Resolve a channel URL, handle (@username), or channel ID to canonical
 * channel metadata. Accepts:
 *   - https://www.youtube.com/channel/UCxxxxxx
 *   - https://www.youtube.com/@handle
 *   - @handle
 *   - UCxxxxxx (bare channel ID)
 */
export async function resolveChannel(input: string): Promise<ChannelInfo> {
  const yt = await getYT();

  // Normalise input to a search-friendly form
  let query = input.trim();

  // Extract channel ID from URL
  const channelIdMatch = query.match(/\/channel\/(UC[A-Za-z0-9_-]+)/);
  if (channelIdMatch) query = channelIdMatch[1]!;

  // Extract handle from URL
  const handleMatch = query.match(/\/@([A-Za-z0-9_.-]+)/);
  if (handleMatch) query = `@${handleMatch[1]}`;

  // If it looks like a bare UC... ID, use it directly
  const isBareId = /^UC[A-Za-z0-9_-]{20,}$/.test(query);

  let channel: any;
  if (isBareId) {
    channel = await yt.getChannel(query);
  } else {
    // Search for the channel by handle/name.
    // Keep the @ prefix when present — searching "@handle" returns exact handle
    // matches (type: Channel with first.id populated), whereas stripping @ can
    // return wrong or no results for handle-based queries.
    const searchResults = await yt.search(query, { type: "channel" });
    const first = (searchResults as any)?.results?.[0] ?? (searchResults as any)?.channels?.[0];
    if (!first) throw new Error(`No channel found for: ${input}`);
    const cid = first?.id ?? first?.channel_id ?? first?.endpoint?.payload?.browseId;
    if (!cid) throw new Error(`Could not resolve channel ID for: ${input}`);
    channel = await yt.getChannel(cid);
  }

  if (!channel) throw new Error(`Failed to load channel: ${input}`);

  const meta = (channel as any)?.metadata ?? {};
  const header = (channel as any)?.header ?? {};

  const channelId: string =
    (channel as any)?.id ??
    meta?.external_id ??
    header?.channel_id ??
    "";

  if (!channelId) throw new Error(`Could not determine channel ID for: ${input}`);

  const channelName: string =
    meta?.title ??
    header?.title?.toString() ??
    header?.author ??
    "Unknown Channel";

  const channelHandle: string | null =
    meta?.vanity_url?.replace("http://www.youtube.com/", "") ??
    header?.channel_handle_text?.toString() ??
    null;

  const thumbs = meta?.thumbnail ?? header?.avatar ?? header?.thumbnail;
  const thumbnailUrl = bestThumb(thumbs);

  // PageHeader structure: content.metadata.metadata_rows[N].metadata_parts[0].text.text
  // e.g. "232K subscribers"
  const subRaw: string = (() => {
    // New PageHeader format
    const rows = (header as any)?.content?.metadata?.metadata_rows ?? [];
    for (const row of rows) {
      for (const part of row?.metadata_parts ?? []) {
        const text: string = part?.text?.text ?? part?.text?.runs?.[0]?.text ?? "";
        if (text.toLowerCase().includes("subscriber")) return text;
      }
    }
    // Legacy C4TabbedHeader format
    return (
      header?.subscribers_count_text?.toString() ??
      header?.subscriber_count_text?.toString() ??
      (header as any)?.subscriberCountText?.toString() ??
      ""
    );
  })();
  const subscriberCount = parseSubscriberCount(subRaw);

  const vcRaw =
    header?.videos_count_text?.toString() ??
    (header as any)?.videoCountText?.toString() ??
    "";
  const videoCount = parseInt(vcRaw.replace(/[^0-9]/g, ""), 10) || 0;

  const description: string | null = meta?.description ?? null;

  return { channelId, channelName, channelHandle, thumbnailUrl, subscriberCount, videoCount, description };
}

/**
 * Fetch the last `limit` uploads from a channel (default 10).
 * Returns an array of DiscoveredVideo with full stats from the channel listing.
 * Stats are sourced directly from the Videos tab — no per-video API calls needed.
 */
export async function fetchChannelUploads(channelId: string, limit = 10): Promise<DiscoveredVideo[]> {
  let yt: Innertube;
  try {
    yt = await getYT();
  } catch (initErr) {
    resetYTSession();
    throw new Error(`YouTube session initialisation failed. Please try again in a moment. (${initErr instanceof Error ? initErr.message : String(initErr)})`);
  }

  let channel: any;
  try {
    channel = await yt.getChannel(channelId);
  } catch (fetchErr) {
    const msg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
    // YouTube returned a non-JSON response (e.g. 503 Service Unavailable) — reset session
    if (msg.includes("not valid JSON") || msg.includes("Service Unavailable") || msg.includes("503") || msg.includes("SyntaxError")) {
      resetYTSession();
      throw new Error(`YouTube is temporarily unavailable (rate limited or service error). Please wait 1–2 minutes and try again.`);
    }
    throw new Error(`Failed to fetch channel data: ${msg}`);
  }

  // Get the Videos tab — paginate through continuations to collect up to `limit` videos.
  // youtubei.js returns ~30 items per page; we must call getContinuation() for more.
  let videosTab: any;
  try {
    videosTab = await (channel as any).getVideos();
  } catch {
    videosTab = null;
  }

  const allItems: any[] = [];
  let currentPage: any = videosTab;

  while (currentPage && allItems.length < limit) {
    const pageItems: any[] = currentPage?.videos ?? currentPage?.items ?? [];
    allItems.push(...pageItems);

    // Stop if we have enough or no more pages
    if (allItems.length >= limit || !currentPage.has_continuation) break;

    try {
      currentPage = await currentPage.getContinuation();
    } catch {
      break; // no more pages or continuation failed
    }
  }

  const results: DiscoveredVideo[] = [];

  for (const item of allItems.slice(0, limit)) {
    try {
      const { rawId, title, viewCount, durationSeconds, publishedDate, thumbnailUrl } = extractItemStats(item);
      if (!rawId || rawId.length !== 11) continue;

      const videoUrl = `https://www.youtube.com/watch?v=${rawId}`;

      results.push({
        videoId: rawId,
        ytVideoId: toDbVideoId(rawId),
        title,
        videoUrl,
        publishedDate,
        thumbnailUrl,
        durationSeconds,
        viewCount,
        likeCount: 0, // not exposed in channel listing
      });
    } catch {
      // skip malformed items
    }
  }

  return results;
}

/**
 * Fetch current stats for all videos in a channel by re-fetching the channel
 * Videos tab listing. Returns a map of rawVideoId → VideoStats.
 *
 * This replaces the old getBasicInfo() approach which is blocked by YouTube
 * bot-detection (returns LOGIN_REQUIRED for unauthenticated requests).
 */
export async function fetchChannelVideoStats(channelId: string, limit = 30): Promise<Map<string, VideoStats>> {
  const yt = await getYT();
  const results = new Map<string, VideoStats>();

  try {
    const channel = await yt.getChannel(channelId);
    let videosTab: any;
    try {
      videosTab = await (channel as any).getVideos();
    } catch {
      return results;
    }

    const items: any[] = videosTab?.videos ?? videosTab?.items ?? [];

    for (const item of items.slice(0, limit)) {
      try {
        const { rawId, title, viewCount, durationSeconds, publishedDate, thumbnailUrl } = extractItemStats(item);
        if (!rawId || rawId.length !== 11) continue;

        results.set(rawId, {
          videoId: rawId,
          viewCount,
          likeCount: 0, // not exposed in channel listing
          durationSeconds,
          title,
          thumbnailUrl,
          publishedDate,
        });
      } catch {
        // skip malformed items
      }
    }
  } catch (err) {
    console.error(`[channelEngine] Failed to fetch channel stats for ${channelId}:`, err);
  }

  return results;
}

/**
 * @deprecated YouTube's getBasicInfo() is blocked by bot-detection (LOGIN_REQUIRED).
 * Use fetchChannelVideoStats() instead to get stats from the channel listing.
 *
 * Kept for backward compatibility — always returns null.
 */
export async function fetchVideoStats(_rawVideoId: string): Promise<VideoStats | null> {
  console.warn("[channelEngine] fetchVideoStats() is deprecated — use fetchChannelVideoStats() instead");
  return null;
}

/**
 * @deprecated Use fetchChannelVideoStats() instead.
 * Kept for backward compatibility — returns an empty map.
 */
export async function fetchBulkVideoStats(_rawVideoIds: string[], _concurrency = 3): Promise<Map<string, VideoStats>> {
  console.warn("[channelEngine] fetchBulkVideoStats() is deprecated — use fetchChannelVideoStats() instead");
  return new Map();
}

// ─── YouTube Data API v3 (requires YOUTUBE_API_KEY) ──────────────────────────

export interface YouTubeVideoStats {
  videoId: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  durationSeconds: number;
  title: string;
  thumbnailUrl: string | null;
  publishedAt: string; // YYYY-MM-DD
}

export interface YouTubeChannelStats {
  subscriberCount: number;
  videoCount: number;
  viewCount: number;
}

/**
 * Fetch per-video stats (views, likes, comments, duration) using YouTube Data API v3.
 * Requires YOUTUBE_API_KEY environment variable.
 * Returns null for each video if the API key is missing or the request fails.
 */
export async function fetchVideoStatsV3(
  rawVideoIds: string[],
  apiKey: string
): Promise<Map<string, YouTubeVideoStats>> {
  const results = new Map<string, YouTubeVideoStats>();
  if (!apiKey || rawVideoIds.length === 0) return results;

  // YouTube Data API allows up to 50 IDs per request
  const BATCH = 50;
  for (let i = 0; i < rawVideoIds.length; i += BATCH) {
    const batch = rawVideoIds.slice(i, i + BATCH);
    const ids = batch.join(",");
    const url = `https://www.googleapis.com/youtube/v3/videos?part=statistics,contentDetails,snippet&id=${ids}&key=${apiKey}`;
    try {
      const res = await fetch(url);
      if (!res.ok) {
        console.error(`[channelEngine] YouTube Data API v3 error: ${res.status} ${await res.text()}`);
        continue;
      }
      const data = await res.json() as any;
      for (const item of data?.items ?? []) {
        const vid = item.id as string;
        const stats = item.statistics ?? {};
        const details = item.contentDetails ?? {};
        const snippet = item.snippet ?? {};

        // Parse ISO 8601 duration (PT9M17S → 557 seconds)
        const durStr: string = details.duration ?? "";
        const durMatch = durStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
        const durationSeconds = durMatch
          ? (parseInt(durMatch[1] ?? "0") * 3600) +
            (parseInt(durMatch[2] ?? "0") * 60) +
            parseInt(durMatch[3] ?? "0")
          : 0;

        const thumbnails = snippet.thumbnails ?? {};
        const thumbnailUrl: string | null =
          thumbnails.maxres?.url ?? thumbnails.high?.url ?? thumbnails.medium?.url ?? null;

        const publishedAt = (snippet.publishedAt as string ?? "").slice(0, 10);

        results.set(vid, {
          videoId: vid,
          viewCount: parseInt(stats.viewCount ?? "0", 10) || 0,
          likeCount: parseInt(stats.likeCount ?? "0", 10) || 0,
          commentCount: parseInt(stats.commentCount ?? "0", 10) || 0,
          durationSeconds,
          title: snippet.title ?? "Untitled",
          thumbnailUrl,
          publishedAt,
        });
      }
    } catch (err) {
      console.error(`[channelEngine] fetchVideoStatsV3 batch failed:`, err);
    }
  }
  return results;
}

/**
 * Fetch channel-level stats (subscriber count, video count, total views) using
 * YouTube Data API v3. Requires YOUTUBE_API_KEY environment variable.
 */
export async function fetchChannelStatsV3(
  channelId: string,
  apiKey: string
): Promise<YouTubeChannelStats | null> {
  if (!apiKey) return null;
  try {
    const url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${channelId}&key=${apiKey}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error(`[channelEngine] YouTube Data API v3 channel stats error: ${res.status}`);
      return null;
    }
    const data = await res.json() as any;
    const stats = data?.items?.[0]?.statistics ?? {};
    return {
      subscriberCount: parseInt(stats.subscriberCount ?? "0", 10) || 0,
      videoCount: parseInt(stats.videoCount ?? "0", 10) || 0,
      viewCount: parseInt(stats.viewCount ?? "0", 10) || 0,
    };
  } catch (err) {
    console.error(`[channelEngine] fetchChannelStatsV3 failed:`, err);
    return null;
  }
}
