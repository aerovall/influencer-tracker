import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers (single consolidated block) ──────────────────────────────
vi.mock("./db", () => ({
  upsertUser: vi.fn(),
  getUserByOpenId: vi.fn(),
  getAllInfluencers: vi.fn().mockResolvedValue([
    { id: 1, name: "Levi", bio: null, avatarUrl: null, isActive: true, createdAt: new Date() },
    { id: 2, name: "NoBs", bio: null, avatarUrl: null, isActive: true, createdAt: new Date() },
    { id: 3, name: "Danielle", bio: null, avatarUrl: null, isActive: true, createdAt: new Date() },
  ]),
  getInfluencerById: vi.fn().mockResolvedValue({ id: 1, name: "Levi" }),
  createInfluencer: vi.fn().mockResolvedValue(undefined),
  updateInfluencer: vi.fn().mockResolvedValue(undefined),
  deleteInfluencer: vi.fn().mockResolvedValue(undefined),
  getPlatformAccountsByInfluencer: vi.fn().mockResolvedValue([]),
  upsertPlatformAccount: vi.fn().mockResolvedValue(undefined),
  getAllPlatformAccounts: vi.fn().mockResolvedValue([]),
  getAllVideos: vi.fn().mockResolvedValue([
    {
      videoId: "yt_abc12345678",
      influencerName: "Levi",
      platform: "YouTube",
      videoUrl: "https://youtube.com/watch?v=abc12345678",
      title: "Test Video",
      publishedDate: "2025-01-01",
      dateAdded: "2025-01-01",
      thumbnailUrl: null,
      isActive: true,
    },
  ]),
  getVideoByVideoId: vi.fn().mockResolvedValue({ videoId: "yt_abc12345678", title: "Test Video" }),
  getVideosByChannelId: vi.fn().mockResolvedValue([]),
  insertVideo: vi.fn().mockResolvedValue(undefined),
  updateVideo: vi.fn().mockResolvedValue(undefined),
  deleteVideo: vi.fn().mockResolvedValue(undefined),
  getViewCountsByVideoId: vi.fn().mockResolvedValue([]),
  getVideoStats: vi.fn().mockResolvedValue({ total: 1, byInfluencer: [], byPlatform: [] }),
  getViewCountTrends: vi.fn().mockResolvedValue([]),
  getTotalViewsAllTime: vi.fn().mockResolvedValue(0),
  getAvgEngagementRate: vi.fn().mockResolvedValue(0),
  getUnreadAlertCount: vi.fn().mockResolvedValue(0),
  getAllShills: vi.fn().mockResolvedValue([]),
  getShillBrandSummary: vi.fn().mockResolvedValue([]),
  insertShill: vi.fn().mockResolvedValue(undefined),
  updateShill: vi.fn().mockResolvedValue(undefined),
  deleteShill: vi.fn().mockResolvedValue(undefined),
  getAllCredentials: vi.fn().mockResolvedValue([]),
  upsertCredential: vi.fn().mockResolvedValue(undefined),
  deleteCredential: vi.fn().mockResolvedValue(undefined),
  getAllAlertThresholds: vi.fn().mockResolvedValue([]),
  insertAlertThreshold: vi.fn().mockResolvedValue(undefined),
  updateAlertThreshold: vi.fn().mockResolvedValue(undefined),
  deleteAlertThreshold: vi.fn().mockResolvedValue(undefined),
  getReportSchedules: vi.fn().mockResolvedValue([]),
  updateReportSchedule: vi.fn().mockResolvedValue(undefined),
  getAllReports: vi.fn().mockResolvedValue([]),
  getReportById: vi.fn().mockResolvedValue({
    id: 1,
    title: "Daily Report",
    type: "daily",
    content: "...",
    periodStart: "2025-01-01",
    periodEnd: "2025-01-01",
    createdAt: new Date(),
  }),
  getAlertEvents: vi.fn().mockResolvedValue([]),
  markAlertRead: vi.fn().mockResolvedValue(undefined),
  getRecentSyncLogs: vi.fn().mockResolvedValue([]),
  insertSyncLog: vi.fn().mockResolvedValue(1),
  updateSyncLog: vi.fn().mockResolvedValue(undefined),
  insertViewCount: vi.fn().mockResolvedValue(undefined),
  insertAlertEvent: vi.fn().mockResolvedValue(undefined),
  insertReport: vi.fn().mockResolvedValue(undefined),
  getCredentialByKey: vi.fn().mockResolvedValue(null),
  getAllViewCounts: vi.fn().mockResolvedValue([]),
  // Channel helpers
  getAllChannels: vi.fn().mockResolvedValue([
    {
      channelId: "UCtest123456789",
      channelName: "Test Channel",
      channelHandle: "@testchannel",
      influencerName: "Levi",
      thumbnailUrl: null,
      subscriberCount: 10000,
      videoCount: 50,
      description: null,
      isActive: true,
      lastCheckedAt: null,
      createdAt: new Date(),
    },
  ]),
  getChannelById: vi.fn().mockResolvedValue({
    channelId: "UCtest123456789",
    channelName: "Test Channel",
    channelHandle: "@testchannel",
    influencerName: "Levi",
    isActive: true,
  }),
  getChannelsByInfluencer: vi.fn().mockResolvedValue([]),
  upsertChannel: vi.fn().mockResolvedValue(undefined),
  updateChannelLastChecked: vi.fn().mockResolvedValue(undefined),
  deleteChannel: vi.fn().mockResolvedValue(undefined),
  getActiveChannels: vi.fn().mockResolvedValue([]),
  getUnseenVideoCount: vi.fn().mockResolvedValue(3),
  markAllVideosSeen: vi.fn().mockResolvedValue(undefined),
  // Social account helpers
  upsertSocialAccount: vi.fn().mockResolvedValue(undefined),
  getAllSocialAccounts: vi.fn().mockResolvedValue([]),
  getSocialAccountById: vi.fn().mockResolvedValue(null),
  deleteSocialAccount: vi.fn().mockResolvedValue(undefined),
  getLatestViewCountByVideoId: vi.fn().mockResolvedValue(null),
}));

