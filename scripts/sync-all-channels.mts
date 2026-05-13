/**
 * Manual sync script — fetches latest uploads and updates subscriber counts
 * for all linked YouTube channels using InnerTube (no API key required).
 */
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import { youtubeChannels, videos, viewCounts } from "../drizzle/schema.js";
import { eq, and } from "drizzle-orm";
import { fetchChannelUploads, resolveChannel } from "../server/channelEngine.js";

const conn = await mysql.createConnection(process.env.DATABASE_URL!);
const db = drizzle(conn);

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

// Get all active channels
const channels = await db
  .select()
  .from(youtubeChannels)
  .where(eq(youtubeChannels.isActive, true));

console.log(`Found ${channels.length} active channels.`);

for (const channel of channels) {
  console.log(`\n=== Syncing: ${channel.channelName} (${channel.channelId}) ===`);

  try {
    // Re-resolve to get fresh subscriber count
    const info = await resolveChannel(channel.channelId);
    console.log(`  Subscriber count: ${info.subscriberCount}`);

    // Update subscriber count in DB
    if (info.subscriberCount > 0) {
      await db
        .update(youtubeChannels)
        .set({ subscriberCount: info.subscriberCount })
        .where(eq(youtubeChannels.channelId, channel.channelId));
      console.log(`  Updated subscriber count to ${info.subscriberCount}`);
    }

    // Fetch latest uploads with stats
    const uploads = await fetchChannelUploads(channel.channelId, 30);
    console.log(`  Fetched ${uploads.length} videos from channel listing`);

    let newVideos = 0;
    let updatedStats = 0;

    for (const upload of uploads) {
      // Check if video exists
      const existing = await db
        .select()
        .from(videos)
        .where(eq(videos.videoId, upload.ytVideoId))
        .limit(1);

      if (existing.length === 0) {
        // Insert new video
        await db.insert(videos).values({
          videoId: upload.ytVideoId,
          influencerName: channel.influencerName ?? "Unknown",
          platform: "YouTube",
          channelId: channel.channelId,
          videoUrl: upload.videoUrl,
          title: upload.title,
          publishedDate: upload.publishedDate,
          dateAdded: todayStr(),
          thumbnailUrl: upload.thumbnailUrl,
          durationSeconds: upload.durationSeconds,
          isActive: true,
          isSeen: false,
        });
        newVideos++;
      } else if (upload.title && upload.title !== "Untitled" && existing[0]!.title === "Untitled") {
        // Back-fill title/duration
        await db
          .update(videos)
          .set({
            title: upload.title,
            durationSeconds: upload.durationSeconds,
            thumbnailUrl: upload.thumbnailUrl,
          })
          .where(eq(videos.videoId, upload.ytVideoId));
      }

      // Upsert view count for today
      const countId = `vc_${upload.ytVideoId}_${todayStr()}`;
      await db
        .insert(viewCounts)
        .values({
          countId,
          videoId: upload.ytVideoId,
          date: todayStr(),
          viewCount: upload.viewCount,
          likes: upload.likeCount,
          comments: 0,
          shares: 0,
          engagementRate: "0",
        })
        .onDuplicateKeyUpdate({
          set: {
            viewCount: upload.viewCount,
            likes: upload.likeCount,
          },
        });
      updatedStats++;
    }

    // Update last_checked_at
    await db
      .update(youtubeChannels)
      .set({ lastCheckedAt: new Date() })
      .where(eq(youtubeChannels.channelId, channel.channelId));

    console.log(`  New videos: ${newVideos}, Updated stats: ${updatedStats}`);
  } catch (err: any) {
    console.error(`  ERROR: ${err.message}`);
  }
}

await conn.end();
console.log("\nSync complete!");
