/**
 * Sync Engine
 * Orchestrates daily video discovery, view count snapshots, alert evaluation, and report generation.
 * Called by the cron scheduler and the manual "sync now" admin action.
 */

import { nanoid } from "nanoid";
import {
  getAllAlertThresholds,
  getAllInfluencers,
  getAllPlatformAccounts,
  getAllVideos,
  getActiveChannels,
  getAvgEngagementRate,
  getLatestViewCountByVideoId,
  getRecentSyncLogs,
  getUnreadAlertCount,
  getVideoByVideoId,
  getVideoStats,
  getViewCountTrends,
  insertAlertEvent,
  insertReport,
  insertSyncLog,
  insertVideo,
  insertViewCount,
  updateChannelLastChecked,
  updatePlatformAccountSyncTime,
  updateReportSchedule,
  updateSyncLog,
  updateVideoMeta,
} from "./db";
import { fetchChannelUploads, fetchChannelVideoStats } from "./channelEngine";
import { notifyOwner } from "./_core/notification";
import {
  fetchInstagramUserMedia,
  fetchInstagramVideoMetrics,
  fetchTikTokUserVideos,
  fetchTikTokVideoMetrics,
  fetchYouTubeChannelVideos,
  fetchYouTubeVideoMetrics,
} from "./platformApi";

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

// ─── Video Discovery ──────────────────────────────────────────────────────────

