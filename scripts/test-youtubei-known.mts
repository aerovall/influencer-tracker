/**
 * Test youtubei.js with a well-known public video
 */
import { Innertube } from "youtubei.js";

const yt = await Innertube.create({ generate_session_locally: true });

// Try a well-known video (Rick Astley - Never Gonna Give You Up)
const videoId = "dQw4w9WgXcQ";
console.log("Testing with known video:", videoId);

try {
  const info = await yt.getBasicInfo(videoId);
  console.log("basic_info:", {
    title: info?.basic_info?.title,
    view_count: info?.basic_info?.view_count,
    like_count: info?.basic_info?.like_count,
    duration: info?.basic_info?.duration,
    author: info?.basic_info?.author,
  });
} catch (e: any) {
  console.log("getBasicInfo error:", e.message);
}

// Try channel search to get video stats from channel listing
const channelId = "UC0SesdSOSgLERIZSj_FC8wQ"; // Levi's channel
console.log("\nFetching channel:", channelId);
try {
  const channel = await yt.getChannel(channelId);
  console.log("Channel type:", channel?.header?.type);
  
  const videos = await channel.getVideos();
  const items = (videos as any)?.videos ?? [];
  console.log("Video count:", items.length);
  
  if (items.length > 0) {
    const first = items[0] as any;
    console.log("First video:", {
      type: first?.type,
      id: first?.id,
      title: first?.title?.text,
      view_count: first?.view_count?.text,
      duration: first?.duration,
      published: first?.published?.text,
    });
    // Check all keys
    console.log("First video keys:", Object.keys(first));
    // Check if there are likes
    if (first?.accessibility_label) console.log("accessibility_label:", first.accessibility_label);
  }
} catch (e: any) {
  console.log("Channel error:", e.message);
}
