import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertUser,
  alertEvents,
  alertThresholds,
  apiCredentials,
  influencers,
  platformAccounts,
  reportSchedule,
  reports,
  shills,
  syncLog,
  users,
  videos,
  viewCounts,
  youtubeChannels,
  socialAccounts,
  socialPosts,
  socialPostSnapshots,
} from "../drizzle/schema";
import type { InsertYoutubeChannel } from "../drizzle/schema";
import type {
  InsertAlertEvent,
  InsertAlertThreshold,
  InsertApiCredential,
  InsertInfluencer,
  InsertPlatformAccount,
  InsertReport,
  InsertReportSchedule,
  InsertShill,
  InsertSyncLog,
  InsertVideo,
  InsertViewCount,
} from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  for (const field of textFields) {
    const value = user[field];
    if (value === undefined) continue;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Influencers ──────────────────────────────────────────────────────────────
export async function getAllInfluencers() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(influencers).orderBy(influencers.name);
}

export async function getInfluencerById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(influencers).where(eq(influencers.id, id)).limit(1);
  return result[0];
}

export async function createInfluencer(data: InsertInfluencer) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(influencers).values(data);
}

export async function updateInfluencer(id: number, data: Partial<InsertInfluencer>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(influencers).set(data).where(eq(influencers.id, id));
}

export async function deleteInfluencer(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(influencers).set({ isActive: false }).where(eq(influencers.id, id));
}

// ─── Platform Accounts ────────────────────────────────────────────────────────
export async function getPlatformAccountsByInfluencer(influencerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(platformAccounts).where(eq(platformAccounts.influencerId, influencerId));
}

export async function getAllPlatformAccounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(platformAccounts).where(eq(platformAccounts.isActive, true));
}

export async function upsertPlatformAccount(data: InsertPlatformAccount) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(platformAccounts).values(data).onDuplicateKeyUpdate({ set: data });
}

export async function updatePlatformAccountSyncTime(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(platformAccounts).set({ lastSyncAt: new Date() }).where(eq(platformAccounts.id, id));
}

// ─── Videos ───────────────────────────────────────────────────────────────────
export async function getAllVideos(filters?: {
  influencerName?: string;
  platform?: string;
  dateFrom?: string;
  dateTo?: string;
  channelId?: string;
}) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(videos.isActive, true)];
  if (filters?.influencerName) conditions.push(eq(videos.influencerName, filters.influencerName));
  if (filters?.platform) conditions.push(eq(videos.platform, filters.platform as "YouTube" | "Instagram" | "TikTok"));
  if (filters?.dateFrom) conditions.push(gte(videos.publishedDate, filters.dateFrom));
  if (filters?.dateTo) conditions.push(lte(videos.publishedDate, filters.dateTo));
  if (filters?.channelId) conditions.push(eq(videos.channelId, filters.channelId));
  return db.select().from(videos).where(and(...conditions)).orderBy(desc(videos.publishedDate));
}

export async function getVideoByVideoId(videoId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(videos).where(eq(videos.videoId, videoId)).limit(1);
  return result[0];
}

export async function insertVideo(data: InsertVideo) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(videos).values(data).onDuplicateKeyUpdate({ set: { title: data.title, thumbnailUrl: data.thumbnailUrl } });
}

export async function updateVideo(videoId: string, data: Partial<InsertVideo>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(videos).set(data).where(eq(videos.videoId, videoId));
}

export async function deleteVideo(videoId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(videos).set({ isActive: false }).where(eq(videos.videoId, videoId));
}

export async function getVideoStats() {
  const db = await getDb();
  if (!db) return { total: 0, byInfluencer: [], byPlatform: [] };
  const total = await db.select({ count: sql<number>`count(*)` }).from(videos).where(eq(videos.isActive, true));
  const byInfluencer = await db
    .select({ influencerName: videos.influencerName, count: sql<number>`count(*)` })
    .from(videos)
    .where(eq(videos.isActive, true))
    .groupBy(videos.influencerName);
  const byPlatform = await db
    .select({ platform: videos.platform, count: sql<number>`count(*)` })
    .from(videos)
    .where(eq(videos.isActive, true))
    .groupBy(videos.platform);
  return { total: total[0]?.count ?? 0, byInfluencer, byPlatform };
}

