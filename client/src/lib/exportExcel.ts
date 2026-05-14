/**
 * exportExcel.ts
 * Builds a richly-formatted multi-sheet Excel workbook from the analytics.exportStats payload.
 *
 * Design language:
 *   • Sheet accent colours:  Summary=navy, Videos=teal, ViewCounts=indigo, Sponsorships=amber, Channels=forest
 *   • Header row:            white bold text on accent background, 12pt
 *   • Alternating data rows: white / very-light-grey (every other row)
 *   • All data cells:        thin border on all four sides
 *   • Numbers:               comma-formatted integers; engagement as "0.00%"
 *   • Freeze panes:          top header row frozen on every data sheet
 *   • Column widths:         tuned per sheet
 */
import * as XLSX from "xlsx";

// ─── Colour palette ───────────────────────────────────────────────────────────
const ACCENT = {
  summary:      "0F2A4A",   // deep navy
  videos:       "0D4A4A",   // dark teal
  viewCounts:   "1A1A6E",   // deep indigo
  sponsorships: "7B3F00",   // rich amber-brown
  channels:     "1A4A2A",   // forest green
};
const WHITE      = "FFFFFF";
const ROW_ALT    = "F4F6FA";   // very light blue-grey for alternating rows
const ROW_PLAIN  = "FFFFFF";
const BORDER_CLR = "C8CDD6";

// ─── Style factories ──────────────────────────────────────────────────────────

function headerStyle(accentHex: string): any {
  return {
    font:      { bold: true, color: { rgb: WHITE }, sz: 12, name: "Calibri" },
    fill:      { fgColor: { rgb: accentHex }, patternType: "solid" },
    alignment: { horizontal: "center", vertical: "center", wrapText: false },
    border: {
      top:    { style: "medium", color: { rgb: accentHex } },
      bottom: { style: "medium", color: { rgb: accentHex } },
      left:   { style: "thin",   color: { rgb: accentHex } },
      right:  { style: "thin",   color: { rgb: accentHex } },
    },
  };
}

function dataStyle(rowIdx: number, align: "left" | "right" | "center" = "left"): any {
  const bg = rowIdx % 2 === 0 ? ROW_PLAIN : ROW_ALT;
  return {
    font:      { sz: 10, name: "Calibri", color: { rgb: "1A1A2E" } },
    fill:      { fgColor: { rgb: bg }, patternType: "solid" },
    alignment: { horizontal: align, vertical: "center" },
    border: {
      top:    { style: "thin", color: { rgb: BORDER_CLR } },
      bottom: { style: "thin", color: { rgb: BORDER_CLR } },
      left:   { style: "thin", color: { rgb: BORDER_CLR } },
      right:  { style: "thin", color: { rgb: BORDER_CLR } },
    },
  };
}

function titleStyle(): any {
  return {
    font:      { bold: true, sz: 16, name: "Calibri", color: { rgb: "0F2A4A" } },
    alignment: { horizontal: "left", vertical: "center" },
  };
}

function subTitleStyle(): any {
  return {
    font:      { italic: true, sz: 10, name: "Calibri", color: { rgb: "6B7280" } },
    alignment: { horizontal: "left", vertical: "center" },
  };
}

function sectionHeaderStyle(accentHex: string): any {
  return {
    font:      { bold: true, sz: 11, name: "Calibri", color: { rgb: WHITE } },
    fill:      { fgColor: { rgb: accentHex }, patternType: "solid" },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      bottom: { style: "medium", color: { rgb: accentHex } },
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(val: string | Date | null | undefined): string {
  if (!val) return "";
  try {
    return new Date(val).toLocaleDateString("en-GB", {
      day: "2-digit", month: "short", year: "numeric",
    });
  } catch { return String(val); }
}

function fmtNum(val: number | string | null | undefined): number | string {
  if (val == null) return "";
  const n = Number(val);
  return isNaN(n) ? String(val) : n;
}

/** Apply header styles to row 0 of a sheet. */
function applyHeaderRow(ws: XLSX.WorkSheet, cols: number, accent: string) {
  for (let c = 0; c < cols; c++) {
    const addr = XLSX.utils.encode_cell({ r: 0, c });
    if (ws[addr]) ws[addr].s = headerStyle(accent);
  }
}

/** Apply alternating row styles + borders to all data rows (row 1 onwards). */
function applyDataRows(
  ws: XLSX.WorkSheet,
  totalRows: number,
  totalCols: number,
  numericCols: number[] = [],
  pctCols: number[] = [],
  startRow = 1,
) {
  for (let r = startRow; r < startRow + totalRows; r++) {
    const rowIdx = r - startRow; // 0-based for alternating colour
    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) {
        // ensure empty cells still get borders + fill
        ws[addr] = { t: "z" };
      }
      const align = numericCols.includes(c) || pctCols.includes(c) ? "right" : "left";
      ws[addr].s = dataStyle(rowIdx, align);
      // Apply number format
      if (numericCols.includes(c) && typeof ws[addr].v === "number") {
        ws[addr].z = "#,##0";
      }
      if (pctCols.includes(c) && typeof ws[addr].v === "number") {
        ws[addr].z = "0.00%";
      }
    }
  }
}

