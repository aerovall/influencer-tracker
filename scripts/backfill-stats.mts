/**
 * Back-fill script: fetch real stats from YouTube and update all existing videos
 * that have title="Untitled" or durationSeconds=0 in the DB.
 */
import { fetchChannelUploads } from "../server/channelEngine.js";
import { getDb } from "../server/db.js";
import { videos, viewCounts } from "../drizzle/schema.js";
import { eq, and } from "drizzle-orm";

const CHANNEL_ID = "UC0SesdSOSgLERIZSj_FC8wQ";

function todayStr() {
  return new Date().toISOString().split("T")[0]!;
}

const db = await getDb();
if (!db) {
  console.error("DB unavailable");
  process.exit(1);
}

console.log("Fetching latest uploads from YouTube...");
const uploads = await fetchChannelUploads(CHANNEL_ID, 30);
console.log(`Got ${uploads.length} videos from channel listing`);

let updated = 0;
let statsInserted = 0;

for (const upload of uploads) {
  // Update title/duration/thumbnail on the video row
  const result = await db
    .update(videos)
    .set({
      title: upload.title,
      durationSeconds: upload.durationSeconds,
      thumbnailUrl: upload.thumbnailUrl,
    })
    .where(eq(videos.videoId, upload.ytVideoId));
  
  if ((result as any)?.[0]?.affectedRows > 0) {
    updated++;
    console.log(`  Updated: ${upload.ytVideoId} → "${upload.title.slice(0, 45)}" dur=${upload.durationSeconds}s`);
  }

  // Upsert today's view count
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
  statsInserted++;
}

console.log(`\nDone! Updated ${updated} video rows, upserted ${statsInserted} view_count rows.`);
