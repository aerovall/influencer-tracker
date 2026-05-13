import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import { runFullDailySync, generateDailyReport, generateWeeklyReport } from "./syncEngine";
import { getReportSchedules } from "./db";

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
