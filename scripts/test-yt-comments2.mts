import { Innertube } from "youtubei.js";

const yt = await Innertube.create({ generate_session_locally: true });

// Test with a known public video - Rick Astley Never Gonna Give You Up
const videoId = "dQw4w9WgXcQ";

console.log("=== Testing getInfo for likes/comments (Rick Astley) ===");
try {
  const info = await yt.getInfo(videoId);
  const basic = info.basic_info;
  console.log("Title:", basic.title);
  console.log("Views:", basic.view_count);
  console.log("Likes:", basic.like_count);
  console.log("Comment count:", basic.comment_count);
} catch (e: any) {
  console.log("getInfo error:", e.message?.slice(0, 300));
}

console.log("\n=== Testing getComments ===");
try {
  const comments = await yt.getComments(videoId);
  console.log("Total contents:", comments.contents?.length);
  
  // Try to find comment threads
  for (const item of (comments.contents ?? []).slice(0, 3)) {
    console.log("\nItem type:", item.type);
    const c = (item as any).comment;
    if (c) {
      console.log("  Author:", c.author?.name);
      console.log("  Text:", JSON.stringify(c.content?.runs?.map((r: any) => r.text).join("")).slice(0, 150));
      console.log("  Likes:", c.vote_count?.text);
      console.log("  Replies:", c.reply_count);
    } else {
      console.log("  Raw:", JSON.stringify(item).slice(0, 300));
    }
  }
} catch (e: any) {
  console.log("getComments error:", e.message?.slice(0, 300));
}
