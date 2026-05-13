/**
 * socialEngine.ts
 * Public-data fetchers for Instagram and X (Twitter) accounts and posts.
 *
 * Approach:
 * - Instagram: Uses the public oEmbed endpoint + profile scraping via public
 *   Instagram pages (no login required for public accounts).
 * - X (Twitter): Uses the public oEmbed endpoint + nitter.net as a public
 *   scraping proxy (no API key required for public accounts).
 *
 * All functions return null / empty arrays gracefully on failure so the
 * daily sync never crashes the whole pipeline.
 */

import { nanoid } from "nanoid";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SocialAccountInfo {
  accountId: string;       // platform-scoped unique ID  e.g. "ig_username" or "x_username"
  platform: "Instagram" | "X";
  handle: string;          // @username without @
  displayName: string;
  profileUrl: string;
  thumbnailUrl: string | null;
  followerCount: number;
  postCount: number;
  description: string | null;
}

export interface SocialPostInfo {
  postId: string;          // platform-scoped  e.g. "ig_<shortcode>" or "x_<tweetId>"
  accountId: string;
  platform: "Instagram" | "X";
  postUrl: string;
  title: string | null;
  publishedDate: string | null;  // YYYY-MM-DD
  thumbnailUrl: string | null;
  // Initial stats
  views: number;
  impressions: number;
  likes: number;
  comments: number;
  shares: number;
  retweets: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayStr(): string {
  return new Date().toISOString().split("T")[0]!;
}

async function fetchWithTimeout(url: string, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/json,*/*",
      },
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

// ─── Instagram ────────────────────────────────────────────────────────────────

/**
 * Resolve an Instagram handle to account metadata using public profile page.
 * Returns a best-effort SocialAccountInfo — follower/post counts may be 0
 * if Instagram's public page has changed its structure.
 */
export async function resolveInstagramAccount(handle: string): Promise<SocialAccountInfo> {
  // Normalise handle
  const cleanHandle = handle.replace(/^@/, "").replace(/https?:\/\/(www\.)?instagram\.com\//i, "").replace(/\/$/, "");
  const profileUrl = `https://www.instagram.com/${cleanHandle}/`;
  const accountId = `ig_${cleanHandle.toLowerCase()}`;

  let displayName = cleanHandle;
  let thumbnailUrl: string | null = null;
  let followerCount = 0;
  let postCount = 0;
  let description: string | null = null;

  try {
    // Try oEmbed for basic info
    const oembedUrl = `https://www.instagram.com/api/v1/users/web_profile_info/?username=${cleanHandle}`;
    // Instagram's web_profile_info requires cookies; fall back to page scrape
    const pageRes = await fetchWithTimeout(profileUrl);
    const html = await pageRes.text();

    // Extract meta tags from the public profile page
    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
    const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1];
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];

    if (ogTitle) displayName = ogTitle.replace(/ \(@[^)]+\).*$/, "").trim();
    if (ogImage) thumbnailUrl = ogImage;
    if (ogDesc) {
      description = ogDesc;
      // Try to parse "X Followers, Y Following, Z Posts"
      const followerMatch = ogDesc.match(/([\d,]+)\s+Followers/i);
      const postMatch = ogDesc.match(/([\d,]+)\s+Posts/i);
      if (followerMatch) followerCount = parseInt(followerMatch[1].replace(/,/g, ""), 10) || 0;
      if (postMatch) postCount = parseInt(postMatch[1].replace(/,/g, ""), 10) || 0;
    }
  } catch {
    // Silently fall back to defaults
  }

  return {
    accountId,
    platform: "Instagram",
    handle: cleanHandle,
    displayName,
    profileUrl,
    thumbnailUrl,
    followerCount,
    postCount,
    description,
  };
}

/**
 * Fetch recent Instagram posts for a public account.
 * Uses the public profile page to extract post shortcodes.
 * Returns up to `limit` posts with best-effort stats.
 */
export async function fetchInstagramPosts(handle: string, limit = 12): Promise<SocialPostInfo[]> {
  const cleanHandle = handle.replace(/^@/, "");
  const accountId = `ig_${cleanHandle.toLowerCase()}`;
  const posts: SocialPostInfo[] = [];

  try {
    const profileUrl = `https://www.instagram.com/${cleanHandle}/`;
    const res = await fetchWithTimeout(profileUrl);
    const html = await res.text();

    // Extract shortcodes from the page source
    const shortcodeMatches = Array.from(html.matchAll(/"shortcode":"([A-Za-z0-9_-]{10,12})"/g));
    const seen = new Set<string>();
    const shortcodes: string[] = [];
    for (const m of shortcodeMatches) {
      if (m[1] && !seen.has(m[1])) {
        seen.add(m[1]);
        shortcodes.push(m[1]);
        if (shortcodes.length >= limit) break;
      }
    }

    for (const shortcode of shortcodes) {
      const postUrl = `https://www.instagram.com/p/${shortcode}/`;
      const postId = `ig_${shortcode}`;

      // Try to get like count from oEmbed
      let likeCount = 0;
      let commentCount = 0;
      let title: string | null = null;
      let thumbnailUrl: string | null = null;
      let publishedDate: string | null = null;

      try {
        const oembedUrl = `https://www.instagram.com/api/oembed/?url=${encodeURIComponent(postUrl)}&omitscript=true`;
        const oembedRes = await fetchWithTimeout(oembedUrl, 5000);
        if (oembedRes.ok) {
          const oembed = await oembedRes.json() as Record<string, unknown>;
          title = (oembed.title as string) ?? null;
          thumbnailUrl = (oembed.thumbnail_url as string) ?? null;
        }
      } catch {
        // oEmbed failed, continue with defaults
      }

      posts.push({
        postId,
        accountId,
        platform: "Instagram",
        postUrl,
        title,
        publishedDate,
        thumbnailUrl,
        views: 0,
        impressions: 0,
        likes: likeCount,
        comments: commentCount,
        shares: 0,
        retweets: 0,
      });
    }
  } catch {
    // Return whatever we have
  }

  return posts;
}

