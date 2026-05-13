import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runFullDailySync, generateDailyReport, generateWeeklyReport } from "./syncEngine";
import { getReportSchedules, getAllVideos, upsertCommentSnapshot } from "./db";
import { scrapeVideoBatch } from "./commentEngine";

// ─── /api/scheduled/daily-sync ────────────────────────────────────────────────
// Triggered by the Heartbeat cron daily. Runs the full sync pipeline:
// video discovery → view count snapshot → alert evaluation → daily report.
export async function dailySyncHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    console.log(`[ScheduledSync] Triggered by cron task: ${user.taskUid}`);
    const result = await runFullDailySync();

    // Check if weekly report is due (Monday = day 1)
    const schedules = await getReportSchedules();
    const weeklySchedule = schedules.find((s) => s.frequency === "weekly");
    const today = new Date();
    if (weeklySchedule?.isActive && today.getDay() === (weeklySchedule.weeklyDayOfWeek ?? 1)) {
      await generateWeeklyReport();
      console.log("[ScheduledSync] Weekly report generated");
    }

    console.log(`[ScheduledSync] Complete — snapshot: ${JSON.stringify(result.snapshot)}, alerts: ${result.alerts}`);
    return res.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[ScheduledSync] Error:", message);
    return res.status(500).json({
      error: message,
      stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}

// ─── /api/scheduled/daily-report ─────────────────────────────────────────────
// Standalone daily report generation (separate from full sync if needed).
export async function dailyReportHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }
    await generateDailyReport();
    return res.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ error: message, timestamp: new Date().toISOString() });
  }
}

// ─── /api/scheduled/daily-comment-scrape ─────────────────────────────────────
// Triggered by the Heartbeat cron daily. Scrapes likes, comment counts, and
// top comments for all tracked YouTube videos using InnerTube (no API key needed).
export async function dailyCommentScrapeHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) {
      return res.status(403).json({ error: "cron-only endpoint" });
    }

    console.log(`[CommentScrape] Triggered by cron task: ${user.taskUid}`);

    // Get all tracked YouTube video IDs (skip Instagram/TikTok posts)
    const videos = await getAllVideos({ platform: "YouTube" });
    // Strip yt_ prefix for scraping; only include videos with a valid raw ID
    const videoIds = videos
      .map((v: any) => (v.videoId as string).replace(/^yt_/, ""))
      .filter((id: string) => id.length >= 11);

    if (videoIds.length === 0) {
      return res.json({ ok: true, scraped: 0, message: "No videos to scrape" });
    }

    console.log(`[CommentScrape] Scraping ${videoIds.length} videos...`);
    const results = await scrapeVideoBatch(videoIds);

    const today = new Date().toISOString().split("T")[0];
    let saved = 0;
    for (const r of results) {
      // r.videoId is the raw 11-char ID; DB uses yt_ prefixed form
      const dbVideoId = `yt_${r.videoId}`;
      if (!r.error) {
        await upsertCommentSnapshot({
          videoId: dbVideoId,
          date: today,
          likeCount: r.likeCount,
          commentCount: r.commentCount,
          commentCountNum: r.commentCountNum,
          topCommentId: r.topComment?.commentId ?? null,
          topCommentAuthor: r.topComment?.author ?? null,
          topCommentText: r.topComment?.text ?? null,
          topCommentLikes: r.topComment?.likeCount ?? null,
          topCommentLikesNum: r.topComment?.likeCountNum ?? null,
          topCommentReplyCount: r.topComment?.replyCount ?? 0,
          scrapeError: null,
          scrapedAt: r.scrapedAt,
        });
        saved++;
      } else {
        await upsertCommentSnapshot({
          videoId: dbVideoId,
          date: today,
          scrapeError: r.error,
          scrapedAt: r.scrapedAt,
        });
      }
    }

    console.log(`[CommentScrape] Complete — scraped ${saved}/${videoIds.length} videos`);
    return res.json({ ok: true, scraped: saved, total: videoIds.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[CommentScrape] Error:", message);
    return res.status(500).json({
      error: message,
      stack,
      context: { url: req.url },
      timestamp: new Date().toISOString(),
    });
  }
}
