/**
 * Search the large Instagram script tag for user profile data.
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

// Look through the large script tags for user data
for (let i = 0; i < scriptMatches.length; i++) {
  const content = scriptMatches[i]![1] ?? "";
  if (content.length < 10000) continue; // only check large ones
  
  // Search for user-related keys
  const idx = content.indexOf('"user":{');
  if (idx !== -1) {
    console.log(`Script ${i}: found "user":{ at index ${idx}`);
    console.log(content.slice(idx, idx + 500));
  }
  
  // Also search for the handle
  const handleIdx = content.indexOf(`"${HANDLE}"`);
  if (handleIdx !== -1) {
    console.log(`\nScript ${i}: found handle "${HANDLE}" at index ${handleIdx}`);
    console.log(content.slice(Math.max(0, handleIdx - 100), handleIdx + 400));
  }
}

// Try the GraphQL endpoint
console.log("\n=== Instagram GraphQL API ===");
try {
  const apiRes = await fetch(`https://www.instagram.com/graphql/query/?query_hash=c9100bf9110dd6361671f113dd02e7d6&variables={"user_id":"${HANDLE}","include_chaining":false,"include_reel":true,"include_suggested_users":false,"include_logged_out_extras":false,"include_highlight_reels":false,"include_live_status":false}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "x-ig-app-id": "936619743392459",
    }
  });
  console.log("GraphQL status:", apiRes.status);
  if (apiRes.ok) {
    const data = await apiRes.json() as any;
    console.log("GraphQL:", JSON.stringify(data).slice(0, 300));
  }
} catch (e: any) {
  console.log("GraphQL failed:", e.message);
}
