/**
 * Test Instagram data fetching approaches.
 */

const HANDLE = "levicrytpo"; // test with a known public account

// Approach 1: Public profile page scraping
console.log("=== Instagram public profile page ===");
try {
  const res = await fetch(`https://www.instagram.com/${HANDLE}/`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,*/*",
      "Accept-Language": "en-US,en;q=0.9",
    }
  });
  const html = await res.text();
  console.log("Status:", res.status);
  console.log("HTML length:", html.length);
  
  const ogTitle = html.match(/<meta property="og:title" content="([^"]+)"/)?.[1];
  const ogDesc = html.match(/<meta property="og:description" content="([^"]+)"/)?.[1];
  console.log("og:title:", ogTitle ?? "not found");
  console.log("og:description:", ogDesc ?? "not found");
  
  // Check if it's a login redirect
  if (html.includes("login") && html.length < 5000) {
    console.log("⚠️  Looks like a login redirect");
  }
} catch (e: any) {
  console.log("Failed:", e.message);
}

// Approach 2: Instagram oEmbed (public, no auth)
console.log("\n=== Instagram oEmbed ===");
try {
  const res = await fetch(`https://www.instagram.com/api/oembed/?url=https://www.instagram.com/${HANDLE}/&format=json`);
  console.log("Status:", res.status);
  if (res.ok) {
    const data = await res.json() as any;
    console.log("oEmbed:", JSON.stringify(data).slice(0, 300));
  } else {
    console.log("Response:", (await res.text()).slice(0, 200));
  }
} catch (e: any) {
  console.log("Failed:", e.message);
}

// Approach 3: Instagram i.instagram.com API (public)
console.log("\n=== Instagram i.instagram.com API ===");
try {
  const res = await fetch(`https://i.instagram.com/api/v1/users/web_profile_info/?username=${HANDLE}`, {
    headers: {
      "User-Agent": "Instagram 219.0.0.12.117 Android",
      "x-ig-app-id": "936619743392459",
    }
  });
  console.log("Status:", res.status);
  if (res.ok) {
    const data = await res.json() as any;
    const user = data?.data?.user;
    console.log("Username:", user?.username);
    console.log("Full name:", user?.full_name);
    console.log("Followers:", user?.edge_followed_by?.count);
    console.log("Following:", user?.edge_follow?.count);
    console.log("Posts:", user?.edge_owner_to_timeline_media?.count);
    console.log("Bio:", user?.biography?.slice(0, 100));
    console.log("Profile pic:", user?.profile_pic_url_hd?.slice(0, 80));
  } else {
    console.log("Response:", (await res.text()).slice(0, 200));
  }
} catch (e: any) {
  console.log("Failed:", e.message);
}