function setCols(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

function freezeHeader(ws: XLSX.WorkSheet) {
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };
}

// ─── Sheet builders ───────────────────────────────────────────────────────────

function buildSummarySheet(data: any): XLSX.WorkSheet {
  const { summary, exportedAt } = data;
  const accent = ACCENT.summary;

  const rows: any[][] = [
    // Row 0: spacer title block (merged)
    ["INFLUENCER TRACKER", ""],
    [`Export generated: ${fmtDate(exportedAt)}`, ""],
    ["", ""],
    // Row 3: KPI section header
    ["KEY PERFORMANCE INDICATORS", ""],
    ["Metric", "Value"],
    ["Total Videos",            fmtNum(summary.totalVideos)],
    ["Total Views (all-time)",  fmtNum(summary.totalViews)],
    ["Avg Engagement Rate",     `${Number(summary.avgEngagementRate ?? 0).toFixed(2)}%`],
    ["Total Channels",          fmtNum(summary.totalChannels)],
    ["Total Sponsorships",      fmtNum(summary.totalSponsorships)],
    ["", ""],
    // Row 10: by-channel section
    ["VIDEOS BY CHANNEL", ""],
    ["Channel", "Video Count"],
    ...(summary.byInfluencer ?? []).map((r: any) => [r.influencerName ?? "Unknown", fmtNum(r.count)]),
    ["", ""],
    // by-platform section
    ["VIDEOS BY PLATFORM", ""],
    ["Platform", "Video Count"],
    ...(summary.byPlatform ?? []).map((r: any) => [r.platform, fmtNum(r.count)]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // Merges
  const lastRow = rows.length;
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: 1 } },
    { s: { r: 3, c: 0 }, e: { r: 3, c: 1 } },
    { s: { r: 10, c: 0 }, e: { r: 10, c: 1 } },
  ];

  // Title
  if (ws["A1"]) ws["A1"].s = titleStyle();
  if (ws["A2"]) ws["A2"].s = subTitleStyle();

  // Section headers
  [3, 10].forEach((r) => {
    const addr = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[addr]) ws[addr].s = sectionHeaderStyle(accent);
  });

  // KPI header row (row 4)
  [0, 1].forEach((c) => {
    const addr = XLSX.utils.encode_cell({ r: 4, c });
    if (ws[addr]) ws[addr].s = headerStyle(accent);
  });

  // KPI data rows (rows 5–9)
  for (let r = 5; r <= 9; r++) {
    [0, 1].forEach((c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      ws[addr].s = dataStyle(r - 5, c === 1 ? "right" : "left");
    });
  }

  // By-channel header (row 11) + data rows
  [0, 1].forEach((c) => {
    const addr = XLSX.utils.encode_cell({ r: 11, c });
    if (ws[addr]) ws[addr].s = headerStyle(accent);
  });
  const byInfluencerCount = (summary.byInfluencer ?? []).length;
  for (let r = 12; r < 12 + byInfluencerCount; r++) {
    [0, 1].forEach((c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      ws[addr].s = dataStyle(r - 12, c === 1 ? "right" : "left");
    });
  }

  // By-platform section header + data
  const platformSectionRow = 12 + byInfluencerCount + 1;
  const addr0 = XLSX.utils.encode_cell({ r: platformSectionRow, c: 0 });
  if (ws[addr0]) ws[addr0].s = sectionHeaderStyle(accent);
  ws["!merges"]!.push({ s: { r: platformSectionRow, c: 0 }, e: { r: platformSectionRow, c: 1 } });

  const platformHeaderRow = platformSectionRow + 1;
  [0, 1].forEach((c) => {
    const addr = XLSX.utils.encode_cell({ r: platformHeaderRow, c });
    if (ws[addr]) ws[addr].s = headerStyle(accent);
  });
  const byPlatformCount = (summary.byPlatform ?? []).length;
  for (let r = platformHeaderRow + 1; r < platformHeaderRow + 1 + byPlatformCount; r++) {
    [0, 1].forEach((c) => {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      ws[addr].s = dataStyle(r - (platformHeaderRow + 1), c === 1 ? "right" : "left");
    });
  }

  setCols(ws, [36, 18]);
  ws["!rows"] = [{ hpt: 28 }, { hpt: 18 }]; // taller title rows
  return ws;
}

