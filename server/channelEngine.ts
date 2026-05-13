/**
 * channelEngine.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * YouTube channel discovery and video tracking engine.
 * Uses youtubei.js (InnerTube) — no API key required.
 *
 * Responsibilities:
 *  1. Resolve a channel URL / handle / ID → canonical channel metadata
 *  2. Fetch the last N uploads from a channel
 *  3. Detect new videos uploaded since a channel was last checked
 *  4. Pull per-video stats (views, likes, duration, title, thumbnail)
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

async function getYT(): Promise<Innertube> {
  if (!_yt) {
    _yt = await Innertube.create({ cache: undefined, generate_session_locally: true });
  }
  return _yt;
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

/** Parse a subscriber count string like "1.2M" → number. */
function parseSubscriberCount(raw: string | undefined | null): number {
  if (!raw) return 0;
  const s = raw.replace(/,/g, "").trim();
  if (s.endsWith("M")) return Math.round(parseFloat(s) * 1_000_000);
  if (s.endsWith("K")) return Math.round(parseFloat(s) * 1_000);
  return parseInt(s, 10) || 0;
}

/** Format a Date to YYYY-MM-DD. */
function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Try to extract a publish date from a video item's metadata. */
function extractPublishDate(item: any): string {
  try {
    // published_timetext is usually "X days ago" — not ideal, but we try
    const ts = item?.published?.seconds
      ?? item?.start_timestamp
      ?? item?.metadata?.published_time_text;
    if (typeof ts === "number" && ts > 0) {
      return toDateStr(new Date(ts * 1000));
    }
    // snippet_text like "2 days ago" → approximate
    const txt: string = item?.published_timetext ?? item?.metadata?.published_time_text ?? "";
    if (txt.includes("year")) {
      const y = parseInt(txt) || 1;
      const d = new Date();
      d.setFullYear(d.getFullYear() - y);
      return toDateStr(d);
    }
    if (txt.includes("month")) {
      const m = parseInt(txt) || 1;
      const d = new Date();
      d.setMonth(d.getMonth() - m);
      return toDateStr(d);
    }
    if (txt.includes("week")) {
      const w = parseInt(txt) || 1;
      const d = new Date();
      d.setDate(d.getDate() - w * 7);
      return toDateStr(d);
    }
    if (txt.includes("day")) {
      const dy = parseInt(txt) || 1;
      const d = new Date();
      d.setDate(d.getDate() - dy);
      return toDateStr(d);
    }
  } catch {
    // ignore
  }
  return toDateStr(new Date());
}

/** Parse duration in seconds from a duration string like "12:34" or "1:23:45". */
function parseDuration(raw: string | undefined | null): number {
  if (!raw) return 0;
  const parts = raw.split(":").map(Number);
  if (parts.length === 3) return (parts[0]! * 3600) + (parts[1]! * 60) + (parts[2]! || 0);
  if (parts.length === 2) return (parts[0]! * 60) + (parts[1]! || 0);
  return 0;
}

/** Safe number parse from any value (string with commas, number, etc.). */
function safeNum(v: any): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v.replace(/,/g, ""), 10) || 0;
  return 0;
}

/** Extract best thumbnail URL from a thumbnail object. */
function bestThumb(thumbnails: any): string | null {
  if (!thumbnails) return null;
  if (Array.isArray(thumbnails)) {
    const sorted = [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    return sorted[0]?.url ?? null;
  }
  return thumbnails?.url ?? null;
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
    // Search for the channel by handle/name
    const searchResults = await yt.search(query.replace(/^@/, ""), { type: "channel" });
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

  const subRaw =
    header?.subscribers_count_text?.toString() ??
    header?.subscriber_count_text?.toString() ??
    (header as any)?.subscriberCountText?.toString() ??
    "";
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
 * Returns an array of DiscoveredVideo sorted newest-first.
 */
export async function fetchChannelUploads(channelId: string, limit = 10): Promise<DiscoveredVideo[]> {
  const yt = await getYT();
  const channel = await yt.getChannel(channelId);

  // Get the Videos tab
  let videosTab: any;
  try {
    videosTab = await (channel as any).getVideos();
  } catch {
    videosTab = null;
  }

  const items: any[] = videosTab?.videos ?? videosTab?.items ?? [];
  const results: DiscoveredVideo[] = [];

  for (const item of items.slice(0, limit)) {
    try {
      const rawId: string =
        item?.id ??
        item?.video_id ??
        item?.endpoint?.payload?.videoId ??
        "";
      if (!rawId || rawId.length !== 11) continue;

      const title: string = item?.title?.toString() ?? item?.title?.text ?? "Untitled";
      const videoUrl = `https://www.youtube.com/watch?v=${rawId}`;
      const publishedDate = extractPublishDate(item);
      const thumbnailUrl = bestThumb(item?.thumbnail ?? item?.thumbnails);
      const durationRaw: string = item?.duration?.toString() ?? item?.duration?.text ?? "";
      const durationSeconds = parseDuration(durationRaw);

      // View count from the item (may be approximate)
      const vcRaw = item?.view_count?.toString() ?? item?.short_view_count?.toString() ?? "0";
      const viewCount = safeNum(vcRaw);

      results.push({
        videoId: rawId,
        ytVideoId: toDbVideoId(rawId),
        title,
        videoUrl,
        publishedDate,
        thumbnailUrl,
        durationSeconds,
        viewCount,
        likeCount: 0, // not available from channel listing; fetched separately
      });
    } catch {
      // skip malformed items
    }
  }

  return results;
}

/**
 * Fetch detailed stats for a single YouTube video by its raw video ID.
 * Returns views, likes, duration, title, thumbnail, and publish date.
 */
export async function fetchVideoStats(rawVideoId: string): Promise<VideoStats | null> {
  try {
    const yt = await getYT();
    const info = await yt.getBasicInfo(rawVideoId);
    const basic = (info as any)?.basic_info ?? {};

    const viewCount = safeNum(basic?.view_count ?? 0);
    const likeCount = safeNum(basic?.like_count ?? 0);
    const durationSeconds = safeNum(basic?.duration ?? 0);
    const title: string = basic?.title ?? "Untitled";
    const thumbnailUrl = bestThumb(basic?.thumbnail);

    // Publish date: try start_timestamp first (unix seconds)
    let publishedDate = toDateStr(new Date());
    const ts = basic?.start_timestamp;
    if (typeof ts === "number" && ts > 0) {
      publishedDate = toDateStr(new Date(ts * 1000));
    }

    return { videoId: rawVideoId, viewCount, likeCount, durationSeconds, title, thumbnailUrl, publishedDate };
  } catch (err) {
    console.error(`[channelEngine] Failed to fetch stats for ${rawVideoId}:`, err);
    return null;
  }
}

/**
 * Given a list of raw video IDs, fetch stats for all of them in parallel
 * (with a concurrency cap to avoid rate limiting).
 */
export async function fetchBulkVideoStats(rawVideoIds: string[], concurrency = 3): Promise<Map<string, VideoStats>> {
  const results = new Map<string, VideoStats>();
  const queue = [...rawVideoIds];

  while (queue.length > 0) {
    const batch = queue.splice(0, concurrency);
    const settled = await Promise.allSettled(batch.map((id) => fetchVideoStats(id)));
    for (const result of settled) {
      if (result.status === "fulfilled" && result.value) {
        results.set(result.value.videoId, result.value);
      }
    }
    // Small delay between batches to be polite
    if (queue.length > 0) await new Promise((r) => setTimeout(r, 300));
  }

  return results;
}
