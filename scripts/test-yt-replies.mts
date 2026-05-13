import { Innertube } from "youtubei.js";

const yt = await Innertube.create({ generate_session_locally: true });
const videoId = "dQw4w9WgXcQ";

const comments = await yt.getComments(videoId);

// Find the top comment by like count
let topThread: any = null;
let topLikes = -1;

for (const item of (comments.contents ?? [])) {
  const c = (item as any).comment;
  if (!c) continue;
  const likeStr = c.like_count ?? "0";
  // Parse like count: "239K" -> 239000, "1.8K" -> 1800, "125" -> 125
  const parsed = parseFloat(likeStr.replace("K", "")) * (likeStr.includes("K") ? 1000 : 1);
  if (parsed > topLikes) {
    topLikes = parsed;
    topThread = item;
  }
}

const topComment = topThread?.comment;
console.log("Top comment by likes:");
console.log("  Author:", topComment?.author?.name);
console.log("  Text:", topComment?.content?.runs?.map((r: any) => r.text).join("").slice(0, 150));
console.log("  Likes:", topComment?.like_count);
console.log("  Reply count:", topComment?.reply_count);
console.log("  has_replies:", topThread?.has_replies);

// Try different ways to get replies
console.log("\n=== Thread keys ===");
console.log(Object.keys(topThread ?? {}));

// Check comment_replies_data
const repliesData = topThread?.comment_replies_data;
console.log("\ncomment_replies_data:", JSON.stringify(repliesData)?.slice(0, 300));

// Try getReplies if it exists
if (typeof topThread?.getReplies === 'function') {
  try {
    const repliesPage = await topThread.getReplies();
    console.log("\nrepliesPage type:", repliesPage?.type);
    console.log("repliesPage keys:", Object.keys(repliesPage ?? {}));
    console.log("repliesPage.contents:", repliesPage?.contents?.length);
    
    // Try mutations
    const mutations = (repliesPage as any)?.mutations;
    console.log("mutations:", JSON.stringify(mutations)?.slice(0, 300));
    
    // Try comments property
    const replyComments = (repliesPage as any)?.comments;
    console.log("replyComments:", replyComments?.length);
    
    // Full inspection
    console.log("\nFull repliesPage:", JSON.stringify(repliesPage, null, 2).slice(0, 1500));
  } catch (e: any) {
    console.log("getReplies error:", e.message?.slice(0, 300));
  }
}
