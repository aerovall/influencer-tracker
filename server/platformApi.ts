/**
 * Platform API Integration Service
 * YouTube: Uses youtubei.js (InnerTube) — NO API KEY REQUIRED
 * Instagram: Uses Instagram Graph API (access token required)
 * TikTok: Uses TikTok Research API (access token required)
 */

import { Innertube } from "youtubei.js";
import { getCredentialByKey } from "./db";

export interface VideoData {
  videoId: string;
  title: string;
  videoUrl: string;
  publishedDate: string;
  thumbnailUrl?: string;
  durationSeconds?: number;
}

export interface VideoMetrics {
  videoId: string;
  viewCount: number;
  likes: number;
  comments: number;
  shares: number;
  engagementRate: number;
}

// ─── YouTube via InnerTube (NO API KEY REQUIRED) ──────────────────────────────

let _ytInstance: Innertube | null = null;

async function getYouTube(): Promise<Innertube> {
  if (!_ytInstance) {
    _ytInstance = await Innertube.create({
      generate_session_locally: true,
    });
  }
  return _ytInstance;
}

/**
 * Extract a raw YouTube video ID from a variety of URL formats or bare IDs.
 * Supports: https://youtu.be/ID, https://www.youtube.com/watch?v=ID,
 *           https://www.youtube.com/shorts/ID, and bare 11-char IDs.
 */
export function extractYouTubeVideoId(input: string): string | null {
  // Already a bare 11-char ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(input.trim())) return input.trim();

  try {
    const url = new URL(input.trim());
    if (url.hostname === "youtu.be") return url.pathname.slice(1).split("?")[0] ?? null;
    if (url.hostname.includes("youtube.com")) {
      const v = url.searchParams.get("v");
      if (v) return v;
      // Shorts: /shorts/ID
      const shortsMatch = url.pathname.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
      if (shortsMatch) return shortsMatch[1] ?? null;
    }
  } catch {
    // Not a valid URL — try regex
    const match = input.match(/[?&]v=([a-zA-Z0-9_-]{11})/);
    if (match) return match[1] ?? null;
  }
  return null;
}

/**
 * Fetch a single YouTube video's metadata and metrics using InnerTube.
 * No API key required — uses YouTube's internal client API.
 */
export async function fetchYouTubeVideoInfo(videoUrl: string): Promise<{
  data: VideoData;
  metrics: VideoMetrics;
} | null> {
  const rawId = extractYouTubeVideoId(videoUrl);
  if (!rawId) return null;

  try {
    const yt = await getYouTube();
    const info = await yt.getInfo(rawId);
    const basic = info.basic_info;

    const views = basic.view_count ?? 0;
    const likes = basic.like_count ?? 0;
    // InnerTube does not expose comment count in basic_info; use 0 as default
    // (comment count requires a separate engagement panel request)
    const comments = 0;
    const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

    // Thumbnail: pick highest resolution available
    const thumbs = basic.thumbnail ?? [];
    const thumbnail =
      thumbs.sort((a: { width?: number }, b: { width?: number }) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ??
      `https://img.youtube.com/vi/${rawId}/hqdefault.jpg`;

    // Publish date: InnerTube returns it as a human string like "May 14, 2025"
    // We parse it or fall back to today
    let publishedDate = new Date().toISOString().split("T")[0]!;
    if (basic.start_timestamp) {
      publishedDate = new Date(basic.start_timestamp).toISOString().split("T")[0]!;
    }

    const data: VideoData = {
      videoId: `yt_${rawId}`,
      title: basic.title ?? "Untitled",
      videoUrl: `https://www.youtube.com/watch?v=${rawId}`,
      publishedDate,
      thumbnailUrl: thumbnail,
      durationSeconds: basic.duration ?? undefined,
    };

    const metrics: VideoMetrics = {
      videoId: `yt_${rawId}`,
      viewCount: views,
      likes,
      comments,
      shares: 0, // YouTube does not expose share counts publicly
      engagementRate: parseFloat(engagementRate.toFixed(4)),
    };

    return { data, metrics };
  } catch (err) {
    console.error(`[YouTube] Failed to fetch info for ${rawId}:`, err instanceof Error ? err.message : err);
    return null;
  }
}

/**
 * Fetch metrics for a list of YouTube video IDs (already stored in DB).
 * Used by the daily view count snapshot job.
 */
export async function fetchYouTubeVideoMetrics(platformVideoIds: string[]): Promise<VideoMetrics[]> {
  const results: VideoMetrics[] = [];

  for (const platformId of platformVideoIds) {
    const rawId = platformId.replace(/^yt_/, "");
    const result = await fetchYouTubeVideoInfo(`https://www.youtube.com/watch?v=${rawId}`);
    if (result) results.push(result.metrics);
  }

  return results;
}

/**
 * Fetch videos from a YouTube channel using InnerTube.
 * Returns up to 30 most recent videos without any API key.
 */
export async function fetchYouTubeChannelVideos(channelIdOrHandle: string): Promise<VideoData[]> {
  try {
    const yt = await getYouTube();
    const channel = await yt.getChannel(channelIdOrHandle);
    const videosTab = await channel.getVideos();
    const videos: VideoData[] = [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of ((videosTab.videos ?? []) as any[]).slice(0, 30)) {
      const rawId: string | undefined = item.id;
      if (!rawId) continue;
      const thumbs: Array<{ url?: string }> = item.thumbnails ?? [];
      videos.push({
        videoId: `yt_${rawId}`,
        title: String(item.title ?? "Untitled"),
        videoUrl: `https://www.youtube.com/watch?v=${rawId}`,
        publishedDate: new Date().toISOString().split("T")[0]!,
        thumbnailUrl: thumbs[0]?.url,
        durationSeconds: item.duration?.seconds ?? undefined,
      });
    }

    return videos;
  } catch (err) {
    console.error(`[YouTube] Failed to fetch channel videos for ${channelIdOrHandle}:`, err instanceof Error ? err.message : err);
    return [];
  }
}

// ─── Instagram Graph API ──────────────────────────────────────────────────────

async function getInstagramToken(): Promise<string | null> {
  const cred = await getCredentialByKey("instagram_access_token");
  return cred?.credentialValue ?? null;
}

export async function fetchInstagramUserMedia(igUserId: string): Promise<VideoData[]> {
  const token = await getInstagramToken();
  if (!token) throw new Error("Instagram access token not configured");

  const params = new URLSearchParams({
    fields: "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp",
    access_token: token,
    limit: "100",
  });

  const res = await fetch(`https://graph.instagram.com/${igUserId}/media?${params}`);
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Instagram media API error: ${err}`);
  }
  const data = await res.json();

  return (data.data ?? [])
    .filter((item: Record<string, string>) => item.media_type === "VIDEO" || item.media_type === "REEL")
    .map((item: Record<string, string>) => ({
      videoId: `ig_${item.id}`,
      title: (item.caption ?? "Instagram Reel").slice(0, 200),
      videoUrl: item.permalink,
      publishedDate: (item.timestamp ?? "").split("T")[0],
      thumbnailUrl: item.thumbnail_url ?? item.media_url,
    }));
}

export async function fetchInstagramVideoMetrics(igUserId: string, mediaIds: string[]): Promise<VideoMetrics[]> {
  const token = await getInstagramToken();
  if (!token) throw new Error("Instagram access token not configured");

  const metrics: VideoMetrics[] = [];

  for (const mediaId of mediaIds) {
    const rawId = mediaId.replace(/^ig_/, "");
    const params = new URLSearchParams({
      metric: "impressions,reach,video_views,likes,comments,shares",
      access_token: token,
    });

    try {
      const res = await fetch(`https://graph.instagram.com/${rawId}/insights?${params}`);
      if (!res.ok) continue;
      const data = await res.json();

      const metricMap: Record<string, number> = {};
      for (const m of data.data ?? []) {
        metricMap[m.name] = m.values?.[0]?.value ?? 0;
      }

      const views = metricMap.video_views ?? metricMap.impressions ?? 0;
      const likes = metricMap.likes ?? 0;
      const comments = metricMap.comments ?? 0;
      const shares = metricMap.shares ?? 0;
      const engagementRate = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;

      metrics.push({
        videoId: mediaId,
        viewCount: views,
        likes,
        comments,
        shares,
        engagementRate: parseFloat(engagementRate.toFixed(4)),
      });
    } catch {
      // Skip individual failures
    }
  }

  return metrics;
}

