/**
 * Platform API Integration Service
 * Handles YouTube Data API v3, Instagram Graph API, and TikTok Research API
 * All credentials are fetched from the database at runtime.
 */

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

// ─── YouTube Data API v3 ──────────────────────────────────────────────────────

async function getYouTubeApiKey(): Promise<string | null> {
  const cred = await getCredentialByKey("youtube_api_key");
  return cred?.credentialValue ?? null;
}

export async function fetchYouTubeChannelVideos(channelId: string): Promise<VideoData[]> {
  const apiKey = await getYouTubeApiKey();
  if (!apiKey) throw new Error("YouTube API key not configured");

  const videos: VideoData[] = [];
  let pageToken: string | undefined;

  do {
    const params = new URLSearchParams({
      part: "snippet",
      channelId,
      maxResults: "50",
      order: "date",
      type: "video",
      key: apiKey,
      ...(pageToken ? { pageToken } : {}),
    });

    const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`YouTube search API error: ${err}`);
    }
    const data = await res.json();

    for (const item of data.items ?? []) {
      const vidId = item.id?.videoId;
      if (!vidId) continue;
      videos.push({
        videoId: `yt_${vidId}`,
        title: item.snippet?.title ?? "Untitled",
        videoUrl: `https://www.youtube.com/watch?v=${vidId}`,
        publishedDate: (item.snippet?.publishedAt ?? "").split("T")[0],
        thumbnailUrl: item.snippet?.thumbnails?.high?.url ?? item.snippet?.thumbnails?.default?.url,
      });
    }

    pageToken = data.nextPageToken;
  } while (pageToken && videos.length < 200);

  return videos;
}

export async function fetchYouTubeVideoMetrics(platformVideoIds: string[]): Promise<VideoMetrics[]> {
  const apiKey = await getYouTubeApiKey();
  if (!apiKey) throw new Error("YouTube API key not configured");

  // Strip our internal prefix to get raw YouTube IDs
  const rawIds = platformVideoIds.map((id) => id.replace(/^yt_/, ""));
  const chunks: string[][] = [];
  for (let i = 0; i < rawIds.length; i += 50) chunks.push(rawIds.slice(i, i + 50));

  const metrics: VideoMetrics[] = [];

  for (const chunk of chunks) {
    const params = new URLSearchParams({
      part: "statistics",
      id: chunk.join(","),
      key: apiKey,
    });
    const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`YouTube videos API error: ${err}`);
    }
    const data = await res.json();

    for (const item of data.items ?? []) {
      const stats = item.statistics ?? {};
      const views = parseInt(stats.viewCount ?? "0", 10);
      const likes = parseInt(stats.likeCount ?? "0", 10);
      const comments = parseInt(stats.commentCount ?? "0", 10);
      const engagementRate = views > 0 ? ((likes + comments) / views) * 100 : 0;

      metrics.push({
        videoId: `yt_${item.id}`,
        viewCount: views,
        likes,
        comments,
        shares: 0, // YouTube API does not expose share counts
        engagementRate: parseFloat(engagementRate.toFixed(4)),
      });
    }
  }

  return metrics;
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
