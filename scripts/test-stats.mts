import { fetchChannelUploads } from "../server/channelEngine.js";

const uploads = await fetchChannelUploads("UC0SesdSOSgLERIZSj_FC8wQ", 5);
console.log(`Fetched ${uploads.length} videos:`);
for (const u of uploads) {
  console.log(`  ${u.ytVideoId}: "${u.title.slice(0, 45)}" views=${u.viewCount} dur=${u.durationSeconds}s pub=${u.publishedDate}`);
}
