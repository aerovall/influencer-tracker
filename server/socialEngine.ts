/**
 * socialEngine.ts
 * Public-data fetchers for Instagram and X (Twitter) accounts and posts.
 *
 * Reality check (2025):
 * - Instagram: All public scraping endpoints are blocked. Requires Instagram
 *   Graph API with a valid access token (Facebook Developer account + connected
 *   Instagram Business/Creator account).
 * - X (Twitter): nitter.net is dead (empty responses). Requires Twitter API v2
 *   Bearer token for profile lookups and tweet fetching.
 *
 * Both integrations are optional — the app works without them, but follower
 * counts and post data will not be available until API keys are configured.
 * Set INSTAGRAM_ACCESS_TOKEN and TWITTER_BEARER_TOKEN environment variables.
 */

import { ENV } from "./_core/env.js";
import { getCredentialByKey } from "./db.js";

/** Resolve Instagram token: env var first, then DB credential */
async function getInstagramToken(): Promise<string | null> {
  if (ENV.instagramAccessToken) return ENV.instagramAccessToken;
  const cred = await getCredentialByKey("instagram_access_token");
  return cred?.credentialValue ?? null;
}

/** Resolve Twitter Bearer token: env var first, then DB credential */
async function getTwitterToken(): Promise<string | null> {
  if (ENV.twitterBearerToken) return ENV.twitterBearerToken;
  const cred = await getCredentialByKey("twitter_bearer_token");
  return cred?.credentialValue ?? null;
}

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
  apiConnected: boolean;   // true if API key is configured and working
}

export interface SocialPostInfo {
  postId: string;          // platform-scoped  e.g. "ig_<shortcode>" or "x_<tweetId>"
  accountId: string;
  platform: "Instagram" | "X";
  postUrl: string;
  title: string | null;
  publishedDate: string | null;  // YYYY-MM-DD
  thumbnailUrl: string | null;
  // Stats
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

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        ...options.headers,
      },
      ...options,
    });
  } finally {
    clearTimeout(timer);
  }
}

// ─── Instagram ────────────────────────────────────────────────────────────────

/**
 * Resolve an Instagram handle to account metadata.
 *
 * Uses Instagram Graph API if INSTAGRAM_ACCESS_TOKEN is set.
 * Returns a stub with apiConnected=false if no token is available.
 *
 * Instagram Graph API setup:
 * 1. Create a Facebook Developer account at https://developers.facebook.com
 * 2. Create an app with Instagram Graph API product
 * 3. Connect an Instagram Business or Creator account
 * 4. Generate a long-lived access token
 * 5. Set INSTAGRAM_ACCESS_TOKEN environment variable
 */
export async function resolveInstagramAccount(handle: string): Promise<SocialAccountInfo> {
  const cleanHandle = handle
    .replace(/^@/, "")
    .replace(/https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/$/, "");
  const profileUrl = `https://www.instagram.com/${cleanHandle}/`;
  const accountId = `ig_${cleanHandle.toLowerCase()}`;
  const token = await getInstagramToken();

  if (!token) {
    return {
      accountId,
      platform: "Instagram",
      handle: cleanHandle,
      displayName: cleanHandle,
      profileUrl,
      thumbnailUrl: null,
      followerCount: 0,
      postCount: 0,
      description: "Instagram API key not configured. Add it in Admin → API Keys to enable data fetching.",
      apiConnected: false,
    };
  }

  try {
    // Step 1: Get the Instagram user ID from the handle
    const searchRes = await fetchWithTimeout(
      `https://graph.instagram.com/v19.0/ig_hashtag_search?user_id=me&q=${encodeURIComponent(cleanHandle)}&access_token=${token}`,
      {},
      8000
    );

    // Simpler approach: use the /me endpoint if the token is for this account
    // or use the Business Discovery API for other accounts
    const meRes = await fetchWithTimeout(
      `https://graph.instagram.com/v19.0/me?fields=id,username,name,biography,followers_count,media_count,profile_picture_url&access_token=${token}`,
      {},
      8000
    );

    if (!meRes.ok) {
      const errText = await meRes.text();
      console.error(`[socialEngine] Instagram Graph API error: ${meRes.status} ${errText}`);
      return {
        accountId,
        platform: "Instagram",
        handle: cleanHandle,
        displayName: cleanHandle,
        profileUrl,
        thumbnailUrl: null,
        followerCount: 0,
        postCount: 0,
        description: `Instagram API error: ${meRes.status}`,
        apiConnected: false,
      };
    }

    const me = await meRes.json() as any;

    // If the token is for a different account, use Business Discovery API
    let userData = me;
    if (me.username?.toLowerCase() !== cleanHandle.toLowerCase()) {
      // Try Business Discovery API
      const bizRes = await fetchWithTimeout(
        `https://graph.instagram.com/v19.0/me?fields=business_discovery.fields(id,username,name,biography,followers_count,media_count,profile_picture_url)&username=${cleanHandle}&access_token=${token}`,
        {},
        8000
      );
      if (bizRes.ok) {
        const bizData = await bizRes.json() as any;
        userData = bizData?.business_discovery ?? me;
      }
    }

    return {
      accountId,
      platform: "Instagram",
      handle: userData.username ?? cleanHandle,
      displayName: userData.name ?? userData.username ?? cleanHandle,
      profileUrl,
      thumbnailUrl: userData.profile_picture_url ?? null,
      followerCount: userData.followers_count ?? 0,
      postCount: userData.media_count ?? 0,
      description: userData.biography ?? null,
      apiConnected: true,
    };
  } catch (err: any) {
    console.error(`[socialEngine] resolveInstagramAccount failed:`, err.message);
    return {
      accountId,
      platform: "Instagram",
      handle: cleanHandle,
      displayName: cleanHandle,
      profileUrl,
      thumbnailUrl: null,
      followerCount: 0,
      postCount: 0,
      description: `Instagram API error: ${err.message}`,
      apiConnected: false,
    };
  }
}