// ─── Mock syncEngine ──────────────────────────────────────────────────────────
vi.mock("./syncEngine", () => ({
  runFullDailySync: vi.fn().mockResolvedValue({
    snapshot: { appended: 0, skipped: 0 },
    channelSync: { newVideos: 0, updatedStats: 0, errors: [] },
    alerts: 0,
  }),
  runVideoDiscovery: vi.fn().mockResolvedValue({ processed: 0 }),
  runViewCountSnapshot: vi.fn().mockResolvedValue({ appended: 0, skipped: 0 }),
  generateDailyReport: vi.fn().mockResolvedValue(undefined),
  generateWeeklyReport: vi.fn().mockResolvedValue(undefined),
  runChannelSync: vi.fn().mockResolvedValue({ newVideos: 0, updatedStats: 0, errors: [] }),
}));

// ─── Mock channelEngine (only the async network functions) ───────────────────
// We do NOT mock extractVideoId or toDbVideoId so their unit tests use real code.
vi.mock("./channelEngine", async (importOriginal) => {
  const real = await importOriginal<typeof import("./channelEngine")>();
  return {
    ...real, // keep extractVideoId, toDbVideoId, types, etc. real
    resolveChannel: vi.fn().mockResolvedValue({
      channelId: "UCtest123456789",
      channelName: "Test Channel",
      channelHandle: "@testchannel",
      thumbnailUrl: null,
      subscriberCount: 10000,
      videoCount: 50,
      description: "A test channel",
    }),
    fetchChannelUploads: vi.fn().mockResolvedValue([
      {
        videoId: "vid001abc12",
        ytVideoId: "yt_vid001abc12",
        title: "Test Upload 1",
        videoUrl: "https://youtube.com/watch?v=vid001abc12",
        publishedDate: "2025-01-10",
        thumbnailUrl: null,
        durationSeconds: 600,
        viewCount: 5000,
        likeCount: 200,
      },
    ]),
    fetchBulkVideoStats: vi.fn().mockResolvedValue(
      new Map([
        [
          "vid001abc12",
          {
            videoId: "vid001abc12",
            viewCount: 5000,
            likeCount: 200,
            durationSeconds: 600,
            title: "Test Upload 1",
            thumbnailUrl: null,
            publishedDate: "2025-01-10",
          },
        ],
      ])
    ),
    fetchVideoStats: vi.fn().mockResolvedValue(null),
  };
});

