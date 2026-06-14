import { TRPCError } from "@trpc/server";
import { nanoid } from "nanoid";
import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  createInfluencer,
  deleteAlertThreshold,
  deleteChannel,
  deleteCredential,
  deleteInfluencer,
  deleteShill,
  deleteVideo,
  getAllAlertThresholds,
  getAllChannels,
  getAllCredentials,
  getAllInfluencers,
  getAllPlatformAccounts,
  getAllReports,
  deleteReport,
  getAllShills,
  getAllVideos,
  getAllViewCounts,
  getAlertEvents,
  getAvgEngagementRate,
  getChannelById,
  getChannelsByInfluencer,
  getInfluencerById,
  getPlatformAccountsByInfluencer,
  getRecentSyncLogs,
  getReportById,
  getReportSchedules,
  getShillBrandSummary,
  getTotalViewsAllTime,
  getUnreadAlertCount,
  getVideoByVideoId,
  getVideoStats,
  getVideosByChannelId,
  getVideosByChannelIdPaginated,
  getViewCountTrends,
  getViewCountsByVideoId,
  getLatestViewCountByVideoId,
  insertAlertThreshold,
  insertShill,
  insertVideo,
  insertViewCount,
  markAlertRead,
  updateAlertThreshold,
  updateChannelLastChecked,
  updateInfluencer,
  updateReportSchedule,
  updateShill,
  updateVideo,
  upsertChannel,
  upsertCredential,
  upsertPlatformAccount,
  upsertSocialAccount,
  upsertSocialPost,
  insertSocialPostSnapshot,
  updateSocialAccountLastChecked,
  getAllSocialAccounts,
  getSocialAccountById,
  deleteSocialAccount,
  getCredentialByKey,
  getShillCountByVideoId,
  insertViewCountPreserveScrape,
} from "./db";
import {
  generateDailyReport,
  generateWeeklyReport,
  runFullDailySync,
  runVideoDiscovery,
  runChannelSync,
  runViewCountSnapshot,
} from "./syncEngine";
import { extractYouTubeVideoId, fetchYouTubeVideoInfo } from "./platformApi";
import {
  fetchChannelUploads,
  fetchVideoStatsV3,
  fetchChannelStatsV3,
  resolveChannel,
  toDbVideoId,
} from "./channelEngine";
import { ENV } from "./_core/env";
import { createHeartbeatJob, deleteHeartbeatJob, listHeartbeatJobs } from "./_core/heartbeat";
import { parse as parseCookie } from "cookie";
import { updateVideoMeta, upsertCommentSnapshot, getLatestCommentSnapshot, getLatestCommentSnapshotsBulk } from "./db";
import { scrapeVideoComments, scrapeVideoBatch } from "./commentEngine";

// ─── In-memory bulk scrape job store ─────────────────────────────────────────
interface BulkScrapeJob {
  jobId: string;
  status: "idle" | "running" | "done" | "error";
  total: number;
  done: number;
  skipped: number;
  currentVideoId: string | null;
  errors: Array<{ videoId: string; error: string }>;
  results: Array<{ videoId: string; status: "scraped" | "skipped" | "error"; likeCount?: number | null; commentCount?: string | null }>;
  startedAt: number;
  finishedAt: number | null;
}

// Singleton job state — only one bulk scrape can run at a time
let _bulkJob: BulkScrapeJob | null = null;
function getBulkJob(): BulkScrapeJob {
  if (!_bulkJob) {
    _bulkJob = { jobId: "", status: "idle", total: 0, done: 0, skipped: 0, currentVideoId: null, errors: [], results: [], startedAt: 0, finishedAt: null };
  }
  return _bulkJob!;
}

/**
 * Returns true if a video already has a complete scrape snapshot for today:
 * - snapshot exists for today's date
 * - no scrapeError
 * - likeCount is non-null (meaning likes were actually fetched)
 */
function isCompleteToday(snapshot: { date: string; scrapeError: string | null; likeCount: number | null } | undefined, today: string): boolean {
  if (!snapshot) return false;
  if (snapshot.date !== today) return false;
  if (snapshot.scrapeError) return false;
  if (snapshot.likeCount == null) return false;
  return true;
}

// ─── Per-channel scrape job store ────────────────────────────────────────────
interface ChannelScrapeJob {
  jobId: string;
  channelId: string;
  status: "idle" | "running" | "done" | "error";
  total: number;
  done: number;
  skipped: number;
  currentVideoId: string | null;
  errors: Array<{ videoId: string; error: string }>;
  results: Array<{ videoId: string; status: "scraped" | "skipped" | "error"; likeCount?: number | null; commentCount?: string | null }>;
  startedAt: number;
  finishedAt: number | null;
}
// Map: channelId -> job state
const _channelScrapeJobs = new Map<string, ChannelScrapeJob>();
function getChannelScrapeJob(channelId: string): ChannelScrapeJob {
  if (!_channelScrapeJobs.has(channelId)) {
    _channelScrapeJobs.set(channelId, { jobId: "", channelId, status: "idle", total: 0, done: 0, skipped: 0, currentVideoId: null, errors: [], results: [], startedAt: 0, finishedAt: null });
  }
  return _channelScrapeJobs.get(channelId)!;
}

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

// ─── Influencers Router ───────────────────────────────────────────────────────
const influencersRouter = router({
  list: protectedProcedure.query(() => getAllInfluencers()),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(({ input }) => getInfluencerById(input.id)),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), bio: z.string().optional(), avatarUrl: z.string().optional() }))
    .mutation(async ({ input }) => {
      await createInfluencer({ name: input.name, bio: input.bio, avatarUrl: input.avatarUrl });
      return { success: true };
    }),

  update: protectedProcedure
    .input(z.object({ id: z.number(), name: z.string().optional(), bio: z.string().optional(), avatarUrl: z.string().optional(), isActive: z.boolean().optional() }))
    .mutation(async ({ input }) => {
      const { id, ...data } = input;
      await updateInfluencer(id, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteInfluencer(input.id);
      return { success: true };
    }),

  getPlatformAccounts: protectedProcedure
    .input(z.object({ influencerId: z.number() }))
    .query(({ input }) => getPlatformAccountsByInfluencer(input.influencerId)),

  upsertPlatformAccount: protectedProcedure
    .input(z.object({
      id: z.number().optional(),
      influencerId: z.number(),
      platform: z.enum(["YouTube", "Instagram", "TikTok"]),
      channelId: z.string().optional(),
      channelUrl: z.string().optional(),
      username: z.string().optional(),
      credentialKey: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      await upsertPlatformAccount(input);
      return { success: true };
    }),
});