/**
 * Fetch recent Instagram posts using the Instagram Graph API.
 * Returns empty array if INSTAGRAM_ACCESS_TOKEN is not set.
 */
export async function fetchInstagramPosts(handle: string, limit = 12): Promise<SocialPostInfo[]> {
  const cleanHandle = handle.replace(/^@/, "");
  const accountId = `ig_${cleanHandle.toLowerCase()}`;
  const token = await getInstagramToken();

  if (!token) return [];

  try {
    // Get media for the authenticated account (or use Business Discovery for others)
    const res = await fetchWithTimeout(
      `https://graph.instagram.com/v19.0/me/media?fields=id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count&limit=${limit}&access_token=${token}`,
      {},
      10000
    );

    if (!res.ok) {
      console.error(`[socialEngine] Instagram media fetch error: ${res.status}`);
      return [];
    }

    const data = await res.json() as any;
    const posts: SocialPostInfo[] = [];

    for (const item of data?.data ?? []) {
      const postId = `ig_${item.id}`;
      const publishedDate = item.timestamp ? item.timestamp.slice(0, 10) : todayStr();

      posts.push({
        postId,
        accountId,
        platform: "Instagram",
        postUrl: item.permalink ?? `https://www.instagram.com/p/${item.id}/`,
        title: item.caption?.slice(0, 280) ?? null,
        publishedDate,
        thumbnailUrl: item.thumbnail_url ?? item.media_url ?? null,
        views: 0,
        impressions: 0,
        likes: item.like_count ?? 0,
        comments: item.comments_count ?? 0,
        shares: 0,
        retweets: 0,
      });
    }

    return posts;
  } catch (err: any) {
    console.error(`[socialEngine] fetchInstagramPosts failed:`, err.message);
    return [];
  }
}

// ─── X (Twitter) ─────────────────────────────────────────────────────────────

/**
 * Resolve an X handle to account metadata.
 *
 * Uses Twitter API v2 if TWITTER_BEARER_TOKEN is set.
 * Returns a stub with apiConnected=false if no token is available.
 *
 * Twitter API v2 setup:
 * 1. Create a developer account at https://developer.x.com
 * 2. Create a project and app (free tier: 500K tweet reads/month)
 * 3. Copy the Bearer Token from the app's "Keys and Tokens" page
 * 4. Set TWITTER_BEARER_TOKEN environment variable
 */