// ─── View Counts ──────────────────────────────────────────────────────────────
export async function getViewCountsByVideoId(videoId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(viewCounts)
    .where(eq(viewCounts.videoId, videoId))
    .orderBy(viewCounts.date);
}

export async function getAllViewCounts() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(viewCounts).orderBy(viewCounts.videoId, viewCounts.date);
}

export async function getLatestViewCountByVideoId(videoId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(viewCounts)
    .where(eq(viewCounts.videoId, videoId))
    .orderBy(desc(viewCounts.date))
    .limit(1);
  return result[0];
}

export async function insertViewCount(data: InsertViewCount) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Only insert if no row exists for this video+date (never overwrite)
  const existing = await db
    .select({ id: viewCounts.id })
    .from(viewCounts)
    .where(and(eq(viewCounts.videoId, data.videoId), eq(viewCounts.date, data.date)))
    .limit(1);
  if (existing.length === 0) {
    await db.insert(viewCounts).values(data);
    return true;
  }
  return false; // already exists for today
}

export async function getViewCountTrends(days: number = 30) {
  const db = await getDb();
  if (!db) return [];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  const cutoffStr = cutoff.toISOString().split("T")[0];
  return db
    .select({
      date: viewCounts.date,
      videoId: viewCounts.videoId,
      viewCount: viewCounts.viewCount,
      likes: viewCounts.likes,
      comments: viewCounts.comments,
      engagementRate: viewCounts.engagementRate,
      influencerName: videos.influencerName,
      platform: videos.platform,
      title: videos.title,
    })
    .from(viewCounts)
    .innerJoin(videos, eq(viewCounts.videoId, videos.videoId))
    .where(gte(viewCounts.date, cutoffStr!))
    .orderBy(viewCounts.date);
}

export async function getTotalViewsAllTime() {
  const db = await getDb();
  if (!db) return 0;
  // Sum latest view count per video
  const result = await db
    .select({ total: sql<number>`sum(vc.view_count)` })
    .from(
      db
        .select({
          videoId: viewCounts.videoId,
          viewCount: sql<number>`max(view_count)`.as("view_count"),
        })
        .from(viewCounts)
        .groupBy(viewCounts.videoId)
        .as("vc")
    );
  return result[0]?.total ?? 0;
}

export async function getAvgEngagementRate() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ avg: sql<number>`avg(engagement_rate)` })
    .from(viewCounts);
  return result[0]?.avg ?? 0;
}

// ─── Shills ───────────────────────────────────────────────────────────────────
export async function getAllShills(filters?: { videoId?: string; brand?: string }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [];
  if (filters?.videoId) conditions.push(eq(shills.videoId, filters.videoId));
  if (filters?.brand) conditions.push(eq(shills.productBrand, filters.brand));
  const query = db
    .select({
      id: shills.id,
      shillId: shills.shillId,
      videoId: shills.videoId,
      productBrand: shills.productBrand,
      timestamp: shills.timestamp,
      lengthSeconds: shills.lengthSeconds,
      promoType: shills.promoType,
      notes: shills.notes,
      createdAt: shills.createdAt,
      videoTitle: videos.title,
      influencerName: videos.influencerName,
      platform: videos.platform,
    })
    .from(shills)
    .leftJoin(videos, eq(shills.videoId, videos.videoId))
    .orderBy(desc(shills.createdAt));
  if (conditions.length > 0) return query.where(and(...conditions));
  return query;
}

export async function insertShill(data: InsertShill) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(shills).values(data);
}

export async function updateShill(shillId: string, data: Partial<InsertShill>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(shills).set(data).where(eq(shills.shillId, shillId));
}

export async function deleteShill(shillId: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(shills).where(eq(shills.shillId, shillId));
}

export async function getShillBrandSummary() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      productBrand: shills.productBrand,
      count: sql<number>`count(*)`,
      totalSeconds: sql<number>`sum(length_seconds)`,
      avgSeconds: sql<number>`avg(length_seconds)`,
    })
    .from(shills)
    .groupBy(shills.productBrand)
    .orderBy(desc(sql`count(*)`));
}