function buildVideosSheet(videos: any[]): XLSX.WorkSheet {
  const accent = ACCENT.videos;
  const headers = [
    "Channel / Influencer", "Platform", "Title",
    "Published", "Added", "Duration (s)",
    "Views", "Likes", "Comments",
    "Engagement %", "Video URL",
  ];
  const numericCols = [5, 6, 7, 8];
  const pctCols:number[] = [];

  const rows = videos.map((v) => [
    v.influencerName ?? "",
    v.platform,
    v.title ?? "",
    fmtDate(v.publishedDate),
    fmtDate(v.dateAdded),
    fmtNum(v.durationSeconds),
    fmtNum(v.viewCount),
    fmtNum(v.likes),
    fmtNum(v.comments),
    v.engagementRate ? Number(Number(v.engagementRate).toFixed(4)) : "",
    v.videoUrl ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyHeaderRow(ws, headers.length, accent);
  applyDataRows(ws, rows.length, headers.length, numericCols, [9]);
  freezeHeader(ws);
  setCols(ws, [22, 12, 48, 13, 13, 12, 12, 10, 10, 13, 52]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildViewCountsSheet(viewCounts: any[]): XLSX.WorkSheet {
  const accent = ACCENT.viewCounts;
  const headers = ["Video ID", "Date", "Views", "Likes", "Comments", "Shares", "Engagement %"];
  const numericCols = [2, 3, 4, 5];

  const rows = viewCounts.map((vc) => [
    vc.videoId,
    fmtDate(vc.date),
    fmtNum(vc.viewCount),
    fmtNum(vc.likes),
    fmtNum(vc.comments),
    fmtNum(vc.shares),
    vc.engagementRate ? Number(Number(vc.engagementRate).toFixed(4)) : "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyHeaderRow(ws, headers.length, accent);
  applyDataRows(ws, rows.length, headers.length, numericCols, [6]);
  freezeHeader(ws);
  setCols(ws, [22, 14, 12, 10, 10, 10, 13]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildSponsorshipsSheet(shills: any[]): XLSX.WorkSheet {
  const accent = ACCENT.sponsorships;
  const headers = [
    "Brand", "Video ID", "Timestamp (s)", "Duration (s)",
    "Promo Type", "Notes", "Created At",
  ];
  const numericCols = [2, 3];

  const rows = shills.map((s) => [
    s.productBrand,
    s.videoId,
    fmtNum(s.timestamp),
    fmtNum(s.lengthSeconds),
    s.promoType ?? "",
    s.notes ?? "",
    fmtDate(s.createdAt),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyHeaderRow(ws, headers.length, accent);
  applyDataRows(ws, rows.length, headers.length, numericCols);
  freezeHeader(ws);
  setCols(ws, [26, 22, 14, 12, 28, 36, 16]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildChannelsSheet(channels: any[]): XLSX.WorkSheet {
  const accent = ACCENT.channels;
  const headers = [
    "Channel Name", "Handle", "Channel ID",
    "Subscribers", "Videos Tracked", "Last Sync", "Created At",
  ];
  const numericCols = [3, 4];

  const rows = channels.map((ch) => [
    ch.channelName,
    ch.channelHandle ?? "",
    ch.channelId,
    fmtNum(ch.subscriberCount),
    fmtNum(ch.videoCount),
    fmtDate(ch.lastCheckedAt),
    fmtDate(ch.createdAt),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyHeaderRow(ws, headers.length, accent);
  applyDataRows(ws, rows.length, headers.length, numericCols);
  freezeHeader(ws);
  setCols(ws, [26, 20, 28, 14, 14, 16, 16]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

// ─── Main export function ─────────────────────────────────────────────────────

export function downloadDashboardExcel(data: any) {
  const wb = XLSX.utils.book_new();
  wb.Props = {
    Title:   "Influencer Tracker Export",
    Author:  "Influencer Tracker",
    Subject: "Dashboard Statistics",
    CreatedDate: new Date(),
  };

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data),                    "📊 Summary");
  XLSX.utils.book_append_sheet(wb, buildVideosSheet(data.videos ?? []),         "🎬 Videos");
  XLSX.utils.book_append_sheet(wb, buildViewCountsSheet(data.viewCounts ?? []), "📈 View Counts");
  XLSX.utils.book_append_sheet(wb, buildSponsorshipsSheet(data.sponsorships ?? []), "💰 Sponsorships");
  XLSX.utils.book_append_sheet(wb, buildChannelsSheet(data.channels ?? []),     "📡 Channels");

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `influencer-tracker-${dateStr}.xlsx`, { cellStyles: true });
}
