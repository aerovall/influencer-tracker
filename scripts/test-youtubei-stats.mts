/**
 * Test youtubei.js (already installed) for getting video stats
 * This library handles InnerTube auth/cookies automatically
 */
import { Innertube } from "youtubei.js";

const yt = await Innertube.create({ generate_session_locally: true });

// Get video info
const videoId = "4P1Tzx1SwgA";
console.log("Fetching video info for:", videoId);

try {
  const info = await yt.getInfo(videoId);
  console.log("getInfo keys:", Object.keys(info));
  
  // Check primary_info
  const primary = (info as any).primary_info;
  if (primary) {
    console.log("primary_info keys:", Object.keys(primary));
    console.log("title:", primary?.title?.text);
    console.log("view_count:", primary?.view_count);
    console.log("likes:", primary?.menu?.top_level_buttons?.[0]);
  }
  
  // Check basic_info
  const basic = info.basic_info;
  console.log("\nbasic_info:", {
    title: basic?.title,
    view_count: basic?.view_count,
    like_count: basic?.like_count,
    duration: basic?.duration,
  });
  
  // Check secondary_info
  const secondary = (info as any).secondary_info;
  if (secondary) {
    console.log("\nsecondary_info keys:", Object.keys(secondary));
  }
  
} catch (e: any) {
  console.log("getInfo error:", e.message);
}

// Try getBasicInfo
try {
  const basic = await yt.getBasicInfo(videoId);
  console.log("\ngetBasicInfo basic_info:", {
    title: basic?.basic_info?.title,
    view_count: basic?.basic_info?.view_count,
    like_count: basic?.basic_info?.like_count,
    duration: basic?.basic_info?.duration,
  });
} catch (e: any) {
  console.log("getBasicInfo error:", e.message);
}

// Try search for the video to get stats
try {
  const search = await yt.search(videoId, { type: "video" });
  const first = search?.results?.[0] as any;
  if (first) {
    console.log("\nSearch result type:", first.type);
    console.log("Search result keys:", Object.keys(first));
    console.log("view_count:", first?.view_count?.text);
    console.log("title:", first?.title?.text);
  }
} catch (e: any) {
  console.log("search error:", e.message);
}