// ─── API Credentials ──────────────────────────────────────────────────────────
export async function getAllCredentials() {
  const db = await getDb();
  if (!db) return [];
  return db.select({
    id: apiCredentials.id,
    platform: apiCredentials.platform,
    label: apiCredentials.label,
    credentialKey: apiCredentials.credentialKey,
    isActive: apiCredentials.isActive,
    lastTestedAt: apiCredentials.lastTestedAt,
    createdAt: apiCredentials.createdAt,
  }).from(apiCredentials).orderBy(apiCredentials.platform);
}

export async function getCredentialByKey(key: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(apiCredentials)
    .where(and(eq(apiCredentials.credentialKey, key), eq(apiCredentials.isActive, true)))
    .limit(1);
  return result[0];
}

export async function upsertCredential(data: InsertApiCredential) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(apiCredentials).values(data).onDuplicateKeyUpdate({
    set: { credentialValue: data.credentialValue, label: data.label, isActive: data.isActive },
  });
}

export async function deleteCredential(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(apiCredentials).set({ isActive: false }).where(eq(apiCredentials.id, id));
}

// ─── Alert Thresholds ─────────────────────────────────────────────────────────
export async function getAllAlertThresholds() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(alertThresholds).orderBy(alertThresholds.alertType);
}

export async function insertAlertThreshold(data: InsertAlertThreshold) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(alertThresholds).values(data);
}

export async function updateAlertThreshold(id: number, data: Partial<InsertAlertThreshold>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(alertThresholds).set(data).where(eq(alertThresholds.id, id));
}

export async function deleteAlertThreshold(id: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.delete(alertThresholds).where(eq(alertThresholds.id, id));
}

// ─── Alert Events ─────────────────────────────────────────────────────────────
export async function getAlertEvents(limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: alertEvents.id,
      thresholdId: alertEvents.thresholdId,
      videoId: alertEvents.videoId,
      triggeredValue: alertEvents.triggeredValue,
      message: alertEvents.message,
      isRead: alertEvents.isRead,
      createdAt: alertEvents.createdAt,
      thresholdName: alertThresholds.name,
      alertType: alertThresholds.alertType,
    })
    .from(alertEvents)
    .leftJoin(alertThresholds, eq(alertEvents.thresholdId, alertThresholds.id))
    .orderBy(desc(alertEvents.createdAt))
    .limit(limit);
}

export async function insertAlertEvent(data: InsertAlertEvent) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(alertEvents).values(data);
}

export async function markAlertRead(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(alertEvents).set({ isRead: true }).where(eq(alertEvents.id, id));
}

export async function getUnreadAlertCount() {
  const db = await getDb();
  if (!db) return 0;
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(alertEvents)
    .where(eq(alertEvents.isRead, false));
  return result[0]?.count ?? 0;
}

// ─── Reports ──────────────────────────────────────────────────────────────────
export async function getAllReports(limit = 30) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reports).orderBy(desc(reports.createdAt)).limit(limit);
}

export async function getReportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reports).where(eq(reports.id, id)).limit(1);
  return result[0];
}

export async function insertReport(data: InsertReport) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(reports).values(data);
  return result;
}

export async function getReportSchedules() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportSchedule);
}

export async function updateReportSchedule(frequency: "daily" | "weekly", data: Partial<InsertReportSchedule>) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(reportSchedule).set(data).where(eq(reportSchedule.frequency, frequency));
}

// ─── Sync Log ─────────────────────────────────────────────────────────────────
export async function insertSyncLog(data: InsertSyncLog) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const result = await db.insert(syncLog).values(data);
  return result;
}

export async function updateSyncLog(id: number, data: Partial<InsertSyncLog>) {
  const db = await getDb();
  if (!db) return;
  await db.update(syncLog).set(data).where(eq(syncLog.id, id));
}

export async function getRecentSyncLogs(limit = 20) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(syncLog).orderBy(desc(syncLog.startedAt)).limit(limit);
}

// ─── YouTube Channels ──────────────────────────────────────────────────────────
export async function getAllChannels() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(youtubeChannels).orderBy(youtubeChannels.channelName);
}

export async function getChannelById(channelId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const rows = await db.select().from(youtubeChannels).where(eq(youtubeChannels.channelId, channelId)).limit(1);
  return rows[0];
}