export async function runVideoDiscovery(): Promise<{ processed: number; errors: string[] }> {
  const accounts = await getAllPlatformAccounts();
  const allInfluencers = await getAllInfluencers();
  // Build a lookup map: influencerId -> influencer name (must be Levi, NoBs, or Danielle)
  const influencerNameMap = new Map<number, string>();
  for (const inf of allInfluencers) {
    influencerNameMap.set(inf.id, inf.name);
  }
  let processed = 0;
  const errors: string[] = [];

  for (const account of accounts) {
    if (!account.isActive) continue;

    const logResult = await insertSyncLog({
      jobType: "video_discovery",
      status: "running",
      influencerName: undefined,
      platform: account.platform,
      recordsProcessed: 0,
    });
    const logId = (logResult as unknown as { insertId: number }).insertId;

    try {
      let newVideos: Awaited<ReturnType<typeof fetchYouTubeChannelVideos>> = [];

      if (account.platform === "YouTube" && account.channelId) {
        newVideos = await fetchYouTubeChannelVideos(account.channelId);
      } else if (account.platform === "Instagram" && account.channelId) {
        newVideos = await fetchInstagramUserMedia(account.channelId);
      } else if (account.platform === "TikTok" && account.username) {
        newVideos = await fetchTikTokUserVideos(account.username);
      }

      // Resolve the influencer name from the DB — must be exactly Levi, NoBs, or Danielle
      const resolvedInfluencerName = influencerNameMap.get(account.influencerId) ?? null;
      if (!resolvedInfluencerName) {
        errors.push(`[${account.platform}] Cannot resolve influencer name for account id=${account.id}`);
        continue;
      }
      for (const video of newVideos) {
        await insertVideo({
          videoId: video.videoId,
          influencerName: resolvedInfluencerName,
          platform: account.platform,
          videoUrl: video.videoUrl,
          title: video.title,
          publishedDate: video.publishedDate,
          dateAdded: todayStr(),
          thumbnailUrl: video.thumbnailUrl,
          durationSeconds: video.durationSeconds,
          isSeen: false,  // triggers the Channels nav badge
        });
        processed++;
      }

      await updatePlatformAccountSyncTime(account.id);
      await updateSyncLog(logId, {
        status: "success",
        recordsProcessed: newVideos.length,
        completedAt: new Date(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`[${account.platform}] ${msg}`);
      await updateSyncLog(logId, {
        status: "failed",
        errorMessage: msg,
        completedAt: new Date(),
      });
    }
  }

  return { processed, errors };
}

// ─── View Count Snapshot ──────────────────────────────────────────────────────

export async function runViewCountSnapshot(): Promise<{ appended: number; skipped: number; errors: string[] }> {
  const today = todayStr();
  const allVideos = await getAllVideos();
  let appended = 0;
  let skipped = 0;
  const errors: string[] = [];

  // Group videos by platform for batch API calls
  const ytVideos = allVideos.filter((v) => v.platform === "YouTube");
  const igVideos = allVideos.filter((v) => v.platform === "Instagram");
  const ttVideos = allVideos.filter((v) => v.platform === "TikTok");

  const metricsMap = new Map<string, Awaited<ReturnType<typeof fetchYouTubeVideoMetrics>>[number]>();

  // YouTube batch
  if (ytVideos.length > 0) {
    try {
      const metrics = await fetchYouTubeVideoMetrics(ytVideos.map((v) => v.videoId));
      for (const m of metrics) metricsMap.set(m.videoId, m);
    } catch (err) {
      errors.push(`YouTube metrics: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Instagram per-account
  const igAccountIds = Array.from(new Set(igVideos.map((v) => v.videoId.split("_")[1])));
  if (igVideos.length > 0) {
    try {
      // Instagram requires per-media metrics
      const metrics = await fetchInstagramVideoMetrics("", igVideos.map((v) => v.videoId));
      for (const m of metrics) metricsMap.set(m.videoId, m);
    } catch (err) {
      errors.push(`Instagram metrics: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // TikTok batch
  if (ttVideos.length > 0) {
    try {
      const metrics = await fetchTikTokVideoMetrics(ttVideos.map((v) => v.videoId));
      for (const m of metrics) metricsMap.set(m.videoId, m);
    } catch (err) {
      errors.push(`TikTok metrics: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // Insert view count rows (append-only, never overwrite)
  for (const video of allVideos) {
    const m = metricsMap.get(video.videoId);
    if (!m) {
      // No metrics available — use last known count if exists
      const last = await getLatestViewCountByVideoId(video.videoId);
      if (last) {
        const inserted = await insertViewCount({
          countId: `cnt_${nanoid(10)}`,
          videoId: video.videoId,
          date: today,
          viewCount: last.viewCount,
          likes: last.likes ?? 0,
          comments: last.comments ?? 0,
          shares: last.shares ?? 0,
          engagementRate: last.engagementRate ?? "0",
        });
        if (inserted) appended++;
        else skipped++;
      }
      continue;
    }

    const inserted = await insertViewCount({
      countId: `cnt_${nanoid(10)}`,
      videoId: video.videoId,
      date: today,
      viewCount: m.viewCount,
      likes: m.likes,
      comments: m.comments,
      shares: m.shares,
      engagementRate: String(m.engagementRate),
    });

    if (inserted) appended++;
    else skipped++;
  }

  return { appended, skipped, errors };
}

// ─── Alert Evaluation ─────────────────────────────────────────────────────────

export async function runAlertEvaluation(): Promise<number> {
  const thresholds = await getAllAlertThresholds();
  const activeThresholds = thresholds.filter((t) => t.isActive);
  const trends = await getViewCountTrends(2); // last 2 days for growth rate
  let alertsFired = 0;

  // Build per-video latest metrics
  const videoMetrics = new Map<
    string,
    { viewCount: number; engagementRate: number; growthRate: number; likes: number; comments: number; shares: number }
  >();

  // Group by videoId, sorted by date
  const byVideo = new Map<string, typeof trends>();
  for (const row of trends) {
    if (!byVideo.has(row.videoId)) byVideo.set(row.videoId, []);
    byVideo.get(row.videoId)!.push(row);
  }

  for (const [videoId, rows] of Array.from(byVideo.entries())) {
    const sorted = rows.sort((a: { date: string }, b: { date: string }) => a.date.localeCompare(b.date));
    const latest = sorted[sorted.length - 1];
    const prev = sorted[sorted.length - 2];
    if (!latest) continue;

    const latestViews = Number(latest.viewCount);
    const prevViews = prev ? Number(prev.viewCount) : latestViews;
    const growthRate = prevViews > 0 ? ((latestViews - prevViews) / prevViews) * 100 : 0;

    videoMetrics.set(videoId, {
      viewCount: latestViews,
      engagementRate: parseFloat(String(latest.engagementRate ?? 0)),
      growthRate: parseFloat(growthRate.toFixed(4)),
      likes: Number(latest.likes ?? 0),
      comments: Number(latest.comments ?? 0),
      shares: 0,
    });
  }

  for (const threshold of activeThresholds) {
    for (const [videoId, metrics] of Array.from(videoMetrics.entries())) {
      // Filter by influencer/platform if scoped
      const videoRow = trends.find((t) => t.videoId === videoId);
      if (threshold.influencerName && videoRow?.influencerName !== threshold.influencerName) continue;
      if (threshold.platform && videoRow?.platform !== threshold.platform) continue;

      const value = metrics[threshold.metric as keyof typeof metrics] as number;
      const thresh = parseFloat(String(threshold.thresholdValue));

      let triggered = false;
      if (threshold.operator === "gt" && value > thresh) triggered = true;
      if (threshold.operator === "gte" && value >= thresh) triggered = true;
      if (threshold.operator === "lt" && value < thresh) triggered = true;
      if (threshold.operator === "lte" && value <= thresh) triggered = true;

      if (triggered) {
        const metricLabel = threshold.metric.replace(/_/g, " ");
        const message = `[${threshold.alertType.toUpperCase()}] "${videoRow?.title ?? videoId}" — ${metricLabel} is ${value.toFixed(2)} (threshold: ${threshold.operator} ${thresh})`;

        await insertAlertEvent({
          thresholdId: threshold.id,
          videoId,
          triggeredValue: String(value),
          message,
        });

        await notifyOwner({ title: `Alert: ${threshold.name}`, content: message });
        alertsFired++;
      }
    }
  }

  return alertsFired;
}

// ─── Report Generation ────────────────────────────────────────────────────────

export async function generateDailyReport(): Promise<void> {
  const today = todayStr();
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0]!;

  const stats = await getVideoStats();
  const avgEng = await getAvgEngagementRate();
  const alertCount = await getUnreadAlertCount();
  const trends = await getViewCountTrends(1);

  const totalViewsToday = trends.reduce((sum, t) => sum + Number(t.viewCount), 0);
  const totalLikesToday = trends.reduce((sum, t) => sum + Number(t.likes ?? 0), 0);
  const totalCommentsToday = trends.reduce((sum, t) => sum + Number(t.comments ?? 0), 0);

  // Per-channel breakdown
  const channelMap = new Map<string, { views: number; likes: number; comments: number; videos: typeof trends }>();
  for (const t of trends) {
    const key = t.influencerName ?? "Unknown";
    if (!channelMap.has(key)) channelMap.set(key, { views: 0, likes: 0, comments: 0, videos: [] });
    const entry = channelMap.get(key)!;
    entry.views += Number(t.viewCount);
    entry.likes += Number(t.likes ?? 0);
    entry.comments += Number(t.comments ?? 0);
    entry.videos.push(t);
  }

  // Get shill counts per channel from DB
  const { getAllShills } = await import("./db");
  const allShills = await getAllShills();
  const shillsByChannel = new Map<string, number>();
  for (const s of allShills) {
    const key = s.influencerName ?? "Unknown";
    shillsByChannel.set(key, (shillsByChannel.get(key) ?? 0) + 1);
  }

  const perChannelSections = Array.from(channelMap.entries())
    .map(([channelName, data]) => {
      const top5 = data.videos
        .sort((a, b) => Number(b.viewCount) - Number(a.viewCount))
        .slice(0, 5)
        .map((v) => `  • ${v.title}: ${Number(v.viewCount).toLocaleString()} views`)
        .join("\n");
      const sponsorships = shillsByChannel.get(channelName) ?? 0;
      return `### ${channelName}
- Views: ${data.views.toLocaleString()}  |  Likes: ${data.likes.toLocaleString()}  |  Comments: ${data.comments.toLocaleString()}  |  Sponsorships: ${sponsorships}
**Top 5 Videos:**
${top5 || "  No view data today."}`.trim();
    })
    .join("\n\n");

  const topVideos = trends
    .sort((a, b) => Number(b.viewCount) - Number(a.viewCount))
    .slice(0, 5)
    .map((v) => `• ${v.title} (${v.influencerName} / ${v.platform}): ${Number(v.viewCount).toLocaleString()} views`)
    .join("\n");

  const content = `## Daily Report — ${today}

**Period:** ${yesterdayStr} → ${today}
**Total Active Videos:** ${stats.total}
**Total Views Today:** ${totalViewsToday.toLocaleString()}
**Total Likes Today:** ${totalLikesToday.toLocaleString()}
**Total Comments Today:** ${totalCommentsToday.toLocaleString()}
**Average Engagement Rate:** ${Number(avgEng).toFixed(2)}%
**Unread Alerts:** ${alertCount}

### Top 5 Videos by Views (Overall)
${topVideos || "No view data available for today."}

---

## Per-Channel Breakdown

${perChannelSections || "No channel data available."}

---

### Videos by Platform
${stats.byPlatform.map((r) => `• ${r.platform}: ${r.count} videos`).join("\n")}`;

  await insertReport({
    type: "daily",
    title: `Daily Report — ${today}`,
    content,
    periodStart: yesterdayStr,
    periodEnd: today,
    totalVideos: stats.total,
    totalViews: totalViewsToday,
    avgEngagementRate: String(Number(avgEng).toFixed(4)),
    alertsTriggered: alertCount,
  });

  await updateReportSchedule("daily", { lastRunAt: new Date() });
  await notifyOwner({ title: `Daily Report Ready — ${today}`, content: `Your daily influencer tracking report is ready. ${stats.total} videos tracked, ${totalViewsToday.toLocaleString()} total views today, ${alertCount} unread alerts.` });
}

export async function generateWeeklyReport(): Promise<void> {
  const today = todayStr();
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekAgoStr = weekAgo.toISOString().split("T")[0]!;

  const stats = await getVideoStats();
  const avgEng = await getAvgEngagementRate();
  const trends = await getViewCountTrends(7);
  const alertCount = await getUnreadAlertCount();

  const totalViewsWeek = trends.reduce((sum, t) => sum + Number(t.viewCount), 0);
  const topVideos = trends
    .sort((a, b) => Number(b.viewCount) - Number(a.viewCount))
    .slice(0, 10)
    .map((v) => `• ${v.title} (${v.influencerName} / ${v.platform}): ${Number(v.viewCount).toLocaleString()} views`)
    .join("\n");

  const content = `## Weekly Report — ${weekAgoStr} to ${today}

**Period:** ${weekAgoStr} → ${today}
**Total Active Videos:** ${stats.total}
**Total Views This Week:** ${totalViewsWeek.toLocaleString()}
**Average Engagement Rate:** ${Number(avgEng).toFixed(2)}%
**Alerts Triggered This Week:** ${alertCount}

### Top 10 Videos This Week
${topVideos || "No view data available for this week."}

### Videos by Influencer
${stats.byInfluencer.map((r) => `• ${r.influencerName}: ${r.count} videos`).join("\n")}

### Videos by Platform
${stats.byPlatform.map((r) => `• ${r.platform}: ${r.count} videos`).join("\n")}`;

  await insertReport({
    type: "weekly",
    title: `Weekly Report — ${weekAgoStr} to ${today}`,
    content,
    periodStart: weekAgoStr,
    periodEnd: today,
    totalVideos: stats.total,
    totalViews: totalViewsWeek,
    avgEngagementRate: String(Number(avgEng).toFixed(4)),
    alertsTriggered: alertCount,
  });

  await updateReportSchedule("weekly", { lastRunAt: new Date() });
  await notifyOwner({ title: `Weekly Report Ready — ${today}`, content: `Your weekly influencer tracking report is ready. ${stats.total} videos tracked, ${totalViewsWeek.toLocaleString()} total views this week.` });
}

// ─── Full Daily Job ───────────────────────────────────────────────────────────

/**
 * Sync all linked YouTube channels: detect new uploads and snapshot today's stats.
 */
export async function runChannelSync(): Promise<{ newVideos: number; updatedStats: number; errors: string[] }> {
  const channels = await getActiveChannels();
  let newVideos = 0;
  let updatedStats = 0;
  const errors: string[] = [];

  for (const channel of channels) {
    try {
      // Fetch uploads AND stats in a single channel listing call.
      // fetchChannelVideoStats returns a map rawId → stats from the Videos tab.
      // fetchChannelUploads uses the same listing so we combine both in one pass.
      const uploads = await fetchChannelUploads(channel.channelId, 30);
      // Build a stats map directly from the upload objects (they already carry stats)
      const statsMap = new Map(uploads.map((u) => [u.videoId, u]));

      for (const upload of uploads) {
        const existing = await getVideoByVideoId(upload.ytVideoId);

        if (!existing) {
          // New video discovered on this channel
          await insertVideo({
            videoId: upload.ytVideoId,
            influencerName: channel.channelName,
            platform: "YouTube",
            channelId: channel.channelId,
            videoUrl: upload.videoUrl,
            title: upload.title,
            publishedDate: upload.publishedDate,
            dateAdded: todayStr(),
            thumbnailUrl: upload.thumbnailUrl,
            durationSeconds: upload.durationSeconds,
            isActive: true,
            isSeen: false,  // triggers the Channels nav badge
          });
          newVideos++;
        } else if (upload.title && upload.title !== "Untitled" && existing.title === "Untitled") {
          // Back-fill title/duration for previously inserted videos that had no stats
          await updateVideoMeta(upload.ytVideoId, {
            title: upload.title,
            durationSeconds: upload.durationSeconds,
            thumbnailUrl: upload.thumbnailUrl,
          });
        }

        // Snapshot today's stats (skip if already done today)
        if (upload.viewCount > 0 || upload.durationSeconds > 0) {
          const countId = `vc_${upload.ytVideoId}_${todayStr()}`;
          try {
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
            updatedStats++;
          } catch {
            // duplicate key = already snapshotted today, skip silently
          }
        }
      }

      await updateChannelLastChecked(channel.channelId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`Channel ${channel.channelId} (${channel.channelName}): ${msg}`);
      console.error(`[ChannelSync] Error for ${channel.channelId}:`, err);
    }
  }

  return { newVideos, updatedStats, errors };
}

// ─── Social Account Sync ─────────────────────────────────────────────────────
/**
 * Sync all active Instagram and X accounts:
 * - Fetch recent posts and upsert them
 * - Append a daily snapshot for each post (append-only, never overwrite)
 */
export async function runSocialAccountSync(): Promise<{ newPosts: number; snapshots: number; errors: string[] }> {
  const { getAllSocialAccounts, upsertSocialPost, insertSocialPostSnapshot, updateSocialAccountLastChecked } = await import("./db");
  const { fetchInstagramPosts, fetchXPosts, toSnapshotId } = await import("./socialEngine");
  const today = new Date().toISOString().split("T")[0]!;
  let newPosts = 0;
  let snapshots = 0;
  const errors: string[] = [];

  try {
    const accounts = await getAllSocialAccounts();
    for (const account of accounts) {
      try {
        const posts = account.platform === "Instagram"
          ? await fetchInstagramPosts(account.handle, 20)
          : await fetchXPosts(account.handle, 20);

        for (const post of posts) {
          try {
            await upsertSocialPost({
              postId: post.postId,
              accountId: post.accountId,
              platform: post.platform,
              postUrl: post.postUrl,
              title: post.title ?? undefined,
              publishedDate: post.publishedDate ?? undefined,
              thumbnailUrl: post.thumbnailUrl ?? undefined,
            });
            newPosts++;

            // Append daily snapshot (never overwrite)
            const snapshotId = toSnapshotId(post.postId, today);
            await insertSocialPostSnapshot({
              snapshotId,
              postId: post.postId,
              accountId: post.accountId,
              platform: post.platform,
              date: today,
              views: post.views,
              impressions: post.impressions,
              likes: post.likes,
              comments: post.comments,
              shares: post.shares,
              retweets: post.retweets,
            });
            snapshots++;
          } catch (e) {
            errors.push(`Post ${post.postId}: ${String(e)}`);
          }
        }

        await updateSocialAccountLastChecked(account.accountId, posts.length);
      } catch (e) {
        errors.push(`Account ${account.accountId}: ${String(e)}`);
      }
    }
  } catch (e) {
    errors.push(`Social sync failed: ${String(e)}`);
  }

  return { newPosts, snapshots, errors };
}

export async function runFullDailySync(): Promise<{
  discovery: Awaited<ReturnType<typeof runVideoDiscovery>>;
  snapshot: Awaited<ReturnType<typeof runViewCountSnapshot>>;
  channelSync: Awaited<ReturnType<typeof runChannelSync>>;
  socialSync: Awaited<ReturnType<typeof runSocialAccountSync>>;
  alerts: number;
}> {
  // Run channel sync + social sync + legacy platform discovery in parallel
  const [discovery, channelSync, socialSync] = await Promise.all([
    runVideoDiscovery(),
    runChannelSync(),
    runSocialAccountSync(),
  ]);
  const snapshot = await runViewCountSnapshot();
  const alerts = await runAlertEvaluation();
  await generateDailyReport();
  return { discovery, snapshot, channelSync, socialSync, alerts };
}
