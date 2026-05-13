/**
 * Dig into ytInitialData contents structure for video stats
 * The page is returning a logged-out/bot-detected version — check what's actually in contents
 */
const videoId = "4P1Tzx1SwgA";
const url = `https://www.youtube.com/watch?v=${videoId}`;

const res = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
    "Accept-Encoding": "gzip, deflate, br",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  },
});

const html = await res.text();
console.log("Status:", res.status, "Size:", html.length);
console.log("Is bot check page:", html.includes("unusual traffic") || html.includes("confirm you") || html.includes("robot"));

// Check if the page has the consent/bot check
if (html.includes("consent") || html.includes("CONSENT")) {
  console.log("Consent page detected");
}

// Try InnerTube API directly (POST request)
console.log("\n--- Trying InnerTube API ---");
const innertubeRes = await fetch("https://www.youtube.com/youtubei/v1/player?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
    "X-YouTube-Client-Name": "1",
    "X-YouTube-Client-Version": "2.20260512.00.00",
  },
  body: JSON.stringify({
    videoId,
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20260512.00.00",
        hl: "en",
        gl: "US",
      },
    },
  }),
});

console.log("InnerTube status:", innertubeRes.status);
if (innertubeRes.ok) {
  const data = await innertubeRes.json() as any;
  const vd = data?.videoDetails;
  console.log("videoDetails:", {
    title: vd?.title,
    viewCount: vd?.viewCount,
    likeCount: vd?.likeCount,
    lengthSeconds: vd?.lengthSeconds,
  });
}

// Try the next endpoint (watch page data)
console.log("\n--- Trying InnerTube next endpoint ---");
const nextRes = await fetch("https://www.youtube.com/youtubei/v1/next?key=AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
  },
  body: JSON.stringify({
    videoId,
    context: {
      client: {
        clientName: "WEB",
        clientVersion: "2.20260512.00.00",
        hl: "en",
        gl: "US",
      },
    },
  }),
});

console.log("Next status:", nextRes.status);
if (nextRes.ok) {
  const data = await nextRes.json() as any;
  const str = JSON.stringify(data);
  
  // Find like count
  const likeMatches = [...str.matchAll(/"label":"([\d,]+ likes[^"]*)"/g)];
  console.log("Like labels:", likeMatches.slice(0, 3).map(m => m[1]));
  
  const viewMatches = [...str.matchAll(/"viewCount":\{"videoViewCountRenderer":\{"viewCount":\{"simpleText":"([^"]+)"/g)];
  console.log("View count:", viewMatches.slice(0, 2).map(m => m[1]));
  
  // Look for likeCount directly
  const likeCountIdx = str.indexOf('"likeCount"');
  if (likeCountIdx !== -1) console.log("likeCount context:", str.slice(likeCountIdx, likeCountIdx + 150));
  
  // Look for toggleButtonRenderer (like button)
  const toggleIdx = str.indexOf('toggleButtonRenderer');
  if (toggleIdx !== -1) console.log("toggleButton context:", str.slice(toggleIdx, toggleIdx + 300));
}
