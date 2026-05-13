/**
 * Dig into Instagram's JSON script tags to find user data.
 */

const HANDLE = "levicrytpo";

const res = await fetch(`https://www.instagram.com/${HANDLE}/`, {
  headers: {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "text/html,application/xhtml+xml,*/*",
    "Accept-Language": "en-US,en;q=0.9",
  }
});
const html = await res.text();

// Extract all script tags with type="application/json"
const scriptMatches = Array.from(html.matchAll(/<script type="application\/json"[^>]*>([\s\S]+?)<\/script>/g));
console.log(`Found ${scriptMatches.length} JSON script tags`);

for (let i = 0; i < scriptMatches.length; i++) {
  const content = scriptMatches[i]![1] ?? "";
  try {
    const data = JSON.parse(content);
    const str = JSON.stringify(data);
    // Look for user-related data
    if (str.includes("follower") || str.includes("media_count") || str.includes("biography") || str.includes("full_name")) {
      console.log(`\n=== Script tag ${i} (${content.length} chars) ===`);
      console.log(str.slice(0, 500));
    }
  } catch {
    // not valid JSON
  }
}

// Also look for inline script data patterns
const inlinePatterns = [
  { name: "follower_count", re: /"follower_count":(\d+)/ },
  { name: "media_count", re: /"media_count":(\d+)/ },
  { name: "full_name", re: /"full_name":"([^"]+)"/ },
  { name: "biography", re: /"biography":"([^"]*)"/ },
  { name: "profile_pic_url", re: /"profile_pic_url":"([^"]+)"/ },
  { name: "username", re: /"username":"([^"]+)"/ },
];

console.log("\n=== Inline pattern search ===");
for (const { name, re } of inlinePatterns) {
  const m = html.match(re);
  if (m) console.log(`${name}: ${m[1]?.slice(0, 100)}`);
  else console.log(`${name}: NOT FOUND`);
}
