import {
  bigint,
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  varchar,
} from "drizzle-orm/mysql-core";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Influencers ──────────────────────────────────────────────────────────────
export const influencers = mysqlTable("influencers", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull().unique(),
  bio: text("bio"),
  avatarUrl: text("avatarUrl"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Influencer = typeof influencers.$inferSelect;
export type InsertInfluencer = typeof influencers.$inferInsert;

// ─── Platform Accounts ────────────────────────────────────────────────────────
export const platformAccounts = mysqlTable("platform_accounts", {
  id: int("id").autoincrement().primaryKey(),
  influencerId: int("influencerId").notNull(),
  platform: mysqlEnum("platform", ["YouTube", "Instagram", "TikTok"]).notNull(),
  channelId: varchar("channelId", { length: 255 }),
  channelUrl: text("channelUrl"),
  username: varchar("username", { length: 255 }),
  credentialKey: varchar("credentialKey", { length: 100 }),
  isActive: boolean("isActive").default(true).notNull(),
  lastSyncAt: timestamp("lastSyncAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PlatformAccount = typeof platformAccounts.$inferSelect;
export type InsertPlatformAccount = typeof platformAccounts.$inferInsert;

// ─── YouTube Channels ───────────────────────────────────────────────────────
export const youtubeChannels = mysqlTable("youtube_channels", {
  id: int("id").autoincrement().primaryKey(),
  channelId: varchar("channel_id", { length: 100 }).notNull().unique(),
  channelHandle: varchar("channel_handle", { length: 255 }),
  channelName: varchar("channel_name", { length: 255 }).notNull(),
  influencerName: varchar("influencer_name", { length: 100 }).notNull(),
  thumbnailUrl: text("thumbnail_url"),
  subscriberCount: bigint("subscriber_count", { mode: "number" }).default(0),
  videoCount: int("video_count").default(0),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type YoutubeChannel = typeof youtubeChannels.$inferSelect;
export type InsertYoutubeChannel = typeof youtubeChannels.$inferInsert;

// ─── Table 1: Videos ──────────────────────────────────────────────────────────
export const videos = mysqlTable("videos", {
  id: int("id").autoincrement().primaryKey(),
  videoId: varchar("video_id", { length: 100 }).notNull().unique(),
  influencerName: varchar("influencer_name", { length: 100 }).notNull(),
  platform: mysqlEnum("platform", ["YouTube", "Instagram", "TikTok"]).notNull(),
  channelId: varchar("channel_id", { length: 100 }),  // FK to youtube_channels.channel_id
  videoUrl: text("video_url").notNull(),
  title: text("title").notNull(),
  publishedDate: varchar("published_date", { length: 10 }).notNull(),
  dateAdded: varchar("date_added", { length: 10 }).notNull(),
  thumbnailUrl: text("thumbnailUrl"),
  durationSeconds: int("durationSeconds"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Video = typeof videos.$inferSelect;
export type InsertVideo = typeof videos.$inferInsert;

// ─── Table 2: View Counts ─────────────────────────────────────────────────────
export const viewCounts = mysqlTable("view_counts", {
  id: int("id").autoincrement().primaryKey(),
  countId: varchar("count_id", { length: 100 }).notNull().unique(),
  videoId: varchar("video_id", { length: 100 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  viewCount: bigint("view_count", { mode: "number" }).notNull().default(0),
  likes: bigint("likes", { mode: "number" }).default(0),
  comments: bigint("comments", { mode: "number" }).default(0),
  shares: bigint("shares", { mode: "number" }).default(0),
  engagementRate: decimal("engagement_rate", { precision: 8, scale: 4 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ViewCount = typeof viewCounts.$inferSelect;
export type InsertViewCount = typeof viewCounts.$inferInsert;

// ─── Table 3: Shills ──────────────────────────────────────────────────────────
export const shills = mysqlTable("shills", {
  id: int("id").autoincrement().primaryKey(),
  shillId: varchar("shill_id", { length: 100 }).notNull().unique(),
  videoId: varchar("video_id", { length: 100 }).notNull(),
  productBrand: varchar("product_brand", { length: 255 }).notNull(),
  timestamp: varchar("timestamp", { length: 10 }).notNull(),
  lengthSeconds: int("length_seconds").notNull(),
  promoType: text("promo_type").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Shill = typeof shills.$inferSelect;
export type InsertShill = typeof shills.$inferInsert;

// ─── API Credentials ──────────────────────────────────────────────────────────
export const apiCredentials = mysqlTable("api_credentials", {
  id: int("id").autoincrement().primaryKey(),
  platform: mysqlEnum("platform", ["YouTube", "Instagram", "TikTok"]).notNull(),
  label: varchar("label", { length: 255 }).notNull(),
  credentialKey: varchar("credentialKey", { length: 100 }).notNull().unique(),
  credentialValue: text("credentialValue").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  lastTestedAt: timestamp("lastTestedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ApiCredential = typeof apiCredentials.$inferSelect;
export type InsertApiCredential = typeof apiCredentials.$inferInsert;

// ─── Alert Thresholds ─────────────────────────────────────────────────────────
export const alertThresholds = mysqlTable("alert_thresholds", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  metric: mysqlEnum("metric", [
    "view_count",
    "view_growth_rate",
    "engagement_rate",
    "likes",
    "comments",
    "shares",
  ]).notNull(),
  operator: mysqlEnum("operator", ["gt", "lt", "gte", "lte"]).notNull(),
  thresholdValue: decimal("thresholdValue", { precision: 15, scale: 4 }).notNull(),
  influencerName: varchar("influencerName", { length: 100 }),
  platform: mysqlEnum("platform", ["YouTube", "Instagram", "TikTok"]),
  alertType: mysqlEnum("alertType", ["viral", "underperforming", "custom"]).default("custom").notNull(),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AlertThreshold = typeof alertThresholds.$inferSelect;
export type InsertAlertThreshold = typeof alertThresholds.$inferInsert;

// ─── Alert Events ─────────────────────────────────────────────────────────────
export const alertEvents = mysqlTable("alert_events", {
  id: int("id").autoincrement().primaryKey(),
  thresholdId: int("thresholdId").notNull(),
  videoId: varchar("video_id", { length: 100 }).notNull(),
  triggeredValue: decimal("triggeredValue", { precision: 15, scale: 4 }).notNull(),
  message: text("message").notNull(),
  isRead: boolean("isRead").default(false).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlertEvent = typeof alertEvents.$inferSelect;
export type InsertAlertEvent = typeof alertEvents.$inferInsert;

// ─── Reports ──────────────────────────────────────────────────────────────────
export const reports = mysqlTable("reports", {
  id: int("id").autoincrement().primaryKey(),
  type: mysqlEnum("type", ["daily", "weekly"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  content: text("content").notNull(),
  periodStart: varchar("periodStart", { length: 10 }).notNull(),
  periodEnd: varchar("periodEnd", { length: 10 }).notNull(),
  totalVideos: int("totalVideos").default(0),
  totalViews: bigint("totalViews", { mode: "number" }).default(0),
  avgEngagementRate: decimal("avgEngagementRate", { precision: 8, scale: 4 }).default("0"),
  alertsTriggered: int("alertsTriggered").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Report = typeof reports.$inferSelect;
export type InsertReport = typeof reports.$inferInsert;

// ─── Report Schedule ──────────────────────────────────────────────────────────
export const reportSchedule = mysqlTable("report_schedule", {
  id: int("id").autoincrement().primaryKey(),
  frequency: mysqlEnum("frequency", ["daily", "weekly"]).notNull().unique(),
  dailyHourUtc: int("dailyHourUtc").default(0).notNull(),
  weeklyDayOfWeek: int("weeklyDayOfWeek").default(1),
  isActive: boolean("isActive").default(true).notNull(),
  lastRunAt: timestamp("lastRunAt"),
  nextRunAt: timestamp("nextRunAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReportSchedule = typeof reportSchedule.$inferSelect;
export type InsertReportSchedule = typeof reportSchedule.$inferInsert;

// ─── Sync Log ─────────────────────────────────────────────────────────────────
export const syncLog = mysqlTable("sync_log", {
  id: int("id").autoincrement().primaryKey(),
  jobType: mysqlEnum("jobType", ["video_discovery", "view_count_snapshot", "report_generation", "alert_check"]).notNull(),
  status: mysqlEnum("status", ["running", "success", "failed"]).notNull(),
  influencerName: varchar("influencerName", { length: 100 }),
  platform: mysqlEnum("platform", ["YouTube", "Instagram", "TikTok"]),
  recordsProcessed: int("recordsProcessed").default(0),
  errorMessage: text("errorMessage"),
  startedAt: timestamp("startedAt").defaultNow().notNull(),
  completedAt: timestamp("completedAt"),
});

export type SyncLog = typeof syncLog.$inferSelect;
export type InsertSyncLog = typeof syncLog.$inferInsert;
