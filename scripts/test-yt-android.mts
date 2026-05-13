/**
 * Test InnerTube API with Android client — bypasses bot detection
 */
const videoId = "4P1Tzx1SwgA";

// Android client context — known to bypass bot detection
const androidContext = {
  client: {
    clientName: "ANDROID",
    clientVersion: "19.09.37",
    androidSdkVersion: 30,
    hl: "en",
    gl: "US",
    userAgent: "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
  },
};

// 1. Player endpoint (for viewCount, title, duration)
const playerRes = await fetch("https://www.youtube.com/youtubei/v1/player", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
    "X-YouTube-Client-Name": "3",
    "X-YouTube-Client-Version": "19.09.37",
  },
  body: JSON.stringify({ videoId, context: androidContext }),
});

console.log("Player status:", playerRes.status);
if (playerRes.ok) {
  const data = await playerRes.json() as any;
  const vd = data?.videoDetails;
  console.log("videoDetails:", {
    title: vd?.title,
    viewCount: vd?.viewCount,
    likeCount: vd?.likeCount,
    lengthSeconds: vd?.lengthSeconds,
    author: vd?.author,
  });
}

// 2. Next endpoint (for like count in UI)
const nextRes = await fetch("https://www.youtube.com/youtubei/v1/next", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip",
    "X-YouTube-Client-Name": "3",
    "X-YouTube-Client-Version": "19.09.37",
  },
  body: JSON.stringify({ videoId, context: androidContext }),
});

console.log("\nNext status:", nextRes.status);
if (nextRes.ok) {
  const data = await nextRes.json() as any;
  const str = JSON.stringify(data);
  
  // Like count
  const likeIdx = str.indexOf('"likeCount"');
  if (likeIdx !== -1) console.log("likeCount context:", str.slice(likeIdx, likeIdx + 200));
  
  // View count
  const viewIdx = str.indexOf('"viewCount"');
  if (viewIdx !== -1) console.log("viewCount context:", str.slice(viewIdx, viewIdx + 200));
  
  // Look for accessibility labels
  const likeLabels = [...str.matchAll(/"label":"([\d,]+ likes[^"]*)"/g)];
  console.log("Like labels:", likeLabels.slice(0, 3).map(m => m[1]));
  
  // Look for simpleText with numbers
  const simpleNums = [...str.matchAll(/"simpleText":"([\d,]+)"/g)];
  console.log("SimpleText numbers (first 10):", simpleNums.slice(0, 10).map(m => m[1]));
}

// 3. Try TV client (known to work for stats)
console.log("\n--- TV Client ---");
const tvRes = await fetch("https://www.youtube.com/youtubei/v1/player", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (SMART-TV; Linux; Tizen 5.0) AppleWebKit/537.36",
    "X-YouTube-Client-Name": "7",
    "X-YouTube-Client-Version": "2.0",
  },
  body: JSON.stringify({
    videoId,
    context: {
      client: {
        clientName: "TVHTML5",
        clientVersion: "7.20240101.00.00",
        hl: "en",
        gl: "US",
      },
    },
  }),
});

console.log("TV status:", tvRes.status);
if (tvRes.ok) {
  const data = await tvRes.json() as any;
  const vd = data?.videoDetails;
  console.log("TV videoDetails:", {
    title: vd?.title,
    viewCount: vd?.viewCount,
    likeCount: vd?.likeCount,
    lengthSeconds: vd?.lengthSeconds,
  });
}