// ─── X (Twitter) ─────────────────────────────────────────────────────────────

/**
 * Resolve an X handle to account metadata using public oEmbed + profile page.
 */
export async function resolveXAccount(handle: string): Promise<SocialAccountInfo> {
  const cleanHandle = handle.replace(/^@/, "").replace(/https?:\/\/(www\.)?(twitter|x)\.com\//i, "").replace(/\/$/, "");
  const profileUrl = `https://x.com/${cleanHandle}`;
  const accountId = `x_${cleanHandle.toLowerCase()}`;

  let displayName = cleanHandle;
  let thumbnailUrl: string | null = null;
  let followerCount = 0;
  let postCount = 0;
  let description: string | null = null;

  try {
    // Try fetching the public profile page
    const res = await fetchWithTimeout(profileUrl);
    const html = await res.text();

    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
    const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1];
    const ogImage = html.match(/<meta property="og:image" content="([^"]+)"/)?.[1];

    if (ogTitle) displayName = ogTitle.replace(/\s*\(@[^)]+\).*$/, "").trim();
    if (ogImage) thumbnailUrl = ogImage;
    if (ogDesc) description = ogDesc;

    // Try nitter.net as a fallback for follower counts (public mirror)
    try {
      const nitterRes = await fetchWithTimeout(`https://nitter.net/${cleanHandle}`, 6000);
      const nitterHtml = await nitterRes.text();
      const followerMatch = nitterHtml.match(/Followers<\/span>\s*<span[^>]*>([\d,]+)/i);
      const tweetMatch = nitterHtml.match(/Tweets<\/span>\s*<span[^>]*>([\d,]+)/i);
      if (followerMatch) followerCount = parseInt(followerMatch[1].replace(/,/g, ""), 10) || 0;
      if (tweetMatch) postCount = parseInt(tweetMatch[1].replace(/,/g, ""), 10) || 0;
    } catch {
      // nitter unavailable, keep defaults
    }
  } catch {
    // Silently fall back to defaults
  }

  return {
    accountId,
    platform: "X",
    handle: cleanHandle,
    displayName,
    profileUrl,
    thumbnailUrl,
    followerCount,
    postCount,
    description,
  };
}

/**
 * Fetch recent X (Twitter) posts for a public account.
 * Uses nitter.net as a public scraping proxy.
 */
export async function fetchXPosts(handle: string, limit = 20): Promise<SocialPostInfo[]> {
  const cleanHandle = handle.replace(/^@/, "");
  const accountId = `x_${cleanHandle.toLowerCase()}`;
  const posts: SocialPostInfo[] = [];

  try {
    const nitterUrl = `https://nitter.net/${cleanHandle}`;
    const res = await fetchWithTimeout(nitterUrl, 8000);
    const html = await res.text();

    // Extract tweet IDs from nitter HTML
    const tweetMatches = Array.from(html.matchAll(/href="\/[^/]+\/status\/(\d+)"/g));
    const seen = new Set<string>();
    const tweetIds: string[] = [];
    for (const m of tweetMatches) {
      if (m[1] && !seen.has(m[1])) {
        seen.add(m[1]);
        tweetIds.push(m[1]);
        if (tweetIds.length >= limit) break;
      }
    }

    for (const tweetId of tweetIds) {
      const postUrl = `https://x.com/${cleanHandle}/status/${tweetId}`;
      const postId = `x_${tweetId}`;

      let title: string | null = null;
      let likeCount = 0;
      let retweetCount = 0;
      let replyCount = 0;
      let publishedDate: string | null = null;
      let thumbnailUrl: string | null = null;

      // Try oEmbed for tweet content
      try {
        const oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(postUrl)}&omit_script=true`;
        const oembedRes = await fetchWithTimeout(oembedUrl, 5000);
        if (oembedRes.ok) {
          const oembed = await oembedRes.json() as Record<string, unknown>;
          // Extract text from html field
          const htmlContent = oembed.html as string ?? "";
          const textMatch = htmlContent.match(/<p[^>]*>([\s\S]*?)<\/p>/);
          if (textMatch) title = textMatch[1].replace(/<[^>]+>/g, "").trim().slice(0, 280);
        }
      } catch {
        // oEmbed failed
      }

      posts.push({
        postId,
        accountId,
        platform: "X",
        postUrl,
        title,
        publishedDate,
        thumbnailUrl,
        views: 0,
        impressions: 0,
        likes: likeCount,
        comments: replyCount,
        shares: 0,
        retweets: retweetCount,
      });
    }
  } catch {
    // Return whatever we have
  }

  return posts;
}

/**
 * Generate a snapshot ID for a social post on a given date.
 */
export function toSnapshotId(postId: string, date: string): string {
  return `snap_${postId}_${date}`;
}
