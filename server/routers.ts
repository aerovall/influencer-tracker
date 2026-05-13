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
  getViewCountTrends,
  getViewCountsByVideoId,
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
} from "./db";
import {
  generateDailyReport,
  generateWeeklyReport,
  runFullDailySync,
  runVideoDiscovery,
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
import { updateVideoMeta } from "./db";

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
        influencerName: z.enum(["Levi", "NoBs", "Danielle"]).optional(),
      })
    )
    .mutation(async ({ input }) => {
      // 1. Resolve channel metadata
      const channelInfo = await resolveChannel(input.channelInput);

      // 2. Persist channel record
      await upsertChannel({
        channelId: channelInfo.channelId,
        channelHandle: channelInfo.channelHandle,
        channelName: channelInfo.channelName,
        influencerName: input.influencerName,
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
          influencerName: input.influencerName ?? "Unknown",
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
        // Snapshot initial view count
        const countId = `vc_${upload.ytVideoId}_${todayStr()}`;
        await insertViewCount({
          countId,
          videoId: upload.ytVideoId,
          date: todayStr(),
          viewCount: upload.viewCount,
          likes: upload.likeCount,
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
      const uploads = await fetchChannelUploads(input.channelId, 30);

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
          // New video discovered
          await insertVideo({
            videoId: upload.ytVideoId,
            influencerName: channel.influencerName ?? "Unknown",
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

        // Snapshot today's stats (upsert — updates if already exists today)
        const countId = `vc_${upload.ytVideoId}_${todayStr()}`;
        await insertViewCount({
          countId,
          videoId: upload.ytVideoId,
          date: todayStr(),
          viewCount: v3?.viewCount ?? upload.viewCount,
          likes: v3?.likeCount ?? upload.likeCount,
          comments: v3?.commentCount ?? 0,
          shares: 0,
          engagementRate: "0",
        });
        updatedStats++;
      }

      await updateChannelLastChecked(input.channelId);

      return { success: true, newVideos, updatedStats, channelName: channel.channelName };
    }),

  /** List all videos belonging to a specific channel. */
  listByChannel: protectedProcedure
    .input(z.object({ channelId: z.string() }))
    .query(async ({ input }) => {
      return getVideosByChannelId(input.channelId);
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
});

export type AppRouter = typeof appRouter;
