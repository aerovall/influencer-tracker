import { Innertube } from "youtubei.js";

const yt = await Innertube.create({ generate_session_locally: true });

// Test with Levi's first video: yt_4P1Tzx1SwgA -> raw ID: 4P1Tzx1SwgA
const videoId = "4P1Tzx1SwgA";

console.log("=== Testing getInfo for likes/comments ===");
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
  console.log("Header type:", comments.header?.type);
  // @ts-ignore
  const headerStr = JSON.stringify(comments.header).slice(0, 600);
  console.log("Header:", headerStr);
  const first = comments.contents?.[0];
  if (first) {
    console.log("\nFirst comment type:", first.type);
    // @ts-ignore
    const c = (first as any).comment;
    if (c) {
      console.log("Author:", c.author?.name);
      console.log("Text:", c.content?.text?.slice(0, 200));
      console.log("Likes:", c.vote_count?.text);
      console.log("Reply count:", c.reply_count);
    } else {
      console.log("First item raw:", JSON.stringify(first).slice(0, 500));
    }
  }
} catch (e: any) {
  console.log("getComments error:", e.message?.slice(0, 300));
}