// ─── Videos Router ────────────────────────────────────────────────────────────
const videosRouter = router({
  list: protectedProcedure
    .input(z.object({
      influencerName: z.string().optional(),
      platform: z.string().optional(),
      dateFrom: z.string().optional(),
      dateTo: z.string().optional(),
      channelId: z.string().optional(),
    }).optional())
    .query(({ input }) => getAllVideos(input)),

  getById: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(({ input }) => getVideoByVideoId(input.videoId)),

  // Fetch YouTube video info by URL without any API key
  fetchYouTubeInfo: protectedProcedure
    .input(z.object({ url: z.string() }))
    .query(async ({ input }) => {
      const rawId = extractYouTubeVideoId(input.url);
      if (!rawId) return null;
      const result = await fetchYouTubeVideoInfo(input.url);
      return result ?? null;
    }),

  create: protectedProcedure
    .input(z.object({
      influencerName: z.string().min(1),
      platform: z.enum(["YouTube", "Instagram", "TikTok"]),
      videoUrl: z.string().url(),
      title: z.string().min(1),
      publishedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      thumbnailUrl: z.string().optional(),
      durationSeconds: z.number().optional(),
    }))
    .mutation(async ({ input }) => {
      // For YouTube: derive the canonical video ID from the URL
      let videoId: string;
      if (input.platform === "YouTube") {
        const rawId = extractYouTubeVideoId(input.videoUrl);
        videoId = rawId ? `yt_${rawId}` : `manual_${nanoid(10)}`;
      } else {
        videoId = `manual_${nanoid(10)}`;
      }
      await insertVideo({
        videoId,
        influencerName: input.influencerName,
        platform: input.platform,
        videoUrl: input.videoUrl,
        title: input.title,
        publishedDate: input.publishedDate,
        dateAdded: todayStr(),
        thumbnailUrl: input.thumbnailUrl,
        durationSeconds: input.durationSeconds,
      });
      return { success: true, videoId };
    }),

  update: protectedProcedure
    .input(z.object({
      videoId: z.string(),
      title: z.string().optional(),
      thumbnailUrl: z.string().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { videoId, ...data } = input;
      await updateVideo(videoId, data);
      return { success: true };
    }),

  delete: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .mutation(async ({ input }) => {
      await deleteVideo(input.videoId);
      return { success: true };
    }),

  getViewCounts: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(({ input }) => getViewCountsByVideoId(input.videoId)),

  stats: protectedProcedure.query(() => getVideoStats()),

  updateManualStats: protectedProcedure
    .input(z.object({
      videoId: z.string(),
      likes: z.number().int().min(0).nullable(),
      comments: z.number().int().min(0).nullable(),
    }))
    .mutation(async ({ input }) => {
      const existing = await getViewCountsByVideoId(input.videoId);
      const today = todayStr();
      // Find today's row if it exists
      const todayRow = existing.find((r) => r.date === today);
      const latestRow = existing.length > 0 ? existing[existing.length - 1] : null;

      if (todayRow) {
        // Update today's row — preserve auto-fetched viewCount, update manual fields
        await insertViewCount({
          countId: todayRow.countId,
          videoId: input.videoId,
          date: today,
          viewCount: todayRow.viewCount,
          likes: todayRow.likes ?? 0,
          comments: todayRow.comments ?? 0,
          shares: todayRow.shares ?? 0,
          engagementRate: todayRow.engagementRate ?? "0",
          manualLikes: input.likes !== null ? input.likes : todayRow.manualLikes,
          manualComments: input.comments !== null ? input.comments : todayRow.manualComments,
        });
      } else {
        // No row for today — create one, copying viewCount from latest if available
        await insertViewCount({
          countId: `manual_${input.videoId}_${today}`,
          videoId: input.videoId,
          date: today,
          viewCount: latestRow?.viewCount ?? 0,
          likes: latestRow?.likes ?? 0,
          comments: latestRow?.comments ?? 0,
          shares: 0,
          engagementRate: "0",
          manualLikes: input.likes !== null ? input.likes : undefined,
          manualComments: input.comments !== null ? input.comments : undefined,
        });
      }
      return { success: true };
    }),

  // Get latest comment snapshot for a video
  getCommentData: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ input }) => {
      return getLatestCommentSnapshot(input.videoId);
    }),

  // Get comment snapshots for multiple videos at once
  getCommentDataBulk: protectedProcedure
    .input(z.object({ videoIds: z.array(z.string()) }))
    .query(async ({ input }) => {
      if (input.videoIds.length === 0) return {};
      return getLatestCommentSnapshotsBulk(input.videoIds);
    }),

  // Start a background bulk scrape for all YouTube videos
  startBulkScrape: protectedProcedure
    .mutation(async () => {
      const job = getBulkJob();
      if (job.status === "running") {
        return { jobId: job.jobId, alreadyRunning: true };
      }

      // Fetch all YouTube video IDs
      const allVideos = await getAllVideos();
      const ytVideos = allVideos.filter((v: any) =>
        typeof v.videoId === "string" && v.videoId.startsWith("yt_")
      );
      const rawIds = ytVideos.map((v: any) => (v.videoId as string).replace(/^yt_/, ""));

      const jobId = nanoid(8);
      _bulkJob = {
        jobId,
        status: "running",
        total: rawIds.length,
        done: 0,
        skipped: 0,
        currentVideoId: null,
        errors: [],
        results: [],
        startedAt: Date.now(),
        finishedAt: null,
      };

      // Fire-and-forget background processing
      (async () => {
        const today = todayStr();
        // Pre-fetch all existing snapshots in one query to decide which to skip
        const dbVideoIds = rawIds.map((id) => `yt_${id}`);
        const existingSnapshots = await getLatestCommentSnapshotsBulk(dbVideoIds);
        for (const rawId of rawIds) {
          if (!_bulkJob || _bulkJob.jobId !== jobId) break; // cancelled
          const dbVideoId = `yt_${rawId}`;
          // Skip if already scraped successfully today
          if (isCompleteToday(existingSnapshots[dbVideoId] as any, today)) {
            _bulkJob.results.push({ videoId: rawId, status: "skipped" });
            _bulkJob.skipped++;
            _bulkJob.done++;
            continue;
          }
          _bulkJob.currentVideoId = rawId;
          try {
            const result = await scrapeVideoComments(rawId);
            await upsertCommentSnapshot({
              videoId: dbVideoId,
              date: today,
              likeCount: result.likeCount,
              commentCount: result.commentCount,
              commentCountNum: result.commentCountNum,
              topCommentId: result.topComment?.commentId,
              topCommentAuthor: result.topComment?.author,
              topCommentText: result.topComment?.text,
              topCommentLikes: result.topComment?.likeCount,
              topCommentLikesNum: result.topComment?.likeCountNum,
              topCommentReplyCount: result.topComment?.replyCount ?? 0,
              scrapeError: result.error ?? null,
              scrapedAt: result.scrapedAt,
            });
            // Auto-fill scraped likes/comments into view_counts for today.
            // Use PreserveScrape so we never zero-out viewCount already written by sync.
            if (!result.error && (result.likeCount != null || result.commentCountNum != null)) {
              const countId = `vc_${dbVideoId}_${today}`;
              const existingVc = await getLatestViewCountByVideoId(dbVideoId);
              await insertViewCountPreserveScrape({
                countId,
                videoId: dbVideoId,
                date: today,
                viewCount: existingVc?.viewCount ?? 0,
                likes: result.likeCount ?? existingVc?.likes ?? 0,
                comments: result.commentCountNum ?? existingVc?.comments ?? 0,
                shares: existingVc?.shares ?? 0,
                engagementRate: existingVc?.engagementRate ?? "0",
              });
            }
            if (result.error) {
              _bulkJob.errors.push({ videoId: rawId, error: result.error });
              _bulkJob.results.push({ videoId: rawId, status: "error" });
            } else {
              _bulkJob.results.push({ videoId: rawId, status: "scraped", likeCount: result.likeCount, commentCount: result.commentCount });
            }
          } catch (e: any) {
            _bulkJob.errors.push({ videoId: rawId, error: e?.message ?? "Unknown error" });
            _bulkJob.results.push({ videoId: rawId, status: "error" });
          }
          _bulkJob.done++;
          // Polite delay between requests
          await new Promise((r) => setTimeout(r, 1200));
        }
        if (_bulkJob && _bulkJob.jobId === jobId) {
          _bulkJob.status = "done";
          _bulkJob.currentVideoId = null;
          _bulkJob.finishedAt = Date.now();
        }
      })().catch((e) => {
        if (_bulkJob && _bulkJob.jobId === jobId) {
          _bulkJob.status = "error";
          _bulkJob.finishedAt = Date.now();
        }
      });

      return { jobId, alreadyRunning: false };
    }),

  // Poll bulk scrape job status
  bulkScrapeStatus: protectedProcedure
    .query(() => {
      const job = getBulkJob();
      return {
        status: job.status,
        total: job.total,
        done: job.done,
        skipped: job.skipped,
        currentVideoId: job.currentVideoId,
        errors: job.errors,
        // Return last 20 results to avoid oversized payloads
        recentResults: job.results.slice(-20),
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        percent: job.total > 0 ? Math.round((job.done / job.total) * 100) : 0,
      };
    }),

  // Manually trigger comment scrape for a single video
  scrapeComments: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .mutation(async ({ input }) => {
      const rawId = input.videoId.replace(/^yt_/, "");
      const result = await scrapeVideoComments(rawId);
      const today = todayStr();
      await upsertCommentSnapshot({
        videoId: input.videoId,
        date: today,
        likeCount: result.likeCount,
        commentCount: result.commentCount,
        commentCountNum: result.commentCountNum,
        topCommentId: result.topComment?.commentId,
        topCommentAuthor: result.topComment?.author,
        topCommentText: result.topComment?.text,
        topCommentLikes: result.topComment?.likeCount,
        topCommentLikesNum: result.topComment?.likeCountNum,
        topCommentReplyCount: result.topComment?.replyCount ?? 0,
        scrapeError: result.error,
        scrapedAt: result.scrapedAt,
      });
      // Auto-fill scraped likes/comments into view_counts for today.
      // Use PreserveScrape so we never zero-out viewCount already written by sync.
      if (!result.error && (result.likeCount != null || result.commentCountNum != null)) {
        const countId = `vc_${input.videoId}_${today}`;
        const existingVc = await getLatestViewCountByVideoId(input.videoId);
        await insertViewCountPreserveScrape({
          countId,
          videoId: input.videoId,
          date: today,
          viewCount: existingVc?.viewCount ?? 0,
          likes: result.likeCount ?? existingVc?.likes ?? 0,
          comments: result.commentCountNum ?? existingVc?.comments ?? 0,
          shares: existingVc?.shares ?? 0,
          engagementRate: existingVc?.engagementRate ?? "0",
        });
      }
      return { success: true, result };
    }),

  /** Start a background scrape for all videos in a specific channel. */
  startChannelScrape: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ input }) => {
      const job = getChannelScrapeJob(input.channelId);
      if (job.status === "running") {
        return { jobId: job.jobId, alreadyRunning: true };
      }
      // Fetch all videos for this channel
      const channelVideos = await getVideosByChannelId(input.channelId);
      const ytVideos = channelVideos.filter((v: any) =>
        typeof v.videoId === "string" && v.videoId.startsWith("yt_")
      );
      const rawIds = ytVideos.map((v: any) => (v.videoId as string).replace(/^yt_/, ""));
      const jobId = nanoid(8);
      const newJob: ChannelScrapeJob = {
        jobId,
        channelId: input.channelId,
        status: "running",
        total: rawIds.length,
        done: 0,
        skipped: 0,
        currentVideoId: null,
        errors: [],
        results: [],
        startedAt: Date.now(),
        finishedAt: null,
      };
      _channelScrapeJobs.set(input.channelId, newJob);
      // Fire-and-forget background processing
      (async () => {
        const today = todayStr();
        // Pre-fetch all existing snapshots in one query to decide which to skip
        const dbVideoIds = rawIds.map((id) => `yt_${id}`);
        const existingSnapshots = await getLatestCommentSnapshotsBulk(dbVideoIds);
        for (const rawId of rawIds) {
          const current = _channelScrapeJobs.get(input.channelId);
          if (!current || current.jobId !== jobId) break; // cancelled or replaced
          const dbVideoId = `yt_${rawId}`;
          // Skip if already scraped successfully today
          if (isCompleteToday(existingSnapshots[dbVideoId] as any, today)) {
            current.results.push({ videoId: rawId, status: "skipped" });
            current.skipped++;
            current.done++;
            continue;
          }
          current.currentVideoId = rawId;
          try {
            const result = await scrapeVideoComments(rawId);
            await upsertCommentSnapshot({
              videoId: dbVideoId,
              date: today,
              likeCount: result.likeCount,
              commentCount: result.commentCount,
              commentCountNum: result.commentCountNum,
              topCommentId: result.topComment?.commentId,
              topCommentAuthor: result.topComment?.author,
              topCommentText: result.topComment?.text,
              topCommentLikes: result.topComment?.likeCount,
              topCommentLikesNum: result.topComment?.likeCountNum,
              topCommentReplyCount: result.topComment?.replyCount ?? 0,
              scrapeError: result.error ?? null,
              scrapedAt: result.scrapedAt,
            });
            // Auto-fill scraped likes/comments into view_counts for today.
            // Use PreserveScrape so we never zero-out viewCount already written by sync.
            if (!result.error && (result.likeCount != null || result.commentCountNum != null)) {
              const countId = `vc_${dbVideoId}_${today}`;
              const existingVc = await getLatestViewCountByVideoId(dbVideoId);
              await insertViewCountPreserveScrape({
                countId,
                videoId: dbVideoId,
                date: today,
                viewCount: existingVc?.viewCount ?? 0,
                likes: result.likeCount ?? existingVc?.likes ?? 0,
                comments: result.commentCountNum ?? existingVc?.comments ?? 0,
                shares: existingVc?.shares ?? 0,
                engagementRate: existingVc?.engagementRate ?? "0",
              });
            }
            if (result.error) {
              current.errors.push({ videoId: rawId, error: result.error });
              current.results.push({ videoId: rawId, status: "error" });
            } else {
              current.results.push({ videoId: rawId, status: "scraped", likeCount: result.likeCount, commentCount: result.commentCount });
            }
          } catch (e: any) {
            current.errors.push({ videoId: rawId, error: e?.message ?? "Unknown error" });
            current.results.push({ videoId: rawId, status: "error" });
          }
          current.done++;
          await new Promise((r) => setTimeout(r, 1200));
        }
        const finalJob = _channelScrapeJobs.get(input.channelId);
        if (finalJob && finalJob.jobId === jobId) {
          finalJob.status = "done";
          finalJob.currentVideoId = null;
          finalJob.finishedAt = Date.now();
        }
      })().catch(() => {
        const finalJob = _channelScrapeJobs.get(input.channelId);
        if (finalJob && finalJob.jobId === jobId) {
          finalJob.status = "error";
          finalJob.finishedAt = Date.now();
        }
      });
      return { jobId, alreadyRunning: false, total: rawIds.length };
    }),

  /** Poll per-channel scrape job status. */
  channelScrapeStatus: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .query(({ input }) => {
      const job = getChannelScrapeJob(input.channelId);
      return {
        status: job.status,
        total: job.total,
        done: job.done,
        skipped: job.skipped,
        currentVideoId: job.currentVideoId,
        errors: job.errors,
        recentResults: job.results.slice(-10),
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        percent: job.total > 0 ? Math.round((job.done / job.total) * 100) : 0,
      };
    }),
  /** List videos for a channel enriched with latest likes/comments/top-comment and linked campaign deliverable. */
  listEnriched: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(30),
      search: z.string().optional(),
    }))
    .query(async ({ input }) => {
      const { getDb: _getDb } = await import("./db");
      const { videos: vTable, viewCounts: vcTable, videoCommentSnapshots: vcsTable, campaignDeliverables: cdTable, campaigns: cTable } = await import("../drizzle/schema");
      const { and: _and, eq: _eq, desc: _desc, like: _like, or: _or, sql: _sql } = await import("drizzle-orm");
      const db = await _getDb();
      if (!db) return { videos: [], total: 0 };
      const conditions: any[] = [_eq(vTable.channelId, input.channelId), _eq(vTable.isActive, true)];
      if (input.search) conditions.push(_like(vTable.title, `%${input.search}%`));
      const offset = (input.page - 1) * input.limit;
      // Get total count
      const countRows = await db.select({ count: _sql<number>`COUNT(*)` }).from(vTable).where(_and(...conditions));
      const total = Number(countRows[0]?.count ?? 0);
      // Get paginated videos
      const videoRows = await db.select().from(vTable).where(_and(...conditions)).orderBy(_desc(vTable.publishedDate)).limit(input.limit).offset(offset);
      if (videoRows.length === 0) return { videos: [], total };
      const videoIds: string[] = videoRows.map((v: any) => v.videoId as string);
      // Bulk fetch latest view counts
      const { getLatestViewCountsBulk: getVcBulk, getLatestCommentSnapshotsBulk: getCsBulk } = await import("./db");
      const [vcMap, csMap] = await Promise.all([
        getVcBulk(videoIds),
        getCsBulk(videoIds),
      ]);
      // Bulk fetch linked campaign deliverables (where video_id matches)
      const cdRows = await db
        .select({ id: cdTable.id, videoId: cdTable.videoId, status: cdTable.status, campaignId: cdTable.campaignId, campaignName: cTable.name, contentType: cdTable.contentType })
        .from(cdTable)
        .leftJoin(cTable, _eq(cdTable.campaignId, cTable.id))
        .where(_and(
          _sql`${cdTable.videoId} IN (${_sql.join(videoIds.map((id: string) => _sql`${id}`), _sql`, `)})`
        ));
      const cdByVideoId: Record<string, typeof cdRows[0]> = {};
      for (const row of cdRows) {
        if (row.videoId && !cdByVideoId[row.videoId]) cdByVideoId[row.videoId] = row;
      }
      const enriched = (videoRows as any[]).map((v: any) => {
        const vc = vcMap[v.videoId];
        const cs = csMap[v.videoId];
        const cd = cdByVideoId[v.videoId];
        return {
          ...v,
          latestViews: vc?.viewCount ?? 0,
          latestLikes: vc?.manualLikes ?? vc?.likes ?? cs?.likeCount ?? 0,
          latestComments: vc?.manualComments ?? vc?.comments ?? (cs?.commentCountNum ?? 0),
          topCommentAuthor: cs?.topCommentAuthor ?? null,
          topCommentText: cs?.topCommentText ?? null,
          topCommentLikes: cs?.topCommentLikesNum ?? null,
          linkedDeliverable: cd ? { id: cd.id, campaignId: cd.campaignId, campaignName: cd.campaignName, status: cd.status, contentType: cd.contentType } : null,
        };
      });
      return { videos: enriched, total };
    }),
});
// ─── Analytics Routerr ─────────────────────────────────────────────────────────
const analyticsRouter = router({
  trends: protectedProcedure
    .input(z.object({ days: z.number().min(1).max(365).default(30) }))
    .query(({ input }) => getViewCountTrends(input.days)),

  kpis: protectedProcedure.query(async () => {
    const [stats, totalViews, avgEng, alertCount] = await Promise.all([
      getVideoStats(),
      getTotalViewsAllTime(),
      getAvgEngagementRate(),
      getUnreadAlertCount(),
    ]);
    return {
      totalVideos: stats.total,
      totalViews,
      avgEngagementRate: Number(avgEng).toFixed(2),
      unreadAlerts: alertCount,
      byInfluencer: stats.byInfluencer,
      byPlatform: stats.byPlatform,
    };
  }),

  /** Returns all data needed to build the Dashboard Excel export. */
  exportStats: protectedProcedure
    .input(z.object({
      dateFrom: z.string().optional(),  // ISO date string e.g. "2026-01-01"
      dateTo:   z.string().optional(),  // ISO date string e.g. "2026-05-14"
    }).optional())
    .query(async ({ input }) => {
    const dateFrom = input?.dateFrom;
    const dateTo   = input?.dateTo;
    const [allVideos, allViewCounts, allShills, allChannels, stats, totalViews, avgEng, allReports] = await Promise.all([
      getAllVideos(dateFrom || dateTo ? { dateFrom, dateTo } : undefined),
      getAllViewCounts({ dateFrom, dateTo }),
      getAllShills(),
      getAllChannels(),
      getVideoStats(),
      getTotalViewsAllTime(),
      getAvgEngagementRate(),
      getAllReports(10),
    ]);

    // Aggregate per-channel stats for the Summary sheet
    // Use latest view_count row per video to avoid double-counting multi-day snapshots
    const latestByVideo = new Map<string, typeof allViewCounts[number]>();
    for (const vc of allViewCounts) {
      const existing = latestByVideo.get(vc.videoId);
      if (!existing || vc.date > existing.date) latestByVideo.set(vc.videoId, vc);
    }
    const channelStatsMap = new Map<string, { totalViews: number; totalLikes: number; totalComments: number; totalSponsors: number }>();
    for (const v of allVideos) {
      const key = v.influencerName ?? "Unknown";
      if (!channelStatsMap.has(key)) channelStatsMap.set(key, { totalViews: 0, totalLikes: 0, totalComments: 0, totalSponsors: 0 });
      const vc = latestByVideo.get(v.videoId);
      if (vc) {
        const entry = channelStatsMap.get(key)!;
        entry.totalViews += Number(vc.viewCount ?? 0);
        entry.totalLikes += Number(vc.likes ?? 0);
        entry.totalComments += Number(vc.comments ?? 0);
      }
    }
    for (const s of allShills) {
      const key = s.influencerName ?? "Unknown";
      if (!channelStatsMap.has(key)) channelStatsMap.set(key, { totalViews: 0, totalLikes: 0, totalComments: 0, totalSponsors: 0 });
      channelStatsMap.get(key)!.totalSponsors++;
    }
    const channelStats = Array.from(channelStatsMap.entries()).map(([channelName, cs]) => ({ channelName, ...cs }));

    // Enrich each video with its latest view count stats for use in Top Videos / All Videos sheets
    const enrichedVideos = allVideos.map((v) => {
      const vc = latestByVideo.get(v.videoId);
      return {
        ...v,
        viewCount: vc ? Number(vc.viewCount ?? 0) : 0,
        likes: vc ? Number(vc.likes ?? 0) : 0,
        comments: vc ? Number(vc.comments ?? 0) : 0,
      };
    });

    return {
      exportedAt: new Date().toISOString(),
      summary: {
        totalVideos: stats.total,
        totalViews,
        avgEngagementRate: Number(avgEng).toFixed(2),
        totalChannels: allChannels.length,
        totalSponsorships: allShills.length,
        byInfluencer: stats.byInfluencer,
        byPlatform: stats.byPlatform,
        channelStats,
      },
      videos: enrichedVideos,
      viewCounts: allViewCounts,
      sponsorships: allShills,
      channels: allChannels,
      reports: allReports,
    };
  }),
});
// ─── Shills Routerr ────────────────────────────────────────────────────────────
const shillsRouter = router({
  list: protectedProcedure
    .input(z.object({ videoId: z.string().optional(), brand: z.string().optional() }).optional())
    .query(({ input }) => getAllShills(input)),
  listByVideo: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(async ({ input }) => {
      const rows = await getAllShills({ videoId: input.videoId });
      return rows;
    }),
  brandSummary: protectedProcedure.query(() => getShillBrandSummary()),
  create: protectedProcedure
    .input(z.object({
      videoId: z.string(),
      productBrand: z.string().min(1),
      campaignId: z.number().int().optional().nullable(),
      timestamp: z.string().regex(/^\d{1,2}:\d{2}$/),
      lengthSeconds: z.number().int().positive(),
      promoType: z.string().min(1),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      await insertShill({
        shillId: `shl_${nanoid(10)}`,
        videoId: input.videoId,
        productBrand: input.productBrand,
        campaignId: input.campaignId ?? null,
        timestamp: input.timestamp,
        lengthSeconds: input.lengthSeconds,
        promoType: input.promoType,
        notes: input.notes,
      });
      return { success: true };
    }),
  update: protectedProcedure
    .input(z.object({
      shillId: z.string(),
      productBrand: z.string().optional(),
      campaignId: z.number().int().optional().nullable(),
      timestamp: z.string().optional(),
      lengthSeconds: z.number().optional(),
      promoType: z.string().optional(),
      notes: z.string().optional(),
    }))
    .mutation(async ({ input }) => {
      const { shillId, ...data } = input;
      await updateShill(shillId, data);
      return { success: true };
    }),
  delete: protectedProcedure
    .input(z.object({ shillId: z.string() }))
    .mutation(async ({ input }) => {
      await deleteShill(input.shillId);
      return { success: true };
    }),
  // Lightweight count query — always enabled, used to show shill badge in VideoRow without loading full list
  countByVideo: protectedProcedure
    .input(z.object({ videoId: z.string() }))
    .query(({ input }) => getShillCountByVideoId(input.videoId)),
});

// ─── Admin Router ─────────────────────────────────────────────────────────────
const adminRouter = router({
  // Credentials
  listCredentials: protectedProcedure.query(() => getAllCredentials()),

  upsertCredential: protectedProcedure
    .input(z.object({
      platform: z.enum(["YouTube", "Instagram", "TikTok"]),
      label: z.string().min(1),
      credentialKey: z.string().min(1),
      credentialValue: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      await upsertCredential(input);
      return { success: true };
    }),

  deleteCredential: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteCredential(input.id);
      return { success: true };
    }),

  // Alert Thresholds
  listThresholds: protectedProcedure.query(() => getAllAlertThresholds()),

  createThreshold: protectedProcedure
    .input(z.object({
      name: z.string().min(1),
      metric: z.enum(["view_count", "view_growth_rate", "engagement_rate", "likes", "comments", "shares"]),
      operator: z.enum(["gt", "lt", "gte", "lte"]),
      thresholdValue: z.number(),
      influencerName: z.string().optional(),
      platform: z.enum(["YouTube", "Instagram", "TikTok"]).optional(),
      alertType: z.enum(["viral", "underperforming", "custom"]).default("custom"),
    }))
    .mutation(async ({ input }) => {
      await insertAlertThreshold({ ...input, thresholdValue: String(input.thresholdValue) });
      return { success: true };
    }),

  updateThreshold: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      thresholdValue: z.number().optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { id, thresholdValue, ...rest } = input;
      await updateAlertThreshold(id, { ...rest, ...(thresholdValue !== undefined ? { thresholdValue: String(thresholdValue) } : {}) });
      return { success: true };
    }),

  deleteThreshold: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteAlertThreshold(input.id);
      return { success: true };
    }),

  // Report Schedules
  listSchedules: protectedProcedure.query(() => getReportSchedules()),

  updateSchedule: protectedProcedure
    .input(z.object({
      frequency: z.enum(["daily", "weekly"]),
      dailyHourUtc: z.number().min(0).max(23).optional(),
      weeklyDayOfWeek: z.number().min(0).max(6).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input }) => {
      const { frequency, ...data } = input;
      await updateReportSchedule(frequency, data);
      return { success: true };
    }),

  // API Key Status (for the new API Keys tab)
  getApiKeyStatus: protectedProcedure.query(async () => {
    const ytKey = ENV.youtubeApiKey || (await getCredentialByKey("youtube_api_key"))?.credentialValue;
    const igToken = ENV.instagramAccessToken || (await getCredentialByKey("instagram_access_token"))?.credentialValue;
    const twToken = ENV.twitterBearerToken || (await getCredentialByKey("twitter_bearer_token"))?.credentialValue;
    return {
      youtube: { configured: !!ytKey, source: ENV.youtubeApiKey ? "env" : ytKey ? "db" : "none" },
      instagram: { configured: !!igToken, source: ENV.instagramAccessToken ? "env" : igToken ? "db" : "none" },
      twitter: { configured: !!twToken, source: ENV.twitterBearerToken ? "env" : twToken ? "db" : "none" },
    };
  }),

  saveApiKey: protectedProcedure
    .input(z.object({
      service: z.enum(["youtube", "instagram", "twitter"]),
      value: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const keyMap = {
        youtube: { credentialKey: "youtube_api_key", platform: "YouTube" as const, label: "YouTube Data API v3 Key" },
        instagram: { credentialKey: "instagram_access_token", platform: "Instagram" as const, label: "Instagram Graph API Access Token" },
        twitter: { credentialKey: "twitter_bearer_token", platform: "Instagram" as const, label: "Twitter/X API v2 Bearer Token" },
      };
      const meta = keyMap[input.service];
      await upsertCredential({ ...meta, credentialValue: input.value, isActive: true });
      return { success: true };
    }),

  removeApiKey: protectedProcedure
    .input(z.object({ service: z.enum(["youtube", "instagram", "twitter"]) }))
    .mutation(async ({ input }) => {
      const keyMap = { youtube: "youtube_api_key", instagram: "instagram_access_token", twitter: "twitter_bearer_token" };
      const db = await import("./db");
      const cred = await db.getCredentialByKey(keyMap[input.service]);
      if (cred) await db.deleteCredential(cred.id);
      return { success: true };
    }),

  testApiKey: protectedProcedure
    .input(z.object({ service: z.enum(["youtube", "instagram", "twitter"]) }))
    .mutation(async ({ input }) => {
      const keyMap = { youtube: "youtube_api_key", instagram: "instagram_access_token", twitter: "twitter_bearer_token" };
      const cred = await getCredentialByKey(keyMap[input.service]);
      const key = (input.service === "youtube" ? ENV.youtubeApiKey : input.service === "instagram" ? ENV.instagramAccessToken : ENV.twitterBearerToken) || cred?.credentialValue;
      if (!key) return { success: false, message: "No API key configured" };
      try {
        if (input.service === "youtube") {
          const r = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=id&id=dQw4w9WgXcQ&key=${key}`);
          if (!r.ok) return { success: false, message: `YouTube API error: ${r.status} ${r.statusText}` };
          return { success: true, message: "YouTube Data API v3 — connected" };
        } else if (input.service === "instagram") {
          const r = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${key}`);
          if (!r.ok) return { success: false, message: `Instagram API error: ${r.status} ${r.statusText}` };
          const data = await r.json() as { username?: string };
          return { success: true, message: `Instagram Graph API — connected as @${data.username ?? "unknown"}` };
        } else {
          const r = await fetch("https://api.twitter.com/2/users/by/username/twitter", { headers: { Authorization: `Bearer ${key}` } });
          if (!r.ok) return { success: false, message: `Twitter API error: ${r.status} ${r.statusText}` };
          return { success: true, message: "Twitter API v2 — connected" };
        }
      } catch (e: any) {
        return { success: false, message: e.message ?? "Connection failed" };
      }
    }),

  // Sync Controls
  syncNow: protectedProcedure.mutation(async () => {
    const result = await runFullDailySync();
    return result;
  }),

  syncVideosOnly: protectedProcedure.mutation(async () => {
    // Use runChannelSync (youtube_channels pipeline) instead of legacy runVideoDiscovery
    const result = await runChannelSync();
    return { processed: result.newVideos, errors: result.errors };
  }),

  syncViewCountsOnly: protectedProcedure.mutation(async () => {
    const result = await runViewCountSnapshot();
    return result;
  }),

  recentSyncLogs: protectedProcedure.query(() => getRecentSyncLogs(20)),

  // ─── Auto-sync Heartbeat Job Management ─────────────────────────────────────
  // Lists all heartbeat cron jobs for this project owner.
  listAutoSyncJobs: protectedProcedure.query(async ({ ctx }) => {
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    try {
      const result = await listHeartbeatJobs(sessionToken);
      return result.jobs;
    } catch {
      return [];
    }
  }),

  // Creates the midnight UTC daily auto-sync heartbeat job.
  createAutoSyncJob: protectedProcedure.mutation(async ({ ctx }) => {
    const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
    const job = await createHeartbeatJob({
      name: "influencer-tracker-daily-sync",
      cron: "0 0 0 * * *",  // midnight UTC every day
      path: "/api/scheduled/daily-sync",
      description: "Daily auto-sync: Full Sync + View Count Snapshot + Daily Report",
    }, sessionToken);
    return { taskUid: job.taskUid, nextExecutionAt: job.nextExecutionAt };
  }),

  // Deletes a heartbeat job by taskUid.
  deleteAutoSyncJob: protectedProcedure
    .input(z.object({ taskUid: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const sessionToken = parseCookie(ctx.req.headers.cookie ?? "")[COOKIE_NAME] ?? "";
      await deleteHeartbeatJob(input.taskUid, sessionToken);
      return { success: true };
    }),
});

