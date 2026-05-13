/**
 * Test X (Twitter) data fetching approaches.
 */

const HANDLE = "levicrytpo";

// Approach 1: Twitter oEmbed (public, no auth) — only for specific tweet URLs
console.log("=== Twitter oEmbed ===");
try {
  const tweetUrl = "https://x.com/LeviCrypto/status/1234567890";
  const res = await fetch(`https://publish.twitter.com/oembed?url=${encodeURIComponent(tweetUrl)}&omit_script=true`);
  console.log("Status:", res.status);
  if (res.ok) {
    const data = await res.json() as any;
    console.log("oEmbed keys:", Object.keys(data).join(", "));
    console.log("oEmbed:", JSON.stringify(data).slice(0, 300));
  } else {
    console.log("Response:", (await res.text()).slice(0, 200));
  }
} catch (e: any) {
  console.log("Failed:", e.message);
}

// Approach 2: Twitter syndication API (used by embedded tweets)
console.log("\n=== Twitter syndication API ===");
try {
  const res = await fetch(`https://syndication.twitter.com/srv/timeline-profile/screen-name/${HANDLE}?dnt=true&lang=en`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "application/json, */*",
      "Referer": "https://platform.twitter.com/",
    }
  });
  console.log("Status:", res.status, "Content-Type:", res.headers.get("content-type"));
  if (res.ok) {
    const text = await res.text();
    console.log("Response length:", text.length);
    console.log("Response:", text.slice(0, 500));
  }
} catch (e: any) {
  console.log("Failed:", e.message);
}

// Approach 3: Twitter profile page scraping
console.log("\n=== Twitter profile page ===");
try {
  const res = await fetch(`https://x.com/${HANDLE}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,*/*",
    }
  });
  console.log("Status:", res.status);
  if (res.ok) {
    const html = await res.text();
    console.log("HTML length:", html.length);
    const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
    const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1];
    console.log("og:title:", ogTitle ?? "not found");
    console.log("og:description:", ogDesc ?? "not found");
  }
} catch (e: any) {
  console.log("Failed:", e.message);
}

// Approach 4: Nitter instances (check if any are alive)
console.log("\n=== Nitter instances ===");
const nitterInstances = [
  "https://nitter.net",
  "https://nitter.privacydev.net",
  "https://nitter.poast.org",
  "https://nitter.1d4.us",
];
for (const instance of nitterInstances) {
  try {
    const res = await fetch(`${instance}/${HANDLE}`, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(5000),
    });
    console.log(`${instance}: ${res.status}`);
    if (res.ok) {
      const html = await res.text();
      const followerMatch = html.match(/Followers<\/span>\s*<span[^>]*>([\d,]+)/i);
      console.log(`  Followers: ${followerMatch?.[1] ?? "not found"}`);
    }
  } catch (e: any) {
    console.log(`${instance}: FAILED (${e.message})`);
  }
}
