import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ─── Mock DB helpers ──────────────────────────────────────────────────────────
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
      videoId: "yt_abc123",
      influencerName: "Levi",
      platform: "YouTube",
      videoUrl: "https://youtube.com/watch?v=abc123",
      title: "Test Video",
      publishedDate: "2025-01-01",
      dateAdded: "2025-01-01",
      thumbnailUrl: null,
      isActive: true,
    },
  ]),
  getVideoByVideoId: vi.fn().mockResolvedValue({ videoId: "yt_abc123", title: "Test Video" }),
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
  getReportById: vi.fn().mockResolvedValue({ id: 1, title: "Daily Report", type: "daily", content: "...", periodStart: "2025-01-01", periodEnd: "2025-01-01", createdAt: new Date() }),
  getAlertEvents: vi.fn().mockResolvedValue([]),
  markAlertRead: vi.fn().mockResolvedValue(undefined),
  getRecentSyncLogs: vi.fn().mockResolvedValue([]),
  insertSyncLog: vi.fn().mockResolvedValue(1),
  updateSyncLog: vi.fn().mockResolvedValue(undefined),
  insertViewCount: vi.fn().mockResolvedValue(undefined),
  insertAlertEvent: vi.fn().mockResolvedValue(undefined),
  insertReport: vi.fn().mockResolvedValue(undefined),
  getCredentialByKey: vi.fn().mockResolvedValue(null),
}));

vi.mock("./syncEngine", () => ({
  runFullDailySync: vi.fn().mockResolvedValue({ snapshot: { appended: 0, skipped: 0 }, alerts: 0 }),
  runVideoDiscovery: vi.fn().mockResolvedValue({ processed: 0 }),
  runViewCountSnapshot: vi.fn().mockResolvedValue({ appended: 0, skipped: 0 }),
  generateDailyReport: vi.fn().mockResolvedValue(undefined),
  generateWeeklyReport: vi.fn().mockResolvedValue(undefined),
}));

// ─── Auth context helpers ─────────────────────────────────────────────────────
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
});

describe("videos.list", () => {
  it("returns the video list", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const videos = await caller.videos.list({});
    expect(Array.isArray(videos)).toBe(true);
    expect(videos[0]?.videoId).toBe("yt_abc123");
    expect(videos[0]?.influencerName).toBe("Levi");
    expect(videos[0]?.platform).toBe("YouTube");
  });
});

describe("videos.create", () => {
  it("creates a video with required fields and returns a videoId", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.videos.create({
      influencerName: "NoBs",
      platform: "YouTube",
      videoUrl: "https://youtube.com/watch?v=test123",
      title: "Test Video NoBs",
      publishedDate: "2025-06-01",
    });
    expect(result.success).toBe(true);
    expect(result.videoId).toMatch(/^manual_/);
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
      videoId: "yt_abc123",
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
        videoId: "yt_abc123",
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
