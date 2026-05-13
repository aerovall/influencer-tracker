/**
 * Test Instagram data extraction from the large HTML page (807KB).
 * Instagram embeds data in window._sharedData or __additionalDataLoaded.
 */

const HANDLE = "levicrytpo";

const res = await fetch(`https://www.instagram.com/${HANDLE}/`, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "en-US,en;q=0.9",
    "Cookie": "", // no cookies
  }
});
const html = await res.text();
console.log("Status:", res.status, "Length:", html.length);

// Try to find _sharedData
const sharedDataMatch = html.match(/window\._sharedData\s*=\s*(\{.+?\});\s*<\/script>/s);
if (sharedDataMatch) {
  try {
    const data = JSON.parse(sharedDataMatch[1]);
    const user = data?.entry_data?.ProfilePage?.[0]?.graphql?.user;
    console.log("sharedData user:", user?.username, user?.edge_followed_by?.count);
  } catch {
    console.log("sharedData parse failed");
  }
} else {
  console.log("No _sharedData found");
}

// Try to find __additionalDataLoaded
const additionalMatch = html.match(/window\.__additionalDataLoaded\s*\([^,]+,\s*(\{.+?\})\s*\)/s);
if (additionalMatch) {
  try {
    const data = JSON.parse(additionalMatch[1]);
    console.log("additionalData:", JSON.stringify(data).slice(0, 300));
  } catch {
    console.log("additionalData parse failed");
  }
} else {
  console.log("No __additionalDataLoaded found");
}

// Try to find JSON data in script tags
const scriptMatches = Array.from(html.matchAll(/<script type="application\/json"[^>]*>(\{.+?)\}<\/script>/gs));
console.log(`Found ${scriptMatches.length} JSON script tags`);
for (const m of scriptMatches.slice(0, 3)) {
  const snippet = m[1].slice(0, 200);
  if (snippet.includes("follower") || snippet.includes("subscriber")) {
    console.log("Interesting JSON:", snippet);
  }
}

// Look for follower count patterns
const followerPatterns = [
  /\"follower_count\":(\d+)/,
  /\"edge_followed_by\":\{"count":(\d+)\}/,
  /"followers":(\d+)/,
  /(\d+)\s*[Ff]ollowers/,
];
for (const pattern of followerPatterns) {
  const m = html.match(pattern);
  if (m) console.log(`Follower pattern "${pattern.source}" found: ${m[1]}`);
}

// Look for post count
const postPatterns = [
  /\"media_count\":(\d+)/,
  /\"edge_owner_to_timeline_media\":\{"count":(\d+)\}/,
];
for (const pattern of postPatterns) {
  const m = html.match(pattern);
  if (m) console.log(`Post pattern "${pattern.source}" found: ${m[1]}`);
}