// ─── Auth context helper ──────────────────────────────────────────────────────
function createAuthContext(): TrpcContext {
  return {
    user: {
      id: 1,
      openId: "test-user",
      email: "test@example.com",
      name: "Test User",
      loginMethod: "manus",
      role: "admin",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("auth.me", () => {
  it("returns the current user when authenticated", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeDefined();
    expect(user?.name).toBe("Test User");
  });

  it("returns null when not authenticated", async () => {
    const ctx: TrpcContext = {
      user: null,
      req: { protocol: "https", headers: {} } as TrpcContext["req"],
      res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"],
    };
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});

describe("influencers.list", () => {
  it("returns all three influencers", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const influencers = await caller.influencers.list();
    expect(influencers).toHaveLength(3);
    const names = influencers.map((i) => i.name);
    expect(names).toContain("Levi");
    expect(names).toContain("NoBs");
    expect(names).toContain("Danielle");
  });

  it("returns influencers with required fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const influencers = await caller.influencers.list();
    expect(influencers[0]).toHaveProperty("id");
    expect(influencers[0]).toHaveProperty("name");
    expect(influencers[0]).toHaveProperty("isActive");
  });
});

describe("videos.list", () => {
  it("returns the video list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const videos = await caller.videos.list({});
    expect(Array.isArray(videos)).toBe(true);
    expect(videos[0]?.videoId).toBe("yt_abc12345678");
    expect(videos[0]?.influencerName).toBe("Levi");
    expect(videos[0]?.platform).toBe("YouTube");
  });
});

describe("videos.create", () => {
  it("creates a YouTube video and returns a yt_ prefixed videoId", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.videos.create({
      influencerName: "NoBs",
      platform: "YouTube",
      videoUrl: "https://youtube.com/watch?v=dQw4w9WgXcQ",
      title: "Test Video NoBs",
      publishedDate: "2025-06-01",
    });
    expect(result.success).toBe(true);
    expect(result.videoId).toMatch(/^yt_/);
  });

  it("rejects invalid influencer names", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.videos.create({
        influencerName: "InvalidName" as "Levi",
        platform: "YouTube",
        videoUrl: "https://youtube.com/watch?v=test",
        title: "Test",
        publishedDate: "2025-01-01",
      })
    ).rejects.toThrow();
  });

  it("rejects invalid platform names", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.videos.create({
        influencerName: "Levi",
        platform: "Twitter" as "YouTube",
        videoUrl: "https://twitter.com/test",
        title: "Test",
        publishedDate: "2025-01-01",
      })
    ).rejects.toThrow();
  });
});

describe("shills.create", () => {
  it("creates a shill entry with all required fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.shills.create({
      videoId: "yt_abc12345678",
      productBrand: "NordVPN",
      timestamp: "4:32",
      lengthSeconds: 60,
      promoType: "Integration",
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid timestamp format", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.shills.create({
        videoId: "yt_abc12345678",
        productBrand: "NordVPN",
        timestamp: "invalid",
        lengthSeconds: 60,
        promoType: "Integration",
      })
    ).rejects.toThrow();
  });
});

describe("analytics.kpis", () => {
  it("returns kpi object with expected fields", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const kpis = await caller.analytics.kpis();
    expect(kpis).toHaveProperty("totalVideos");
    expect(kpis).toHaveProperty("totalViews");
    expect(kpis).toHaveProperty("avgEngagementRate");
    expect(kpis).toHaveProperty("unreadAlerts");
    expect(kpis).toHaveProperty("byInfluencer");
    expect(kpis).toHaveProperty("byPlatform");
  });
});

describe("admin.syncNow", () => {
  it("triggers full sync and returns result", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.syncNow();
    expect(result).toHaveProperty("snapshot");
    expect(result).toHaveProperty("alerts");
  });
});

describe("reports.getById", () => {
  it("returns a report by id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const report = await caller.reports.getById({ id: 1 });
    expect(report).toBeDefined();
    expect(report.type).toBe("daily");
  });
});

describe("admin.createThreshold", () => {
  it("creates an alert threshold", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.admin.createThreshold({
      name: "Viral Detection",
      metric: "view_growth_rate",
      operator: "gt",
      thresholdValue: 100,
      alertType: "viral",
    });
    expect(result.success).toBe(true);
  });
});

describe("auth.logout", () => {
  it("clears the session cookie and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.auth.logout();
    expect(result.success).toBe(true);
  });
});

