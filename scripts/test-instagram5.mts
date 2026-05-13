/**
 * Try different Instagram public API approaches.
 */

const HANDLE = "levicrytpo";

// Approach 1: Instagram's public JSON endpoint (legacy)
console.log("=== Instagram ?__a=1 ===");
try {
  const res = await fetch(`https://www.instagram.com/${HANDLE}/?__a=1&__d=dis`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "application/json",
      "X-Requested-With": "XMLHttpRequest",
      "Referer": "https://www.instagram.com/",
    }
  });
  console.log("Status:", res.status, "Content-Type:", res.headers.get("content-type"));
  const text = await res.text();
  console.log("Response:", text.slice(0, 300));
} catch (e: any) {
  console.log("Failed:", e.message);
}

// Approach 2: Picuki (public Instagram viewer)
console.log("\n=== Picuki ===");
try {
  const res = await fetch(`https://www.picuki.com/profile/${HANDLE}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,*/*",
    }
  });
  console.log("Status:", res.status);
  if (res.ok) {
    const html = await res.text();
    const followerMatch = html.match(/Followers[^<]*<\/span>\s*<span[^>]*>([\d,KM.]+)/i) ??
                          html.match(/([\d,KM.]+)\s*Followers/i);
    const postsMatch = html.match(/Posts[^<]*<\/span>\s*<span[^>]*>([\d,KM.]+)/i) ??
                       html.match(/([\d,KM.]+)\s*Posts/i);
    console.log("Followers:", followerMatch?.[1] ?? "not found");
    console.log("Posts:", postsMatch?.[1] ?? "not found");
    console.log("HTML length:", html.length);
  }
} catch (e: any) {
  console.log("Failed:", e.message);
}

// Approach 3: Imginn (another public Instagram viewer)
console.log("\n=== Imginn ===");
try {
  const res = await fetch(`https://imginn.com/${HANDLE}/`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      "Accept": "text/html,*/*",
    }
  });
  console.log("Status:", res.status);
  if (res.ok) {
    const html = await res.text();
    const followerMatch = html.match(/([\d,KM.]+)\s*[Ff]ollowers/);
    const postsMatch = html.match(/([\d,KM.]+)\s*[Pp]osts/);
    console.log("Followers:", followerMatch?.[1] ?? "not found");
    console.log("Posts:", postsMatch?.[1] ?? "not found");
    console.log("HTML length:", html.length);
  }
} catch (e: any) {
  console.log("Failed:", e.message);
}

// Approach 4: Instagram oEmbed for a post (if we have a post URL)
console.log("\n=== Instagram post oEmbed ===");
try {
  const postUrl = `https://www.instagram.com/p/C8example/`;
  const res = await fetch(`https://api.instagram.com/oembed/?url=${encodeURIComponent(postUrl)}&format=json`);
  console.log("Status:", res.status);
  if (res.ok) {
    const data = await res.json() as any;
    console.log("oEmbed:", JSON.stringify(data).slice(0, 300));
  }
} catch (e: any) {
  console.log("Failed:", e.message);
}