export async function resolveXAccount(handle: string): Promise<SocialAccountInfo> {
  const cleanHandle = handle
    .replace(/^@/, "")
    .replace(/https?:\/\/(www\.)?(twitter|x)\.com\//i, "")
    .replace(/\/$/, "");
  const profileUrl = `https://x.com/${cleanHandle}`;
  const accountId = `x_${cleanHandle.toLowerCase()}`;
  const token = await getTwitterToken();

  if (!token) {
    return {
      accountId,
      platform: "X",
      handle: cleanHandle,
      displayName: cleanHandle,
      profileUrl,
      thumbnailUrl: null,
      followerCount: 0,
      postCount: 0,
      description: "Twitter/X API key not configured. Add it in Admin → API Keys to enable data fetching.",
      apiConnected: false,
    };
  }

  try {
    const res = await fetchWithTimeout(
      `https://api.twitter.com/2/users/by/username/${cleanHandle}?user.fields=name,description,profile_image_url,public_metrics`,
      { headers: { Authorization: `Bearer ${token}` } },
      8000
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[socialEngine] Twitter API v2 error: ${res.status} ${errText}`);
      return {
        accountId,
        platform: "X",
        handle: cleanHandle,
        displayName: cleanHandle,
        profileUrl,
        thumbnailUrl: null,
        followerCount: 0,
        postCount: 0,
        description: `Twitter API error: ${res.status}`,
        apiConnected: false,
      };
    }

    const data = await res.json() as any;
    const user = data?.data ?? {};
    const metrics = user?.public_metrics ?? {};

    return {
      accountId,
      platform: "X",
      handle: cleanHandle,
      displayName: user.name ?? cleanHandle,
      profileUrl,
      thumbnailUrl: user.profile_image_url?.replace("_normal", "_400x400") ?? null,
      followerCount: metrics.followers_count ?? 0,
      postCount: metrics.tweet_count ?? 0,
      description: user.description ?? null,
      apiConnected: true,
    };
  } catch (err: any) {
    console.error(`[socialEngine] resolveXAccount failed:`, err.message);
    return {
      accountId,
      platform: "X",
      handle: cleanHandle,
      displayName: cleanHandle,
      profileUrl,
      thumbnailUrl: null,
      followerCount: 0,
      postCount: 0,
      description: `Twitter API error: ${err.message}`,
      apiConnected: false,
    };
  }
}

/**
 * Fetch recent X (Twitter) posts using Twitter API v2.
 * Returns empty array if TWITTER_BEARER_TOKEN is not set.
 */
export async function fetchXPosts(handle: string, limit = 20): Promise<SocialPostInfo[]> {
  const cleanHandle = handle.replace(/^@/, "");
  const accountId = `x_${cleanHandle.toLowerCase()}`;
  const token = await getTwitterToken();

  if (!token) return [];

  try {
    // First get the user ID
    const userRes = await fetchWithTimeout(
      `https://api.twitter.com/2/users/by/username/${cleanHandle}?user.fields=id`,
      { headers: { Authorization: `Bearer ${token}` } },
      8000
    );

    if (!userRes.ok) {
      console.error(`[socialEngine] Twitter user lookup failed: ${userRes.status}`);
      return [];
    }

    const userData = await userRes.json() as any;
    const userId = userData?.data?.id;
    if (!userId) return [];

    // Fetch recent tweets
    const tweetsRes = await fetchWithTimeout(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=${Math.min(limit, 100)}&tweet.fields=created_at,public_metrics,attachments&expansions=attachments.media_keys&media.fields=preview_image_url,url`,
      { headers: { Authorization: `Bearer ${token}` } },
      10000
    );

    if (!tweetsRes.ok) {
      console.error(`[socialEngine] Twitter tweets fetch failed: ${tweetsRes.status}`);
      return [];
    }

    const tweetsData = await tweetsRes.json() as any;
    const posts: SocialPostInfo[] = [];

    // Build media map
    const mediaMap = new Map<string, string>();
    for (const media of tweetsData?.includes?.media ?? []) {
      if (media.media_key) {
        mediaMap.set(media.media_key, media.preview_image_url ?? media.url ?? "");
      }
    }

    for (const tweet of tweetsData?.data ?? []) {
      const postId = `x_${tweet.id}`;
      const metrics = tweet.public_metrics ?? {};
      const publishedDate = tweet.created_at ? tweet.created_at.slice(0, 10) : todayStr();

      // Get thumbnail from first media attachment
      let thumbnailUrl: string | null = null;
      const mediaKeys: string[] = tweet.attachments?.media_keys ?? [];
      if (mediaKeys.length > 0 && mediaMap.has(mediaKeys[0]!)) {
        thumbnailUrl = mediaMap.get(mediaKeys[0]!) ?? null;
      }

      posts.push({
        postId,
        accountId,
        platform: "X",
        postUrl: `https://x.com/${cleanHandle}/status/${tweet.id}`,
        title: tweet.text?.slice(0, 280) ?? null,
        publishedDate,
        thumbnailUrl,
        views: metrics.impression_count ?? 0,
        impressions: metrics.impression_count ?? 0,
        likes: metrics.like_count ?? 0,
        comments: metrics.reply_count ?? 0,
        shares: metrics.quote_count ?? 0,
        retweets: metrics.retweet_count ?? 0,
      });
    }

    return posts;
  } catch (err: any) {
    console.error(`[socialEngine] fetchXPosts failed:`, err.message);
    return [];
  }
}

/**
 * Generate a snapshot ID for a social post on a given date.
 */
export function toSnapshotId(postId: string, date: string): string {
  return `snap_${postId}_${date}`;
}