export async function getChannelsByInfluencer(influencerName: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(youtubeChannels).where(eq(youtubeChannels.influencerName, influencerName));
}

export async function upsertChannel(data: InsertYoutubeChannel) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db
    .insert(youtubeChannels)
    .values(data)
    .onDuplicateKeyUpdate({
      set: {
        channelName: data.channelName,
        channelHandle: data.channelHandle ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        subscriberCount: data.subscriberCount ?? 0,
        videoCount: data.videoCount ?? 0,
        description: data.description ?? null,
        isActive: data.isActive ?? true,
      },
    });
}

export async function updateChannelLastChecked(channelId: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(youtubeChannels)
    .set({ lastCheckedAt: new Date() })
    .where(eq(youtubeChannels.channelId, channelId));
}

export async function deleteChannel(channelId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(youtubeChannels).where(eq(youtubeChannels.channelId, channelId));
}

export async function getVideosByChannelId(channelId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(videos)
    .where(eq(videos.channelId, channelId))
    .orderBy(desc(videos.publishedDate));
}

export async function getActiveChannels() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(youtubeChannels).where(eq(youtubeChannels.isActive, true));
}

// ─── Social Accounts ──────────────────────────────────────────────────────────
export async function upsertSocialAccount(data: {
  accountId: string;
  platform: "Instagram" | "X";
  handle: string;
  displayName?: string | null;
  profileUrl?: string | null;
  thumbnailUrl?: string | null;
  followerCount?: number;
  postCount?: number;
  description?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(socialAccounts)
    .values({ ...data, isActive: true })
    .onDuplicateKeyUpdate({
      set: {
        displayName: data.displayName ?? null,
        thumbnailUrl: data.thumbnailUrl ?? null,
        followerCount: data.followerCount ?? 0,
        postCount: data.postCount ?? 0,
        description: data.description ?? null,
        updatedAt: new Date(),
      },
    });
}

export async function getAllSocialAccounts(platform?: "Instagram" | "X") {
  const db = await getDb();
  if (!db) return [];
  const query = db.select().from(socialAccounts).where(eq(socialAccounts.isActive, true));
  if (platform) {
    return db.select().from(socialAccounts).where(and(eq(socialAccounts.isActive, true), eq(socialAccounts.platform, platform)));
  }
  return query;
}

export async function getSocialAccountById(accountId: string) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(socialAccounts).where(eq(socialAccounts.accountId, accountId)).limit(1);
  return rows[0] ?? null;
}

export async function deleteSocialAccount(accountId: string) {
  const db = await getDb();
  if (!db) return;
  await db.delete(socialAccounts).where(eq(socialAccounts.accountId, accountId));
}

export async function updateSocialAccountLastChecked(accountId: string, postCount?: number) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(socialAccounts)
    .set({ lastCheckedAt: new Date(), ...(postCount !== undefined ? { postCount } : {}) })
    .where(eq(socialAccounts.accountId, accountId));
}

export async function upsertSocialPost(data: {
  postId: string;
  accountId: string;
  platform: "Instagram" | "X";
  postUrl: string;
  title?: string | null;
  publishedDate?: string | null;
  thumbnailUrl?: string | null;
}) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(socialPosts)
    .values({ ...data, isActive: true })
    .onDuplicateKeyUpdate({ set: { title: data.title ?? null, thumbnailUrl: data.thumbnailUrl ?? null } });
}

export async function getSocialPostsByAccount(accountId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(socialPosts)
    .where(and(eq(socialPosts.accountId, accountId), eq(socialPosts.isActive, true)))
    .orderBy(desc(socialPosts.publishedDate))
    .limit(50);
}

export async function insertSocialPostSnapshot(data: {
  snapshotId: string;
  postId: string;
  accountId: string;
  platform: "Instagram" | "X";
  date: string;
  views?: number;
  impressions?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  retweets?: number;
  engagementRate?: string;
}) {
  const db = await getDb();
  if (!db) return;
  await db
    .insert(socialPostSnapshots)
    .values(data)
    .onDuplicateKeyUpdate({ set: { likes: data.likes ?? 0, comments: data.comments ?? 0, retweets: data.retweets ?? 0 } });
}
