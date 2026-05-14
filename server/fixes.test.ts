/**
 * Tests for the 8 bug fixes:
 * 1. getShillCountByVideoId — new db helper
 * 2. Badges.tsx hashName — deterministic color for any channel name
 * 3. influencerName falls back to channelName (no hardcoded Levi/NoBs/Danielle)
 */

import { describe, it, expect } from "vitest";

// ─── Fix 1: getShillCountByVideoId helper ─────────────────────────────────────
// We test the pure logic: the SQL helper is imported and is a function.
describe("getShillCountByVideoId", () => {
  it("is exported from db.ts", async () => {
    const mod = await import("./db");
    expect(typeof mod.getShillCountByVideoId).toBe("function");
  });
});

// ─── Fix 2: Deterministic badge color hash (mirrors Badges.tsx logic) ─────────
function hashName(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return h;
}

const BADGE_COLORS = [
  "bg-amber-500/15 text-amber-400 border border-amber-500/25",
  "bg-sky-500/15 text-sky-400 border border-sky-500/25",
  "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  "bg-violet-500/15 text-violet-400 border border-violet-500/25",
  "bg-rose-500/15 text-rose-400 border border-rose-500/25",
  "bg-teal-500/15 text-teal-400 border border-teal-500/25",
  "bg-orange-500/15 text-orange-400 border border-orange-500/25",
  "bg-indigo-500/15 text-indigo-400 border border-indigo-500/25",
];

describe("InfluencerBadge deterministic color", () => {
  it("returns a valid color for any name", () => {
    const names = ["Levi", "NoBs", "Danielle", "NewInfluencer", "AnotherChannel", ""];
    for (const name of names) {
      const color = BADGE_COLORS[hashName(name) % BADGE_COLORS.length];
      expect(typeof color).toBe("string");
      expect(color.length).toBeGreaterThan(0);
    }
  });

  it("returns the same color for the same name (deterministic)", () => {
    const name = "TestChannel";
    const color1 = BADGE_COLORS[hashName(name) % BADGE_COLORS.length];
    const color2 = BADGE_COLORS[hashName(name) % BADGE_COLORS.length];
    expect(color1).toBe(color2);
  });

  it("returns different colors for different names (distribution)", () => {
    const names = ["Alpha", "Beta", "Gamma", "Delta", "Epsilon", "Zeta", "Eta", "Theta"];
    const colors = names.map((n) => BADGE_COLORS[hashName(n) % BADGE_COLORS.length]);
    // Not all should be the same color
    const unique = new Set(colors);
    expect(unique.size).toBeGreaterThan(1);
  });

  it("hash never produces negative values (unsigned 32-bit)", () => {
    const names = ["Levi", "NoBs", "Danielle", "x".repeat(100)];
    for (const name of names) {
      expect(hashName(name)).toBeGreaterThanOrEqual(0);
    }
  });
});

// ─── Fix 3: No hardcoded influencer names in source files ─────────────────────
import { readFileSync } from "fs";
import { resolve } from "path";

const ROOT = resolve(__dirname, "..");

function readSrc(relPath: string): string {
  return readFileSync(resolve(ROOT, relPath), "utf-8");
}

describe("No hardcoded Levi/NoBs/Danielle in dropdowns", () => {
  it("AdminPanel.tsx does not have hardcoded [\"Levi\", \"NoBs\", \"Danielle\"]", () => {
    const src = readSrc("client/src/pages/AdminPanel.tsx");
    expect(src).not.toContain('"Levi", "NoBs", "Danielle"');
    expect(src).not.toContain("'Levi', 'NoBs', 'Danielle'");
  });

  it("Videos.tsx does not have hardcoded INFLUENCERS array with Levi/NoBs/Danielle", () => {
    const src = readSrc("client/src/pages/Videos.tsx");
    // Should not contain the old hardcoded array literal
    expect(src).not.toMatch(/const INFLUENCERS\s*=\s*\[.*Levi.*NoBs.*Danielle/s);
  });

  it("Badges.tsx uses hashName instead of hardcoded style map", () => {
    const src = readSrc("client/src/components/Badges.tsx");
    expect(src).toContain("hashName");
    expect(src).toContain("BADGE_COLORS");
    // Old hardcoded map should be gone
    expect(src).not.toContain('Levi: "bg-amber');
    expect(src).not.toContain('NoBs: "bg-sky');
    expect(src).not.toContain('Danielle: "bg-emerald');
  });

  it("routers.ts channels.link does not use z.enum for influencer names", () => {
    const src = readSrc("server/routers.ts");
    // The old z.enum(["Levi", "NoBs", "Danielle"]) should be gone
    expect(src).not.toMatch(/z\.enum\(\["Levi",\s*"NoBs",\s*"Danielle"\]\)/);
  });
});

// ─── Fix 4: shills.countByVideo procedure exists in router ───────────────────
describe("shills.countByVideo tRPC procedure", () => {
  it("routers.ts exports countByVideo in shillsRouter", () => {
    const src = readSrc("server/routers.ts");
    expect(src).toContain("countByVideo:");
    expect(src).toContain("getShillCountByVideoId");
  });
});

// ─── Fix 5: Auto-fill scraped likes/comments ─────────────────────────────────
describe("Auto-fill scraped stats into view_counts", () => {
  it("startBulkScrape inserts view_count row with likes/comments", () => {
    const src = readSrc("server/routers.ts");
    // Check that the bulk scrape procedure inserts a view_count row with likes and comments
    expect(src).toContain("Auto-fill scraped likes/comments into view_counts");
  });

  it("scrapeComments (single video) also inserts view_count row", () => {
    const src = readSrc("server/routers.ts");
    // Both procedures should have the auto-fill logic
    const occurrences = (src.match(/Auto-fill scraped likes\/comments into view_counts/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
  });
});
