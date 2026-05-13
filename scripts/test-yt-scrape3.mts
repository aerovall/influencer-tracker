/**
 * Inspect actual ytInitialData and ytInitialPlayerResponse content
 */
const videoId = "4P1Tzx1SwgA";
const url = `https://www.youtube.com/watch?v=${videoId}`;

const res = await fetch(url, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept-Language": "en-US,en;q=0.9",
  },
});

const html = await res.text();

// Extract ytInitialPlayerResponse
const prIdx = html.indexOf('var ytInitialPlayerResponse = ');
if (prIdx !== -1) {
  let depth = 0;
  let start = prIdx + 'var ytInitialPlayerResponse = '.length;
  let end = start;
  for (let i = start; i < Math.min(start + 2000000, html.length); i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  console.log("ytInitialPlayerResponse length:", end - start);
  try {
    const data = JSON.parse(html.slice(start, end)) as any;
    console.log("Keys:", Object.keys(data));
    const vd = data?.videoDetails;
    if (vd) {
      console.log("videoDetails:", {
        title: vd.title,
        viewCount: vd.viewCount,
        likeCount: vd.likeCount,
        lengthSeconds: vd.lengthSeconds,
        author: vd.author,
      });
    }
    // Check microformat
    const mf = data?.microformat?.playerMicroformatRenderer;
    if (mf) {
      console.log("microformat:", {
        viewCount: mf.viewCount,
        likeCount: mf.likeCount,
        title: mf.title?.simpleText,
      });
    }
  } catch (e) {
    console.log("Parse error:", (e as any).message);
    // Show raw content
    console.log("Raw (first 500):", html.slice(start, start + 500));
  }
}

// Extract ytInitialData
const idIdx = html.indexOf('var ytInitialData = ');
if (idIdx !== -1) {
  let depth = 0;
  let start = idIdx + 'var ytInitialData = '.length;
  let end = start;
  for (let i = start; i < Math.min(start + 5000000, html.length); i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  console.log("\nytInitialData length:", end - start);
  try {
    const data = JSON.parse(html.slice(start, end)) as any;
    console.log("Top-level keys:", Object.keys(data));
    // Dump first 1000 chars to see structure
    console.log("Content (first 1000):", JSON.stringify(data).slice(0, 1000));
  } catch (e) {
    console.log("Parse error:", (e as any).message);
    console.log("Raw (first 500):", html.slice(start, start + 500));
  }
}
