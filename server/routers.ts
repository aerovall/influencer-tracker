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
  deleteCredential,
  deleteInfluencer,
  deleteShill,
  deleteVideo,
  getAllAlertThresholds,
  getAllCredentials,
  getAllInfluencers,
  getAllPlatformAccounts,
  getAllReports,
  getAllShills,
  getAllVideos,
  getAllViewCounts,
  getAlertEvents,
  getAvgEngagementRate,
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
  getViewCountTrends,
  getViewCountsByVideoId,
  insertAlertThreshold,
  insertShill,
  insertVideo,
  markAlertRead,
  updateAlertThreshold,
  updateInfluencer,
  updateReportSchedule,
  updateShill,
  updateVideo,
  upsertCredential,
  upsertPlatformAccount,
} from "./db";
import {
  generateDailyReport,
  generateWeeklyReport,
  runFullDailySync,
  runVideoDiscovery,
  runViewCountSnapshot,
} from "./syncEngine";
import { extractYouTubeVideoId, fetchYouTubeVideoInfo } from "./platformApi";

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
      influencerName: z.enum(["Levi", "NoBs", "Danielle"]),
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
});

// ─── Analytics Router ─────────────────────────────────────────────────────────
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
});

// ─── Shills Router ────────────────────────────────────────────────────────────
const shillsRouter = router({
  list: protectedProcedure
    .input(z.object({ videoId: z.string().optional(), brand: z.string().optional() }).optional())
    .query(({ input }) => getAllShills(input)),

  brandSummary: protectedProcedure.query(() => getShillBrandSummary()),

  create: protectedProcedure
    .input(z.object({
      videoId: z.string(),
      productBrand: z.string().min(1),
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

  // Sync Controls
  syncNow: protectedProcedure.mutation(async () => {
    const result = await runFullDailySync();
    return result;
  }),

  syncVideosOnly: protectedProcedure.mutation(async () => {
    const result = await runVideoDiscovery();
    return result;
  }),

  syncViewCountsOnly: protectedProcedure.mutation(async () => {
    const result = await runViewCountSnapshot();
    return result;
  }),

  recentSyncLogs: protectedProcedure.query(() => getRecentSyncLogs(20)),
});

// ─── Reports Router ───────────────────────────────────────────────────────────
const reportsRouter = router({
  list: protectedProcedure.query(() => getAllReports(30)),

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

// ─── App Router ───────────────────────────────────────────────────────────────
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
});

export type AppRouter = typeof appRouter;
