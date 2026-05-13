import { Innertube } from "youtubei.js";

const yt = await Innertube.create({ generate_session_locally: true });
const videoId = "dQw4w9WgXcQ";

const comments = await yt.getComments(videoId);

// Inspect the full structure of the first CommentThread
const first = comments.contents?.[0] as any;
console.log("=== Full CommentThread keys ===");
console.log(Object.keys(first));

if (first.comment) {
  console.log("\n=== Comment keys ===");
  console.log(Object.keys(first.comment));
  
  console.log("\n=== vote_count ===");
  console.log(JSON.stringify(first.comment.vote_count));
  
  console.log("\n=== action_buttons ===");
  console.log(JSON.stringify(first.comment.action_buttons)?.slice(0, 500));
  
  console.log("\n=== Full comment (truncated) ===");
  console.log(JSON.stringify(first.comment, null, 2).slice(0, 2000));
}

// Also check the header for total comment count
console.log("\n=== Header ===");
const header = comments.header as any;
console.log("Header keys:", Object.keys(header ?? {}));
console.log("count_text:", header?.count_text?.text);
console.log("comments_count:", header?.comments_count?.text);