// ─── TikTok Research API ──────────────────────────────────────────────────────

async function getTikTokToken(): Promise<string | null> {
  const cred = await getCredentialByKey("tiktok_access_token");
  return cred?.credentialValue ?? null;
}

export async function fetchTikTokUserVideos(username: string): Promise<VideoData[]> {
  const token = await getTikTokToken();
  if (!token) throw new Error("TikTok access token not configured");

  const body = {
    query: {
      and: [{ field: "username", operation: "EQ", field_values: [username] }],
    },
    fields: ["id", "video_description", "create_time", "share_url", "cover_image_url", "duration"],
    max_count: 100,
  };

  const res = await fetch("https://open.tiktokapis.com/v2/research/video/query/", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`TikTok Research API error: ${err}`);
  }

  const data = await res.json();
  return (data.data?.videos ?? []).map((item: Record<string, string | number>) => ({
    videoId: `tt_${item.id}`,
    title: (String(item.video_description ?? "TikTok Video")).slice(0, 200),
    videoUrl: String(item.share_url ?? `https://www.tiktok.com/@${username}`),
    publishedDate: new Date(Number(item.create_time) * 1000).toISOString().split("T")[0],
    thumbnailUrl: String(item.cover_image_url ?? ""),
    durationSeconds: Number(item.duration ?? 0),
  }));
}

export async function fetchTikTokVideoMetrics(videoIds: string[]): Promise<VideoMetrics[]> {
  const token = await getTikTokToken();
  if (!token) throw new Error("TikTok access token not configured");

  const rawIds = videoIds.map((id) => id.replace(/^tt_/, ""));
  const metrics: VideoMetrics[] = [];

  const body = {
    filters: { video_ids: rawIds },
    fields: ["id", "view_count", "like_count", "comment_count", "share_count"],
    max_count: 100,
  };

  try {
    const res = await fetch("https://open.tiktokapis.com/v2/research/video/query/", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) return metrics;
    const data = await res.json();

    for (const item of data.data?.videos ?? []) {
      const views = item.view_count ?? 0;
      const likes = item.like_count ?? 0;
      const comments = item.comment_count ?? 0;
      const shares = item.share_count ?? 0;
      const engagementRate = views > 0 ? ((likes + comments + shares) / views) * 100 : 0;

      metrics.push({
        videoId: `tt_${item.id}`,
        viewCount: views,
        likes,
        comments,
        shares,
        engagementRate: parseFloat(engagementRate.toFixed(4)),
      });
    }
  } catch {
    // Return empty on failure
  }

  return metrics;
}
