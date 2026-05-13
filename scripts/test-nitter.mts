/**
 * Check nitter.net HTML structure for follower counts and tweets.
 */

const HANDLE = "LeviCrypto";

const res = await fetch(`https://nitter.net/${HANDLE}`, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "Accept": "text/html,*/*",
  }
});
console.log("Status:", res.status);
const html = await res.text();
console.log("HTML length:", html.length);

// Check if it's a real profile page or a placeholder
if (html.length < 5000) {
  console.log("Short response:", html.slice(0, 500));
} else {
  // Look for follower count patterns
  const patterns = [
    /followers/gi,
    /following/gi,
    /tweets/gi,
  ];
  
  for (const pattern of patterns) {
    const matches = Array.from(html.matchAll(pattern));
    console.log(`"${pattern.source}" occurrences: ${matches.length}`);
  }
  
  // Find the stats section
  const statsMatch = html.match(/<div class="profile-stats">([\s\S]{0,500})/);
  if (statsMatch) {
    console.log("\nProfile stats section:", statsMatch[1]);
  }
  
  // Look for any number near "follower"
  const followerContext = html.match(/.{0,50}follower.{0,50}/gi);
  if (followerContext) {
    console.log("\nFollower contexts:", followerContext.slice(0, 5).join("\n"));
  }
  
  // Look for tweet items
  const tweetMatches = Array.from(html.matchAll(/class="tweet-link" href="\/[^/]+\/status\/(\d+)"/g));
  console.log(`\nTweet IDs found: ${tweetMatches.length}`);
  if (tweetMatches.length > 0) {
    console.log("First 3 tweet IDs:", tweetMatches.slice(0, 3).map(m => m[1]).join(", "));
  }
}