// ─── Reports Router ───────────────────────────────────────────────────────────
const reportsRouter = router({
  list: protectedProcedure.query(() => getAllReports(30)),
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await deleteReport(input.id);
      return { success: true };
    }),

  getById: protectedProcedure
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const report = await getReportById(input.id);
      if (!report) throw new TRPCError({ code: "NOT_FOUND" });
      return report;
    }),

  generateDaily: protectedProcedure.mutation(async () => {
    await generateDailyReport();
    return { success: true };
  }),

  generateWeekly: protectedProcedure.mutation(async () => {
    await generateWeeklyReport();
    return { success: true };
  }),
});

// ─── Alerts Router ────────────────────────────────────────────────────────────
const alertsRouter = router({
  list: protectedProcedure
    .input(z.object({ limit: z.number().default(50) }).optional())
    .query(({ input }) => getAlertEvents(input?.limit ?? 50)),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await markAlertRead(input.id);
      return { success: true };
    }),

  unreadCount: protectedProcedure.query(() => getUnreadAlertCount()),
});

// ─── Export Router ───────────────────────────────────────────────────────────
const exportRouter = router({
  allData: protectedProcedure.query(async () => {
    const [allVideos, allViewCounts, allShills] = await Promise.all([
      getAllVideos(),
      getAllViewCounts(),
      getAllShills(),
    ]);
    // Map to exact schema field names as specified
    const videoRows = allVideos.map((v) => ({
      video_id: v.videoId,
      influencer_name: v.influencerName,
      platform: v.platform,
      video_url: v.videoUrl,
      title: v.title,
      published_date: v.publishedDate,
      date_added: v.dateAdded,
    }));
    const viewCountRows = allViewCounts.map((vc) => ({
      count_id: vc.id,
      video_id: vc.videoId,
      date: vc.date,
      view_count: vc.viewCount,
      likes: vc.likes ?? 0,
      comments: vc.comments ?? 0,
      shares: vc.shares ?? 0,
      engagement_rate: vc.engagementRate ?? 0,
    }));
    const shillRows = allShills.map((s) => ({
      shill_id: s.shillId,
      video_id: s.videoId,
      product_brand: s.productBrand,
      timestamp: s.timestamp,
      length_seconds: s.lengthSeconds,
      promo_type: s.promoType,
      notes: s.notes ?? "",
    }));
    return { videoRows, viewCountRows, shillRows };
  }),
});

