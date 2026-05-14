/**
 * exportExcel.ts
 * Builds a formatted multi-sheet Excel workbook from the analytics.exportStats payload
 * and triggers a browser download.
 */
import * as XLSX from "xlsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(val: string | Date | null | undefined): string {
  if (!val) return "";
  try {
    return new Date(val).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return String(val);
  }
}

function fmtNum(val: number | string | null | undefined): number | string {
  if (val == null) return "";
  const n = Number(val);
  return isNaN(n) ? String(val) : n;
}

/** Apply a bold, coloured header row style to the first row of a sheet. */
function styleHeader(ws: XLSX.WorkSheet, cols: number, color = "1E3A5F") {
  for (let c = 0; c < cols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (!ws[addr]) continue;
    ws[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: color }, patternType: "solid" },
      alignment: { horizontal: "center", vertical: "center", wrapText: true },
      border: {
        bottom: { style: "thin", color: { rgb: "AAAAAA" } },
      },
    };
  }
}

/** Set column widths based on an array of character widths. */
function setCols(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

// ─── Sheet builders ───────────────────────────────────────────────────────────

function buildSummarySheet(data: any, fullData?: any): XLSX.WorkSheet {
  const { summary, exportedAt } = data;

  const rows: any[][] = [
    ["Influencer Tracker — Dashboard Export"],
    [`Generated: ${fmtDate(exportedAt)}`],
    [],
    ["KPI", "Value"],
    ["Total Videos", fmtNum(summary.totalVideos)],
    ["Total Views (all time)", fmtNum(summary.totalViews)],
    ["Avg Engagement Rate", `${summary.avgEngagementRate}%`],
    ["Total Channels", fmtNum(summary.totalChannels)],
    ["Total Sponsorships", fmtNum(summary.totalSponsorships)],
    [],
    ["Videos by Influencer / Channel"],
    ["Channel", "Video Count"],
    ...(summary.byInfluencer ?? []).map((r: any) => [r.influencerName ?? "Unknown", fmtNum(r.count)]),
    [],
    ["Videos by Platform"],
    ["Platform", "Video Count"],
    ...(summary.byPlatform ?? []).map((r: any) => [r.platform, fmtNum(r.count)]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }, // title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } }, // generated date
  ];
  // Style title row (row 0)
  if (ws["A1"]) ws["A1"].s = { font: { bold: true, sz: 14, color: { rgb: "D4A017" } } };
  // Style KPI header row (row index 3 = spreadsheet row 4)
  const kpiHeaderRow = 3;
  ["A", "B"].forEach((col) => {
    const addr = `${col}${kpiHeaderRow + 1}`;
    if (ws[addr]) ws[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "1E3A5F" }, patternType: "solid" },
      alignment: { horizontal: "center", vertical: "center" },
    };
  });
  // Style "Videos by Influencer" sub-header (row 10)
  const influencerHeaderRow = 11;
  ["A", "B"].forEach((col) => {
    const addr = `${col}${influencerHeaderRow + 1}`;
    if (ws[addr]) ws[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "1E3A5F" }, patternType: "solid" },
      alignment: { horizontal: "center", vertical: "center" },
    };
  });
  // Style "Videos by Platform" sub-header
  const byInfluencerCount = (data?.summary?.byInfluencer ?? []).length;
  const platformHeaderRow = influencerHeaderRow + byInfluencerCount + 2;
  ["A", "B"].forEach((col) => {
    const addr = `${col}${platformHeaderRow + 1}`;
    if (ws[addr]) ws[addr].s = {
      font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
      fill: { fgColor: { rgb: "1E3A5F" }, patternType: "solid" },
      alignment: { horizontal: "center", vertical: "center" },
    };
  });
  setCols(ws, [32, 20]);
  return ws;
}

function buildVideosSheet(videos: any[]): XLSX.WorkSheet {
  const headers = [
    "Video ID", "Channel / Influencer", "Platform", "Title",
    "Published Date", "Date Added", "Duration (s)", "Views", "Likes", "Comments",
    "Manual Likes", "Manual Comments", "Engagement Rate", "URL",
  ];

  const rows = videos.map((v) => [
    v.videoId,
    v.influencerName ?? "",
    v.platform,
    v.title ?? "",
    fmtDate(v.publishedDate),
    fmtDate(v.dateAdded),
    fmtNum(v.durationSeconds),
    fmtNum(v.viewCount),
    fmtNum(v.likes),
    fmtNum(v.comments),
    fmtNum(v.manualLikes),
    fmtNum(v.manualComments),
    v.engagementRate ? `${v.engagementRate}%` : "",
    v.videoUrl ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  styleHeader(ws, headers.length);
  setCols(ws, [18, 20, 12, 48, 14, 14, 12, 12, 10, 10, 12, 14, 14, 50]);
  return ws;
}

function buildViewCountsSheet(viewCounts: any[]): XLSX.WorkSheet {
  const headers = ["Count ID", "Video ID", "Date", "Views", "Likes", "Comments", "Shares", "Engagement Rate"];

  const rows = viewCounts.map((vc) => [
    vc.countId,
    vc.videoId,
    fmtDate(vc.date),
    fmtNum(vc.viewCount),
    fmtNum(vc.likes),
    fmtNum(vc.comments),
    fmtNum(vc.shares),
    vc.engagementRate ? `${vc.engagementRate}%` : "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  styleHeader(ws, headers.length);
  setCols(ws, [24, 20, 14, 12, 10, 10, 10, 14]);
  return ws;
}

function buildSponsorshipsSheet(shills: any[]): XLSX.WorkSheet {
  const headers = [
    "Shill ID", "Video ID", "Brand", "Timestamp", "Duration (s)",
    "Promo Type", "Notes", "Created At",
  ];

  const rows = shills.map((s) => [
    s.shillId ?? s.id,
    s.videoId,
    s.productBrand,
    s.timestamp ?? "",
    fmtNum(s.lengthSeconds),
    s.promoType ?? "",
    s.notes ?? "",
    fmtDate(s.createdAt),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  styleHeader(ws, headers.length, "7B3F00");
  setCols(ws, [12, 20, 24, 10, 12, 28, 32, 16]);
  return ws;
}

function buildChannelsSheet(channels: any[]): XLSX.WorkSheet {
  const headers = [
    "Channel ID", "Channel Name", "Handle", "Platform",
    "Subscribers", "Video Count", "Last Sync", "Created At",
  ];

  const rows = channels.map((ch) => [
    ch.channelId,
    ch.channelName,
    ch.channelHandle ?? "",
    "YouTube",
    fmtNum(ch.subscriberCount),
    fmtNum(ch.videoCount),
    fmtDate(ch.lastCheckedAt),
    fmtDate(ch.createdAt),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  styleHeader(ws, headers.length, "1A5C38");
  setCols(ws, [24, 24, 18, 12, 14, 12, 16, 16]);
  return ws;
}

// ─── Main export function ─────────────────────────────────────────────────────

export function downloadDashboardExcel(data: any) {
  const wb = XLSX.utils.book_new();

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data), "Summary");
  XLSX.utils.book_append_sheet(wb, buildVideosSheet(data.videos ?? []), "Videos");
  XLSX.utils.book_append_sheet(wb, buildViewCountsSheet(data.viewCounts ?? []), "View Counts");
  XLSX.utils.book_append_sheet(wb, buildSponsorshipsSheet(data.sponsorships ?? []), "Sponsorships");
  XLSX.utils.book_append_sheet(wb, buildChannelsSheet(data.channels ?? []), "Channels");

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `influencer-tracker-export-${dateStr}.xlsx`);
}
