/**
 * Test various approaches to get YouTube like/comment counts without API key.
 * 1. YouTube oEmbed (free, no key) — only gives title/thumbnail, no stats
 * 2. InnerTube getInfo() — blocked (LOGIN_REQUIRED)
 * 3. YouTube page scraping — check if like count is in the HTML
 */

const VIDEO_ID = "4PlTzx1SwgA"; // Levi's recent video

// Approach 1: oEmbed
console.log("=== oEmbed ===");
try {
  const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${VIDEO_ID}&format=json`);
  const data = await res.json() as any;
  console.log("oEmbed keys:", Object.keys(data).join(", "));
  console.log("oEmbed:", JSON.stringify(data).slice(0, 300));
} catch (e: any) {
  console.log("oEmbed failed:", e.message);
}

// Approach 2: YouTube page scrape — look for like count in ytInitialData
console.log("\n=== YouTube page scrape ===");
try {
  const res = await fetch(`https://www.youtube.com/watch?v=${VIDEO_ID}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    }
  });
  const html = await res.text();
  
  // Look for like count in ytInitialData
  const likeMatch = html.match(/"label":"([\d,]+ likes?)"/i) ?? html.match(/"accessibilityText":"([\d,.]+ likes?)"/i);
  console.log("Like count match:", likeMatch?.[1] ?? "not found");
  
  // Look for view count
  const viewMatch = html.match(/"viewCount":"(\d+)"/);
  console.log("View count match:", viewMatch?.[1] ?? "not found");
  
  // Look for comment count
  const commentMatch = html.match(/"commentCount":"(\d+)"/);
  console.log("Comment count match:", commentMatch?.[1] ?? "not found");
  
  // Check response status
  console.log("Response status:", res.status);
  console.log("HTML length:", html.length);
} catch (e: any) {
  console.log("Page scrape failed:", e.message);
}