// // ─── Channels Router ──────────────────────────────────────────────────────────
const channelsRouter = router({
  /** List all linked YouTube channels, optionally filtered by influencer. */
  list: protectedProcedure
    .input(z.object({ influencerName: z.string().optional() }).optional())
    .query(async ({ input }) => {
      if (input?.influencerName) return getChannelsByInfluencer(input.influencerName);
      return getAllChannels();
    }),

  /** Get a single channel with its videos. */
  getWithVideos: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .query(async ({ input }) => {
      const channel = await getChannelById(input.channelId);
      if (!channel) throw new Error("Channel not found");
      const videos = await getVideosByChannelId(input.channelId);
      return { channel, videos };
    }),

  /**
   * Link a new YouTube channel.
   * Accepts a channel URL, @handle, or bare channel ID.
   * Immediately fetches the last 10 uploads and their stats.
   */
  link: protectedProcedure
    .input(
      z.object({
        channelInput: z.string().min(1, "Channel URL or handle is required"),
        influencerName: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Resolve channel metadata
      const channelInfo = await resolveChannel(input.channelInput);

      // 2. Persist channel record — use channelName as the canonical influencerName
      const resolvedInfluencerName = channelInfo.channelName;
      await upsertChannel({
        channelId: channelInfo.channelId,
        channelHandle: channelInfo.channelHandle,
        channelName: channelInfo.channelName,
        influencerName: resolvedInfluencerName,
        thumbnailUrl: channelInfo.thumbnailUrl,
        subscriberCount: channelInfo.subscriberCount,
        videoCount: channelInfo.videoCount,
        description: channelInfo.description,
        isActive: true,
      });

      // 3. Fetch last 10 uploads — stats come directly from the channel listing
      const uploads = await fetchChannelUploads(channelInfo.channelId, 10);

      // 4. Persist each video (skip if already exists)
      let newVideos = 0;
      for (const upload of uploads) {
        const existing = await getVideoByVideoId(upload.ytVideoId);
        if (existing) continue;
        await insertVideo({
          videoId: upload.ytVideoId,
          influencerName: resolvedInfluencerName,
          platform: "YouTube",
          channelId: channelInfo.channelId,
          videoUrl: upload.videoUrl,
          title: upload.title,
          publishedDate: upload.publishedDate,
          dateAdded: todayStr(),
          thumbnailUrl: upload.thumbnailUrl,
          durationSeconds: upload.durationSeconds,
          isActive: true,
          isSeen: false,  // triggers the Channels nav badge
        });
        // Snapshot initial view count — use PreserveScrape so re-linking never wipes scraped data
        const countId = `vc_${upload.ytVideoId}_${todayStr()}`;
        await insertViewCountPreserveScrape({
          countId,
          videoId: upload.ytVideoId,
          date: todayStr(),
          viewCount: upload.viewCount,
          likes: upload.likeCount ?? 0,
          comments: 0,
          shares: 0,
          engagementRate: "0",
        });
        newVideos++;
      }

      // 6. Update last checked timestamp
      await updateChannelLastChecked(channelInfo.channelId);

      return {
        success: true,
        channelId: channelInfo.channelId,
        channelName: channelInfo.channelName,
        videosDiscovered: uploads.length,
        newVideosAdded: newVideos,
      };
    }),

  /** Manually trigger a sync for a specific channel (discover new videos + update stats). */
  syncChannel: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ input }) => {
      const channel = await getChannelById(input.channelId);
      if (!channel) throw new Error("Channel not found");

      // Fetch latest uploads — stats (views, duration, title) come directly from
      // the channel listing. No per-video API calls needed (avoids bot-detection).
      // Fetch up to 100 to capture videos from April 2026 onwards.
      const uploads = await fetchChannelUploads(input.channelId, 100);

      // Optionally enrich with YouTube Data API v3 (likes, comments, exact view count)
      const apiKey = ENV.youtubeApiKey;
      let v3StatsMap = new Map<string, any>();
      if (apiKey) {
        const rawIds = uploads.map((u) => u.videoId);
        v3StatsMap = await fetchVideoStatsV3(rawIds, apiKey);
      }

      // Also update channel subscriber count via Data API v3 if key available
      if (apiKey) {
        const channelStats = await fetchChannelStatsV3(input.channelId, apiKey);
        if (channelStats && channelStats.subscriberCount > 0) {
          await upsertChannel({
            channelId: input.channelId,
            channelName: channel.channelName,
            channelHandle: channel.channelHandle ?? undefined,
            influencerName: channel.influencerName ?? undefined,
            thumbnailUrl: channel.thumbnailUrl ?? undefined,
            subscriberCount: channelStats.subscriberCount,
            videoCount: channelStats.videoCount,
            isActive: true,
          });
        }
      }

      let newVideos = 0;
      let updatedStats = 0;

      for (const upload of uploads) {
        const v3 = v3StatsMap.get(upload.videoId);
        const existing = await getVideoByVideoId(upload.ytVideoId);

        if (!existing) {
          // New video discovered — insert it
          await insertVideo({
            videoId: upload.ytVideoId,
            influencerName: channel.channelName,
            platform: "YouTube",
            channelId: input.channelId,
            videoUrl: upload.videoUrl,
            title: v3?.title ?? upload.title,
            publishedDate: v3?.publishedAt ?? upload.publishedDate,
            dateAdded: todayStr(),
            thumbnailUrl: v3?.thumbnailUrl ?? upload.thumbnailUrl,
            durationSeconds: v3?.durationSeconds ?? upload.durationSeconds,
            isActive: true,
            isSeen: false,  // triggers the Channels nav badge
          });
          newVideos++;
        } else if (upload.title && upload.title !== "Untitled" && existing.title === "Untitled") {
          // Back-fill title/duration for videos inserted without stats
          await updateVideoMeta(upload.ytVideoId, {
            title: v3?.title ?? upload.title,
            durationSeconds: v3?.durationSeconds ?? upload.durationSeconds,
            thumbnailUrl: v3?.thumbnailUrl ?? upload.thumbnailUrl,
          });
        }

        // Always snapshot today's stats for every fetched video.
        // PreserveScrape ensures scraped likes/comments are never overwritten by sync's 0-values.
        const countId = `vc_${upload.ytVideoId}_${todayStr()}`;
        await insertViewCountPreserveScrape({
          countId,
          videoId: upload.ytVideoId,
          date: todayStr(),
          viewCount: v3?.viewCount ?? upload.viewCount,
          likes: v3?.likeCount ?? upload.likeCount ?? 0,
          comments: v3?.commentCount ?? 0,
          shares: 0,
          engagementRate: "0",
        });
        updatedStats++;
      }

      await updateChannelLastChecked(input.channelId);

      return { success: true, newVideos, updatedStats, channelName: channel.channelName };
    }),

  /** List all videos belonging to a specific channel, paginated. */
  listByChannel: protectedProcedure
    .input(z.object({
      channelId: z.string(),
      page: z.number().min(1).default(1),
      limit: z.number().min(1).max(100).default(20),
    }))
    .query(async ({ input }) => {
      return getVideosByChannelIdPaginated(input.channelId, input.page, input.limit);
    }),

  /** Unlink (soft-delete) a channel. */
  unlink: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .mutation(async ({ input }) => {
      await deleteChannel(input.channelId);
      return { success: true };
    }),
  /** Returns the count of newly-discovered videos not yet seen by the user. */
  unseenCount: protectedProcedure.query(async () => {
    const { getUnseenVideoCount } = await import("./db");
    return { count: await getUnseenVideoCount() };
  }),
  /** Marks all unseen videos as seen — clears the badge. */
  markSeen: protectedProcedure.mutation(async () => {
    const { markAllVideosSeen } = await import("./db");
    await markAllVideosSeen();
    return { success: true };
  }),
});