// ─── channels router tests ────────────────────────────────────────────────────

describe("channels.list", () => {
  it("returns all linked channels", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const channels = await caller.channels.list();
    expect(Array.isArray(channels)).toBe(true);
    expect(channels.length).toBeGreaterThanOrEqual(1);
    expect(channels[0]?.channelId).toBe("UCtest123456789");
    expect(channels[0]?.influencerName).toBe("Levi");
  });
});

describe("channels.unlink", () => {
  it("unlinks a channel and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.channels.unlink({ channelId: "UCtest123456789" });
    expect(result.success).toBe(true);
  });
});

// ─── extractYouTubeVideoId unit tests (platformApi) ──────────────────────────
import { extractYouTubeVideoId } from "./platformApi";

describe("extractYouTubeVideoId (platformApi)", () => {
  it("parses a standard watch URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses a youtu.be short URL", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses a YouTube Shorts URL", () => {
    expect(extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns the ID directly if already a bare 11-char ID", () => {
    expect(extractYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for a non-YouTube URL", () => {
    expect(extractYouTubeVideoId("https://tiktok.com/@user/video/123")).toBeNull();
  });
  it("returns null for an empty string", () => {
    expect(extractYouTubeVideoId("")).toBeNull();
  });
});

// ─── channelEngine pure-function unit tests ───────────────────────────────────
import { extractVideoId, toDbVideoId } from "./channelEngine";

describe("channelEngine.extractVideoId", () => {
  it("parses a standard watch URL", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses a youtu.be short URL", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses a YouTube Shorts URL", () => {
    expect(extractVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("parses an embed URL", () => {
    expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns a bare 11-char ID directly", () => {
    expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for a non-YouTube URL", () => {
    expect(extractVideoId("https://tiktok.com/@user/video/123")).toBeNull();
  });
  it("returns null for an empty string", () => {
    expect(extractVideoId("")).toBeNull();
  });
});

describe("channelEngine.toDbVideoId", () => {
  it("prefixes a raw video ID with yt_", () => {
    expect(toDbVideoId("dQw4w9WgXcQ")).toBe("yt_dQw4w9WgXcQ");
  });
  it("does not double-prefix when called with a raw ID", () => {
    expect(toDbVideoId("abc12345678")).toBe("yt_abc12345678");
  });
});

describe("channels.link", () => {
  it("links a channel and returns channelId, channelName, and videosDiscovered", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.channels.link({
      channelInput: "@testchannel",
      influencerName: "Levi",
    });
    expect(result.success).toBe(true);
    expect(result.channelId).toBe("UCtest123456789");
    expect(result.channelName).toBe("Test Channel");
    expect(typeof result.videosDiscovered).toBe("number");
    expect(typeof result.newVideosAdded).toBe("number");
  });

  it("rejects an invalid influencer name", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    await expect(
      caller.channels.link({
        channelInput: "@testchannel",
        influencerName: "Unknown" as "Levi",
      })
    ).rejects.toThrow();
  });
});

describe("channels.syncChannel", () => {
  it("syncs a channel and returns newVideos and updatedStats counts", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.channels.syncChannel({ channelId: "UCtest123456789" });
    expect(result.success).toBe(true);
    expect(typeof result.newVideos).toBe("number");
    expect(typeof result.updatedStats).toBe("number");
  });
});

describe("channels.listByChannel", () => {
  it("returns videos for a given channelId", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const videos = await caller.channels.listByChannel({ channelId: "UCtest123456789" });
    expect(Array.isArray(videos)).toBe(true);
  });
});

describe("channels.getWithVideos", () => {
  it("returns channel metadata and its video list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.channels.getWithVideos({ channelId: "UCtest123456789" });
    expect(result.channel).toBeDefined();
    expect(result.channel.channelId).toBe("UCtest123456789");
    expect(Array.isArray(result.videos)).toBe(true);
  });
});

describe("channels.unseenCount", () => {
  it("returns the count of unseen new videos", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.channels.unseenCount();
    expect(result).toHaveProperty("count");
    expect(result.count).toBe(3); // matches mock: getUnseenVideoCount returns 3
  });
});

describe("channels.markSeen", () => {
  it("marks all videos as seen and returns success", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.channels.markSeen();
    expect(result).toHaveProperty("success");
    expect(result.success).toBe(true);
  });
});
