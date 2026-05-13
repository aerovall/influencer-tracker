import { Innertube } from "youtubei.js";

const yt = await Innertube.create({ generate_session_locally: true });
const videoId = "dQw4w9WgXcQ";

const comments = await yt.getComments(videoId);

// Check like_count field directly
for (const item of (comments.contents ?? []).slice(0, 5)) {
  const c = (item as any).comment;
  if (!c) continue;
  
  const text = c.content?.runs?.map((r: any) => r.text).join("") ?? "";
  const likeCount = c.like_count;
  const likeCountA11y = c.like_count_a11y;
  const replyCount = c.reply_count;
  const author = c.author?.name;
  
  console.log(`---`);
  console.log(`Author: ${author}`);
  console.log(`Text: ${text.slice(0, 100)}`);
  console.log(`like_count: ${JSON.stringify(likeCount)}`);
  console.log(`like_count_a11y: ${JSON.stringify(likeCountA11y)}`);
  console.log(`reply_count: ${replyCount}`);
}

// Check header for total comment count
const header = comments.header as any;
console.log("\n=== Header fields ===");
console.log("count_text:", header?.count_text?.text);
console.log("comments_count:", header?.comments_count?.text);
// Try all string fields
for (const [k, v] of Object.entries(header ?? {})) {
  if (typeof v === 'object' && v !== null && 'text' in (v as any)) {
    console.log(`header.${k}.text:`, (v as any).text);
  }
}

// Test fetching replies for the first comment
const firstThread = (comments.contents?.[0] as any);
if (firstThread?.has_replies) {
  console.log("\n=== Fetching replies for first comment ===");
  try {
    const replies = await firstThread.getReplies();
    console.log("Reply count:", replies.contents?.length);
    const firstReply = (replies.contents?.[0] as any)?.comment;
    if (firstReply) {
      console.log("First reply author:", firstReply.author?.name);
      console.log("First reply text:", firstReply.content?.runs?.map((r: any) => r.text).join("").slice(0, 100));
      console.log("First reply likes:", firstReply.like_count);
    }
  } catch (e: any) {
    console.log("getReplies error:", e.message?.slice(0, 200));
  }
}
