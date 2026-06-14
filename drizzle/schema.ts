import {
  bigint,
  boolean,
  decimal,
  int,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
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
  influencerName: varchar("influencer_name", { length: 100 }),  // nullable — no influencer assignment
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
  isSeen: boolean("isSeen").default(false).notNull(),  // false = newly discovered, unseen by user; true = user has visited Channels page since discovery
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
  manualLikes: bigint("manual_likes", { mode: "number" }),
  manualComments: bigint("manual_comments", { mode: "number" }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (t) => ({
  videoDateUnique: uniqueIndex("view_counts_video_date_unique").on(t.videoId, t.date),
}));

export type ViewCount = typeof viewCounts.$inferSelect;
export type InsertViewCount = typeof viewCounts.$inferInsert;

// ─── Table 3: Shills ──────────────────────────────────────────────────────────
export const shills = mysqlTable("shills", {
  id: int("id").autoincrement().primaryKey(),
  shillId: varchar("shill_id", { length: 100 }).notNull().unique(),
  videoId: varchar("video_id", { length: 100 }).notNull(),
  productBrand: varchar("product_brand", { length: 255 }).notNull(),
  campaignId: int("campaign_id"),
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

// ─── Social Accounts (Instagram + X) ─────────────────────────────────────────
export const socialAccounts = mysqlTable("social_accounts", {
  id: int("id").autoincrement().primaryKey(),
  accountId: varchar("account_id", { length: 255 }).notNull().unique(),
  platform: mysqlEnum("platform", ["Instagram", "X"]).notNull(),
  handle: varchar("handle", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 255 }),
  profileUrl: text("profile_url"),
  thumbnailUrl: text("thumbnail_url"),
  followerCount: bigint("follower_count", { mode: "number" }).default(0),
  postCount: int("post_count").default(0),
  description: text("description"),
  isActive: boolean("isActive").default(true).notNull(),
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type SocialAccount = typeof socialAccounts.$inferSelect;
export type InsertSocialAccount = typeof socialAccounts.$inferInsert;

// ─── Social Posts (Instagram + X) ────────────────────────────────────────────
export const socialPosts = mysqlTable("social_posts", {
  id: int("id").autoincrement().primaryKey(),
  postId: varchar("post_id", { length: 255 }).notNull().unique(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  platform: mysqlEnum("platform", ["Instagram", "X"]).notNull(),
  postUrl: text("post_url").notNull(),
  title: text("title"),
  publishedDate: varchar("published_date", { length: 10 }),
  thumbnailUrl: text("thumbnail_url"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SocialPost = typeof socialPosts.$inferSelect;
export type InsertSocialPost = typeof socialPosts.$inferInsert;

// ─── Social Post Snapshots (append-only daily stats) ─────────────────────────
export const socialPostSnapshots = mysqlTable("social_post_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: varchar("snapshot_id", { length: 150 }).notNull().unique(),
  postId: varchar("post_id", { length: 255 }).notNull(),
  accountId: varchar("account_id", { length: 255 }).notNull(),
  platform: mysqlEnum("platform", ["Instagram", "X"]).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  views: bigint("views", { mode: "number" }).default(0),
  impressions: bigint("impressions", { mode: "number" }).default(0),
  likes: bigint("likes", { mode: "number" }).default(0),
  comments: bigint("comments", { mode: "number" }).default(0),
  shares: bigint("shares", { mode: "number" }).default(0),
  retweets: bigint("retweets", { mode: "number" }).default(0),
  engagementRate: decimal("engagement_rate", { precision: 8, scale: 4 }).default("0"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type SocialPostSnapshot = typeof socialPostSnapshots.$inferSelect;
export type InsertSocialPostSnapshot = typeof socialPostSnapshots.$inferInsert;

// ─── Video Comment Snapshots (scraped daily, no API key needed) ───────────────
export const videoCommentSnapshots = mysqlTable("video_comment_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  snapshotId: varchar("snapshot_id", { length: 150 }).notNull().unique(), // videoId + date
  videoId: varchar("video_id", { length: 100 }).notNull(),
  date: varchar("date", { length: 10 }).notNull(),
  // Video-level stats
  likeCount: bigint("like_count", { mode: "number" }),           // video likes
  commentCount: varchar("comment_count", { length: 30 }),        // e.g. "2,437,584"
  commentCountNum: bigint("comment_count_num", { mode: "number" }), // parsed numeric
  // Top comment
  topCommentId: varchar("top_comment_id", { length: 100 }),
  topCommentAuthor: varchar("top_comment_author", { length: 255 }),
  topCommentText: text("top_comment_text"),
  topCommentLikes: varchar("top_comment_likes", { length: 30 }), // e.g. "239K"
  topCommentLikesNum: bigint("top_comment_likes_num", { mode: "number" }),
  topCommentReplyCount: int("top_comment_reply_count").default(0),
  // Metadata
  scrapeError: text("scrape_error"),
  scrapedAt: bigint("scraped_at", { mode: "number" }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type VideoCommentSnapshot = typeof videoCommentSnapshots.$inferSelect;
export type InsertVideoCommentSnapshot = typeof videoCommentSnapshots.$inferInsert;

// ═══════════════════════════════════════════════════════════════════════════════
// AGENCY MANAGEMENT MODULE
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Clients ──────────────────────────────────────────────────────────────────
export const clients = mysqlTable("clients", {
  id: int("id").autoincrement().primaryKey(),
  companyName: varchar("company_name", { length: 255 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 320 }),
  billingAddress: text("billing_address"),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Client = typeof clients.$inferSelect;
export type InsertClient = typeof clients.$inferInsert;

// ─── Campaigns ────────────────────────────────────────────────────────────────
export const campaigns = mysqlTable("campaigns", {
  id: int("id").autoincrement().primaryKey(),
  clientId: int("client_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  objective: text("objective"),
  budget: decimal("budget", { precision: 12, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  startDate: varchar("start_date", { length: 10 }),
  endDate: varchar("end_date", { length: 10 }),
  status: mysqlEnum("status", ["draft", "active", "paused", "completed", "cancelled"]).default("draft").notNull(),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Campaign = typeof campaigns.$inferSelect;
export type InsertCampaign = typeof campaigns.$inferInsert;

// ─── Campaign Deliverables ────────────────────────────────────────────────────
// A deliverable = one piece of content a Talent must produce for a campaign
export const campaignDeliverables = mysqlTable("campaign_deliverables", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id").notNull(),
  channelId: varchar("channel_id", { length: 100 }),   // FK to youtube_channels.channel_id (nullable)
  talentName: varchar("talent_name", { length: 255 }).notNull(),
  contentType: mysqlEnum("content_type", ["dedicated_video", "integration", "short", "story", "post", "other"]).default("dedicated_video").notNull(),
  dueDate: varchar("due_date", { length: 10 }),
  status: mysqlEnum("status", [
    "brief_sent",
    "script_review",
    "filming",
    "editing",
    "review",
    "published",
    "cancelled",
  ]).default("brief_sent").notNull(),
  agreedFee: decimal("agreed_fee", { precision: 12, scale: 2 }).default("0"),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  videoId: varchar("video_id", { length: 100 }),        // FK to videos.video_id once published
  briefNotes: text("brief_notes"),
  screenshotUrl: text("screenshot_url"),                // optional proof/screenshot URL
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CampaignDeliverable = typeof campaignDeliverables.$inferSelect;
export type InsertCampaignDeliverable = typeof campaignDeliverables.$inferInsert;

// ─── Affiliate Links ──────────────────────────────────────────────────────────
export const affiliateLinks = mysqlTable("affiliate_links", {
  id: int("id").autoincrement().primaryKey(),
  campaignId: int("campaign_id"),                       // nullable — link can exist outside a campaign
  channelId: varchar("channel_id", { length: 100 }),
  talentName: varchar("talent_name", { length: 255 }).notNull(),
  url: text("url").notNull(),
  shortCode: varchar("short_code", { length: 100 }),
  commissionType: mysqlEnum("commission_type", ["flat", "cpc", "cpa", "revenue_share"]).default("flat").notNull(),
  commissionRate: decimal("commission_rate", { precision: 10, scale: 4 }).default("0"),
  notes: text("notes"),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type AffiliateLink = typeof affiliateLinks.$inferSelect;
export type InsertAffiliateLink = typeof affiliateLinks.$inferInsert;

// ─── Affiliate Snapshots (append-only daily performance) ─────────────────────
export const affiliateSnapshots = mysqlTable("affiliate_snapshots", {
  id: int("id").autoincrement().primaryKey(),
  linkId: int("link_id").notNull(),
  snapshotDate: varchar("snapshot_date", { length: 10 }).notNull(),
  clicks: bigint("clicks", { mode: "number" }).default(0),
  conversions: bigint("conversions", { mode: "number" }).default(0),
  revenueGenerated: decimal("revenue_generated", { precision: 12, scale: 2 }).default("0"),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AffiliateSnapshot = typeof affiliateSnapshots.$inferSelect;
export type InsertAffiliateSnapshot = typeof affiliateSnapshots.$inferInsert;

// ─── Invoices ─────────────────────────────────────────────────────────────────
export const invoices = mysqlTable("invoices", {
  id: int("id").autoincrement().primaryKey(),
  invoiceNumber: varchar("invoice_number", { length: 50 }).notNull().unique(), // e.g. INV-2026-001
  clientId: int("client_id").notNull(),
  campaignId: int("campaign_id"),                       // nullable
  status: mysqlEnum("status", ["draft", "sent", "paid", "overdue", "cancelled"]).default("draft").notNull(),
  subtotal: decimal("subtotal", { precision: 12, scale: 2 }).default("0").notNull(),
  taxRate: decimal("tax_rate", { precision: 6, scale: 4 }).default("0"),
  taxAmount: decimal("tax_amount", { precision: 12, scale: 2 }).default("0"),
  total: decimal("total", { precision: 12, scale: 2 }).default("0").notNull(),
  currency: varchar("currency", { length: 10 }).default("USD").notNull(),
  issuedDate: varchar("issued_date", { length: 10 }),
  dueDate: varchar("due_date", { length: 10 }),
  paidDate: varchar("paid_date", { length: 10 }),
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = typeof invoices.$inferInsert;

// ─── Invoice Line Items ───────────────────────────────────────────────────────
export const invoiceLineItems = mysqlTable("invoice_line_items", {
  id: int("id").autoincrement().primaryKey(),
  invoiceId: int("invoice_id").notNull(),
  description: text("description").notNull(),
  quantity: decimal("quantity", { precision: 10, scale: 2 }).default("1").notNull(),
  unitPrice: decimal("unit_price", { precision: 12, scale: 2 }).default("0").notNull(),
  total: decimal("total", { precision: 12, scale: 2 }).default("0").notNull(),
  sortOrder: int("sort_order").default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type InvoiceLineItem = typeof invoiceLineItems.$inferSelect;
export type InsertInvoiceLineItem = typeof invoiceLineItems.$inferInsert;

// ─── Email Templates ──────────────────────────────────────────────────────────
export const emailTemplates = mysqlTable("email_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  type: mysqlEnum("type", ["brief", "invoice", "follow_up", "results", "general"]).default("general").notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyHtml: text("body_html").notNull(),
  variablesUsed: text("variables_used"),               // JSON array of variable names
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type EmailTemplate = typeof emailTemplates.$inferSelect;
export type InsertEmailTemplate = typeof emailTemplates.$inferInsert;

// ─── Email Logs ───────────────────────────────────────────────────────────────
export const emailLogs = mysqlTable("email_logs", {
  id: int("id").autoincrement().primaryKey(),
  templateId: int("template_id"),                      // nullable — can send without template
  recipientEmail: varchar("recipient_email", { length: 320 }).notNull(),
  recipientName: varchar("recipient_name", { length: 255 }),
  recipientType: mysqlEnum("recipient_type", ["client", "talent", "internal"]).default("client").notNull(),
  subject: varchar("subject", { length: 500 }).notNull(),
  bodyHtml: text("body_html"),
  status: mysqlEnum("status", ["queued", "sent", "failed", "bounced"]).default("queued").notNull(),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
  relatedType: varchar("related_type", { length: 50 }),  // "campaign" | "invoice" | "deliverable"
  relatedId: int("related_id"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type EmailLog = typeof emailLogs.$inferSelect;
export type InsertEmailLog = typeof emailLogs.$inferInsert;

// ─── Talent Results ───────────────────────────────────────────────────────────
// Locked post-campaign performance snapshot per deliverable
export const talentResults = mysqlTable("talent_results", {
  id: int("id").autoincrement().primaryKey(),
  deliverableId: int("deliverable_id").notNull().unique(), // one result per deliverable
  reportingWindowDays: int("reporting_window_days").default(30),
  views: bigint("views", { mode: "number" }).default(0),
  likes: bigint("likes", { mode: "number" }).default(0),
  comments: bigint("comments", { mode: "number" }).default(0),
  shares: bigint("shares", { mode: "number" }).default(0),
  reach: bigint("reach", { mode: "number" }).default(0),
  impressions: bigint("impressions", { mode: "number" }).default(0),
  engagementRate: decimal("engagement_rate", { precision: 8, scale: 4 }).default("0"),
  linkClicks: bigint("link_clicks", { mode: "number" }).default(0),
  lockedAt: timestamp("locked_at"),                    // null = draft, non-null = locked/final
  notes: text("notes"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type TalentResult = typeof talentResults.$inferSelect;
export type InsertTalentResult = typeof talentResults.$inferInsert;
