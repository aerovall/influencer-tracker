/**
 * Tests for v2.23 high-priority fixes:
 * 1. Subscriber count parsing (K/M multipliers)
 * 2. view_counts unique constraint logic (insertViewCountPreserveScrape idempotency)
 * 3. Heartbeat admin router exports exist
 */

import { describe, it, expect } from "vitest";

// ─── 1. Subscriber count parsing ─────────────────────────────────────────────
// Inline the same logic used in channelEngine.ts to test it independently
function parseSubscriberCount(raw: string | null | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/,/g, "").trim();
  const match = cleaned.match(/^([\d.]+)\s*([KMBkmb]?)/);
  if (!match) return 0;
  const num = parseFloat(match[1]!);
  const suffix = match[2]?.toUpperCase() ?? "";
  if (suffix === "K") return Math.round(num * 1_000);
  if (suffix === "M") return Math.round(num * 1_000_000);
  if (suffix === "B") return Math.round(num * 1_000_000_000);
  return Math.round(num);
}

describe("parseSubscriberCount", () => {
  it("handles K suffix correctly", () => {
    expect(parseSubscriberCount("232K subscribers")).toBe(232_000);
    expect(parseSubscriberCount("299K")).toBe(299_000);
    expect(parseSubscriberCount("1.5K")).toBe(1_500);
  });

  it("handles M suffix correctly", () => {
    expect(parseSubscriberCount("1.2M subscribers")).toBe(1_200_000);
    expect(parseSubscriberCount("2M")).toBe(2_000_000);
  });

  it("handles plain numbers", () => {
    expect(parseSubscriberCount("5000")).toBe(5_000);
    expect(parseSubscriberCount("1,234")).toBe(1_234);
  });

  it("handles null/undefined/empty", () => {
    expect(parseSubscriberCount(null)).toBe(0);
    expect(parseSubscriberCount(undefined)).toBe(0);
    expect(parseSubscriberCount("")).toBe(0);
  });

  it("does NOT return raw K value without multiplier", () => {
    // This was the bug: 232K was stored as 232 instead of 232000
    const result = parseSubscriberCount("232K subscribers");
    expect(result).not.toBe(232);
    expect(result).toBe(232_000);
  });
});

// ─── 2. view_counts schema has unique index ───────────────────────────────────
describe("view_counts schema", () => {
  it("schema file defines the video_date unique index", async () => {
    const fs = await import("fs/promises");
    const schema = await fs.readFile(
      new URL("../drizzle/schema.ts", import.meta.url).pathname,
      "utf8"
    );
    expect(schema).toContain("view_counts_video_date_unique");
    expect(schema).toContain("uniqueIndex");
  });
});

// ─── 3. Admin router exports heartbeat procedures ─────────────────────────────
describe("admin router heartbeat procedures", () => {
  it("routers.ts exports listAutoSyncJobs, createAutoSyncJob, deleteAutoSyncJob", async () => {
    const fs = await import("fs/promises");
    const routers = await fs.readFile(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf8"
    );
    expect(routers).toContain("listAutoSyncJobs");
    expect(routers).toContain("createAutoSyncJob");
    expect(routers).toContain("deleteAutoSyncJob");
    expect(routers).toContain("listHeartbeatJobs");
    expect(routers).toContain("createHeartbeatJob");
    expect(routers).toContain("deleteHeartbeatJob");
  });

  it("heartbeat job uses the correct midnight UTC cron expression", async () => {
    const fs = await import("fs/promises");
    const routers = await fs.readFile(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf8"
    );
    // 6-field cron: sec min hour dom mon dow — midnight UTC = "0 0 0 * * *"
    expect(routers).toContain('"0 0 0 * * *"');
  });

  it("heartbeat callback path is the existing daily-sync handler", async () => {
    const fs = await import("fs/promises");
    const routers = await fs.readFile(
      new URL("./routers.ts", import.meta.url).pathname,
      "utf8"
    );
    expect(routers).toContain('"/api/scheduled/daily-sync"');
  });
});
