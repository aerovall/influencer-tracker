// Verification: test the full fetchChannelUploads flow using the fixed code paths
import { Innertube } from "youtubei.js";

const CHANNEL_ID = "UCJQY1CkwtFNfJfIzROc8KiA";
const LIMIT = 100;

function parseDurationText(text) {
  if (!text) return 0;
  const parts = String(text).split(":").map(p => parseInt(p, 10) || 0);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}

function safeNum(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string") return parseInt(v.replace(/[^0-9]/g, ""), 10) || 0;
  return 0;
}

function parseRelativeDate(text) {
  try {
    const t = text.toLowerCase();
    const d = new Date();
    if (t.includes("year")) { d.setFullYear(d.getFullYear() - (parseInt(t) || 1)); }
    else if (t.includes("month")) { d.setMonth(d.getMonth() - (parseInt(t) || 1)); }
    else if (t.includes("week")) { d.setDate(d.getDate() - (parseInt(t) || 1) * 7); }
    else if (t.includes("day")) { d.setDate(d.getDate() - (parseInt(t) || 1)); }
    return d.toISOString().slice(0, 10);
  } catch { return new Date().toISOString().slice(0, 10); }
}

function unwrapLockupItem(raw) {
  if (!raw) return null;
  const item = raw?.content ?? raw;
  if (item?.type === "LockupView" || item?.content_id) {
    if (item?.content_type && item.content_type !== "VIDEO") return null;
    return item;
  }
  return null;
}

function extractItemStats(item) {
  const rawId = item?.content_id ?? item?.video_id ?? item?.id ?? "";
  const title = item?.metadata?.title?.text ?? item?.metadata?.title?.runs?.[0]?.text ?? item?.title?.text ?? "Untitled";
  
  const metaRows = item?.metadata?.metadata?.metadata_rows ?? [];
  const parts = metaRows[0]?.metadata_parts ?? [];
  
  let viewRaw = "0";
  let publishedText = "";
  for (const part of parts) {
    const txt = part?.text?.text ?? part?.text?.runs?.[0]?.text ?? "";
    if (txt.toLowerCase().includes("view")) viewRaw = txt;
    else if (txt.toLowerCase().includes("ago") || txt.toLowerCase().includes("hour") ||
             txt.toLowerCase().includes("day") || txt.toLowerCase().includes("week") ||
             txt.toLowerCase().includes("month") || txt.toLowerCase().includes("year")) {
      publishedText = txt;
    }
  }
  if (viewRaw === "0") viewRaw = item?.view_count?.toString() ?? "0";
  if (!publishedText) publishedText = item?.published?.text ?? "";
  
  const viewCount = safeNum(viewRaw);
  const publishedDate = publishedText ? parseRelativeDate(publishedText) : new Date().toISOString().slice(0, 10);
  
  let durationSeconds = 0;
  const overlays = item?.content_image?.overlays ?? [];
  for (const overlay of overlays) {
    if (overlay?.type === "ThumbnailBottomOverlayView") {
      const durationText = overlay?.badges?.[0]?.text ?? "";
      if (durationText) { durationSeconds = parseDurationText(durationText); break; }
    }
  }
  if (durationSeconds === 0) {
    durationSeconds = typeof item?.duration?.seconds === "number" ? item.duration.seconds : parseDurationText(item?.duration?.text ?? "0");
  }
  
  const imgArr = item?.content_image?.image ?? item?.thumbnails ?? item?.thumbnail;
  let thumbnailUrl = null;
  if (Array.isArray(imgArr)) {
    const sorted = [...imgArr].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
    thumbnailUrl = sorted[0]?.url ?? null;
  } else if (imgArr?.url) {
    thumbnailUrl = imgArr.url;
  }
  
  return { rawId, title, viewCount, durationSeconds, publishedDate, thumbnailUrl };
}

async function main() {
  console.log("=== Testing fixed fetchChannelUploads flow ===\n");
  const yt = await Innertube.create({ retrieve_player: false });
  const channel = await yt.getChannel(CHANNEL_ID);
  const videosTab = await channel.getVideos();
  
  const allItems = [];
  
  // Page 1
  const page1Raw = videosTab?.page_contents?.contents ?? videosTab?.videos ?? videosTab?.items ?? [];
  for (const raw of page1Raw) {
    const item = unwrapLockupItem(raw);
    if (item) allItems.push(item);
  }
  console.log(`Page 1: raw=${page1Raw.length} valid=${allItems.length}`);
  
  // Continuation pages
  let continuation = null;
  try { continuation = await videosTab.getContinuation(); } catch { continuation = null; }
  
  let pageNum = 2;
  while (continuation && allItems.length < LIMIT) {
    const contRaw = continuation?.contents?.contents ?? continuation?.videos ?? continuation?.items ?? [];
    if (contRaw.length === 0) break;
    
    let added = 0;
    for (const raw of contRaw) {
      const item = unwrapLockupItem(raw);
      if (item) { allItems.push(item); added++; }
    }
    console.log(`Page ${pageNum}: raw=${contRaw.length} valid=${added} total=${allItems.length}`);
    pageNum++;
    
    if (!continuation.has_continuation || allItems.length >= LIMIT) break;
    try { continuation = await continuation.getContinuation(); } catch { break; }
  }
  
  console.log(`\nTotal items collected: ${allItems.length}`);
  
  // Extract stats from first 5 and last 5
  const results = [];
  for (const item of allItems.slice(0, LIMIT)) {
    const stats = extractItemStats(item);
    if (stats.rawId && stats.rawId.length === 11) results.push(stats);
  }
  
  console.log(`\nTotal valid videos: ${results.length}`);
  console.log("\n=== First 5 videos ===");
  for (const v of results.slice(0, 5)) {
    console.log(`  ${v.rawId} | ${v.title.slice(0, 50)} | views=${v.viewCount} | published=${v.publishedDate} | duration=${v.durationSeconds}s`);
  }
  console.log("\n=== Last 5 videos ===");
  for (const v of results.slice(-5)) {
    console.log(`  ${v.rawId} | ${v.title.slice(0, 50)} | views=${v.viewCount} | published=${v.publishedDate} | duration=${v.durationSeconds}s`);
  }
  
  // Check for videos with missing data
  const missingId = results.filter(v => !v.rawId || v.rawId.length !== 11).length;
  const missingTitle = results.filter(v => v.title === "Untitled").length;
  const missingViews = results.filter(v => v.viewCount === 0).length;
  const missingDuration = results.filter(v => v.durationSeconds === 0).length;
  
  console.log("\n=== Data quality ===");
  console.log(`  Missing IDs: ${missingId}`);
  console.log(`  Missing titles: ${missingTitle}`);
  console.log(`  Missing views (0): ${missingViews}`);
  console.log(`  Missing duration (0): ${missingDuration}`);
  
  if (results.length >= 90) {
    console.log("\n✅ SUCCESS: Got 90+ videos with correct data!");
  } else {
    console.log(`\n❌ FAIL: Only got ${results.length} videos (expected 90+)`);
  }
}

main().catch(console.error);
