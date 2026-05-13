/**
 * Test: scrape YouTube video page HTML for likes and comment counts
 * Video: https://www.youtube.com/watch?v=4P1Tzx1SwgA (Levi's video)
 */
const videoId = "4P1Tzx1SwgA";
const url = `https://www.youtube.com/watch?v=${videoId}`;

const res = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  },
});

const html = await res.text();
console.log("Status:", res.status, "Size:", html.length);

// Strategy 1: ytInitialData JSON blob
const match = html.match(/var ytInitialData\s*=\s*(\{.+?\});\s*<\/script>/s);
if (match) {
  try {
    const data = JSON.parse(match[1]);
    const str = JSON.stringify(data);
    
    // Look for like count patterns
    const likeMatches = str.match(/"likeCount":"(\d+)"/g);
    const viewMatches = str.match(/"viewCount":"(\d+)"/g);
    const commentMatches = str.match(/"commentCount":"(\d+)"/g);
    
    console.log("Like count matches:", likeMatches?.slice(0, 3));
    console.log("View count matches:", viewMatches?.slice(0, 3));
    console.log("Comment count matches:", commentMatches?.slice(0, 3));
    
    // Try to find videoDetails
    const detailsMatch = str.match(/"videoDetails":\{[^}]+\}/);
    if (detailsMatch) console.log("videoDetails:", detailsMatch[0].slice(0, 300));
  } catch (e) {
    console.log("JSON parse failed:", e);
  }
} else {
  console.log("ytInitialData not found, trying other patterns...");
  
  // Strategy 2: ytInitialPlayerResponse
  const playerMatch = html.match(/var ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var|<\/script>)/s);
  if (playerMatch) {
    try {
      const data = JSON.parse(playerMatch[1]);
      const vd = data?.videoDetails;
      console.log("Player videoDetails:", {
        title: vd?.title,
        viewCount: vd?.viewCount,
        likeCount: vd?.likeCount,
      });
    } catch (e) {
      console.log("Player JSON parse failed:", e);
    }
  }
  
  // Strategy 3: look for like/view numbers in raw HTML
  const rawLike = html.match(/"label":"([\d,]+) likes"/);
  const rawView = html.match(/"viewCount":"(\d+)"/);
  console.log("Raw like label:", rawLike?.[1]);
  console.log("Raw view count:", rawView?.[1]);
}

// Strategy 4: ytInitialPlayerResponse (always try this)
const playerMatch2 = html.match(/ytInitialPlayerResponse\s*=\s*(\{.+?\});\s*(?:var ytInitialData|<\/script>)/s);
if (playerMatch2) {
  try {
    const data = JSON.parse(playerMatch2[1]);
    const vd = data?.videoDetails;
    console.log("\nytInitialPlayerResponse videoDetails:", {
      title: vd?.title,
      viewCount: vd?.viewCount,
      likeCount: vd?.likeCount,
      lengthSeconds: vd?.lengthSeconds,
    });
  } catch {}
}

// Strategy 5: search for accessibility like count text
const accessLike = html.match(/(\d[\d,]*)\s*likes/i);
const accessComment = html.match(/(\d[\d,]*)\s*comments/i);
console.log("\nAccessibility like text:", accessLike?.[0]);
console.log("Accessibility comment text:", accessComment?.[0]);