// ─── Social Accounts Router ─────────────────────────────────────────────────
const socialAccountsRouter = router({
  /** Link a new Instagram or X account. */
  link: protectedProcedure
    .input(z.object({
      platform: z.enum(["Instagram", "X"]),
      handle: z.string().min(1),
    }))
    .mutation(async ({ input }) => {
      const { resolveInstagramAccount, resolveXAccount } = await import("./socialEngine");
      const info = input.platform === "Instagram"
        ? await resolveInstagramAccount(input.handle)
        : await resolveXAccount(input.handle);
      await upsertSocialAccount({
        accountId: `${input.platform.toLowerCase()}_${info.handle}`,
        platform: input.platform,
        handle: info.handle,
        displayName: info.displayName,
        profileUrl: info.profileUrl,
        thumbnailUrl: info.thumbnailUrl,
        followerCount: info.followerCount,
        postCount: info.postCount,
        description: info.description,
      });
      return { success: true, account: { accountId: `${input.platform.toLowerCase()}_${info.handle}`, handle: info.handle, displayName: info.displayName, platform: input.platform } };
    }),
  /** List all linked social accounts, optionally filtered by platform. */
  list: protectedProcedure
    .input(z.object({ platform: z.enum(["Instagram", "X"]).optional() }).optional())
    .query(async ({ input }) => getAllSocialAccounts(input?.platform)),
  /** Unlink a social account. */
  unlink: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input }) => {
      await deleteSocialAccount(input.accountId);
      return { success: true };
    }),
  /** Check which social API keys are configured. */
  apiStatus: protectedProcedure.query(() => ({
    instagram: !!ENV.instagramAccessToken,
    twitter: !!ENV.twitterBearerToken,
    youtube: !!ENV.youtubeApiKey,
  })),
  /** Manually trigger a sync for a social account. */
  syncAccount: protectedProcedure
    .input(z.object({ accountId: z.string() }))
    .mutation(async ({ input }) => {
      const account = await getSocialAccountById(input.accountId);
      if (!account) throw new Error("Account not found");
      const { fetchInstagramPosts, fetchXPosts, toSnapshotId } = await import("./socialEngine");
      const posts = account.platform === "Instagram"
        ? await fetchInstagramPosts(account.handle, 20)
        : await fetchXPosts(account.handle, 20);
      let newPosts = 0;
      for (const post of posts) {
        await upsertSocialPost({
          postId: post.postId,
          accountId: input.accountId,
          platform: account.platform,
          postUrl: post.postUrl,
          title: post.title,
          publishedDate: post.publishedDate,
          thumbnailUrl: post.thumbnailUrl,
        });
        const today = new Date().toISOString().split("T")[0]!;
        await insertSocialPostSnapshot({
          snapshotId: toSnapshotId(post.postId, today),
          postId: post.postId,
          accountId: input.accountId,
          platform: account.platform,
          date: today,
          views: post.views,
          impressions: post.impressions,
          likes: post.likes,
          comments: post.comments,
          shares: post.shares,
          retweets: post.retweets,
          engagementRate: undefined,
        });
        newPosts++;
      }
      await updateSocialAccountLastChecked(input.accountId, posts.length);
      return { success: true, newPosts };
    }),
});

// ─── App Router ──────────────────────────────────────────────────────────
import { clientsRouter, campaignsRouter, deliverablesRouter, affiliateRouter, invoicesRouter, emailsRouter, talentResultsRouter } from "./routers/agency";

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      const cookieOptions = getSessionCookieOptions(ctx.req);
      ctx.res.clearCookie(COOKIE_NAME, { ...cookieOptions, maxAge: -1 });
      return { success: true } as const;
    }),
  }),
  influencers: influencersRouter,
  videos: videosRouter,
  analytics: analyticsRouter,
  shills: shillsRouter,
  admin: adminRouter,
  reports: reportsRouter,
  alerts: alertsRouter,
  export: exportRouter,
  channels: channelsRouter,
  socialAccounts: socialAccountsRouter,
  // Agency Management
  clients: clientsRouter,
  campaigns: campaignsRouter,
  deliverables: deliverablesRouter,
  affiliate: affiliateRouter,
  invoices: invoicesRouter,
  emails: emailsRouter,
  talentResults: talentResultsRouter,
});

export type AppRouter = typeof appRouter;
