/**
 * Deeper test: find where stats are in YouTube HTML
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
console.log("Status:", res.status, "Size:", html.length);

// Find all script tags with JSON data
const scriptMatches = html.matchAll(/var (yt\w+)\s*=\s*(\{)/g);
for (const m of scriptMatches) {
  console.log("Found var:", m[1]);
}

// Look for any number patterns near "like" or "view"
const patterns = [
  /accessibilityData.*?label.*?(\d[\d,.KM]+)\s*(?:likes|like)/gi,
  /"simpleText":"([\d,]+)"\},"accessibilityData":\{"label":"([\d,]+) likes/g,
  /toggledText.*?simpleText.*?"([\d,]+)"/g,
  /"label":"([\d,]+) likes"/g,
  /likeCount['":\s]+['"]?(\d+)/g,
  /viewCount['":\s]+['"]?(\d+)/g,
  /"videoViewCountRenderer".*?"viewCount".*?"simpleText":"([^"]+)"/g,
];

for (const p of patterns) {
  const matches = [...html.matchAll(p)];
  if (matches.length > 0) {
    console.log(`Pattern ${p.source.slice(0, 40)}: ${matches.slice(0, 2).map(m => m[0].slice(0, 80))}`);
  }
}

// Try to extract ytInitialData more carefully
const idx = html.indexOf('var ytInitialData = ');
if (idx !== -1) {
  // Find the matching closing brace
  let depth = 0;
  let start = idx + 'var ytInitialData = '.length;
  let end = start;
  for (let i = start; i < Math.min(start + 5000000, html.length); i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') {
      depth--;
      if (depth === 0) { end = i + 1; break; }
    }
  }
  console.log("\nytInitialData found, length:", end - start);
  try {
    const data = JSON.parse(html.slice(start, end));
    const str = JSON.stringify(data);
    
    // Search for like count
    const likeIdx = str.indexOf('"likeCount"');
    if (likeIdx !== -1) console.log("likeCount context:", str.slice(likeIdx, likeIdx + 100));
    
    const viewIdx = str.indexOf('"viewCount"');
    if (viewIdx !== -1) console.log("viewCount context:", str.slice(viewIdx, viewIdx + 100));
    
    // Search for accessibility labels with numbers
    const labelMatches = [...str.matchAll(/"label":"([\d,]+ (?:likes|views|comments)[^"]*?)"/g)];
    console.log("Label matches:", labelMatches.slice(0, 5).map(m => m[1]));
    
    // Search for simpleText with numbers
    const simpleMatches = [...str.matchAll(/"simpleText":"([\d,]+(?:\.\d+)?[KMB]?)"/g)];
    console.log("SimpleText numbers:", simpleMatches.slice(0, 10).map(m => m[1]));
    
  } catch (e) {
    console.log("Parse error:", e);
  }
}
