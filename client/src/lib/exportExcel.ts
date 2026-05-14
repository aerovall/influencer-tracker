/**
 * exportExcel.ts
 * Builds a richly-formatted multi-sheet Excel workbook from the analytics.exportStats payload.
 *
 * Design language:
 *   • Sheet accent colours:  Summary=navy, Videos=teal, ViewCounts=indigo, Sponsorships=amber, Channels=forest
 *   • Header row:            white bold text on accent background, 12pt
 *   • Alternating data rows: white / very-light-grey (every other row)
 *   • All data cells:        thin border on all four sides
 *   • Conditional colours:   views/likes/comments get green/yellow/red heat-map based on percentiles
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
  performance:  "2D1B69",   // deep purple for performance sheet
};
const WHITE      = "FFFFFF";
const ROW_ALT    = "F0F4FA";   // very light blue-grey for alternating rows
const ROW_PLAIN  = "FFFFFF";
const BORDER_CLR = "C8CDD6";

// Heat-map colours for conditional formatting
const HEAT = {
  high:   { bg: "D4EDDA", text: "155724" },  // green
  mid:    { bg: "FFF3CD", text: "856404" },  // yellow
  low:    { bg: "F8D7DA", text: "721C24" },  // red
  top1:   { bg: "FFD700", text: "5C3D00" },  // gold (rank #1)
  top2:   { bg: "C0C0C0", text: "3A3A3A" },  // silver (rank #2)
  top3:   { bg: "CD7F32", text: "3A1A00" },  // bronze (rank #3)
};

// Channel accent colours (deterministic per channel index)
const CHANNEL_ACCENTS = [
  "1A3A6E", "1A6E3A", "6E1A3A", "6E6E1A", "3A1A6E",
  "1A6E6E", "6E3A1A", "3A6E1A", "6E1A6E", "1A1A6E",
];

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

function dataStyle(
  rowIdx: number,
  align: "left" | "right" | "center" = "left",
  overrideBg?: string,
  overrideText?: string,
): any {
  const bg = overrideBg ?? (rowIdx % 2 === 0 ? ROW_PLAIN : ROW_ALT);
  const textColor = overrideText ?? "1A1A2E";
  return {
    font:      { sz: 10, name: "Calibri", color: { rgb: textColor } },
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

function boldDataStyle(rowIdx: number, align: "left" | "right" | "center" = "left"): any {
  const bg = rowIdx % 2 === 0 ? ROW_PLAIN : ROW_ALT;
  return {
    font:      { bold: true, sz: 10, name: "Calibri", color: { rgb: "0F2A4A" } },
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
    font:      { bold: true, sz: 18, name: "Calibri", color: { rgb: WHITE } },
    fill:      { fgColor: { rgb: ACCENT.summary }, patternType: "solid" },
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

function kpiValueStyle(accentHex: string): any {
  return {
    font:      { bold: true, sz: 14, name: "Calibri", color: { rgb: accentHex } },
    fill:      { fgColor: { rgb: "F8FAFC" }, patternType: "solid" },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top:    { style: "thin", color: { rgb: BORDER_CLR } },
      bottom: { style: "medium", color: { rgb: accentHex } },
      left:   { style: "thin", color: { rgb: BORDER_CLR } },
      right:  { style: "thin", color: { rgb: BORDER_CLR } },
    },
  };
}

function kpiLabelStyle(): any {
  return {
    font:      { sz: 9, name: "Calibri", color: { rgb: "6B7280" }, italic: true },
    fill:      { fgColor: { rgb: "F8FAFC" }, patternType: "solid" },
    alignment: { horizontal: "center", vertical: "center" },
    border: {
      top:    { style: "thin", color: { rgb: BORDER_CLR } },
      bottom: { style: "thin", color: { rgb: BORDER_CLR } },
      left:   { style: "thin", color: { rgb: BORDER_CLR } },
      right:  { style: "thin", color: { rgb: BORDER_CLR } },
    },
  };
}

function channelHeaderStyle(channelIdx: number): any {
  const accent = CHANNEL_ACCENTS[channelIdx % CHANNEL_ACCENTS.length];
  return {
    font:      { bold: true, sz: 11, name: "Calibri", color: { rgb: WHITE } },
    fill:      { fgColor: { rgb: accent }, patternType: "solid" },
    alignment: { horizontal: "left", vertical: "center" },
    border: {
      top:    { style: "medium", color: { rgb: accent } },
      bottom: { style: "medium", color: { rgb: accent } },
      left:   { style: "medium", color: { rgb: accent } },
      right:  { style: "medium", color: { rgb: accent } },
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

/** Compute percentile thresholds for heat-map colouring */
function computePercentiles(values: number[]): { p33: number; p66: number } {
  if (values.length === 0) return { p33: 0, p66: 0 };
  const sorted = [...values].sort((a, b) => a - b);
  const p33 = sorted[Math.floor(sorted.length * 0.33)] ?? 0;
  const p66 = sorted[Math.floor(sorted.length * 0.66)] ?? 0;
  return { p33, p66 };
}

function heatColour(value: number, p33: number, p66: number): { bg: string; text: string } {
  if (value >= p66) return HEAT.high;
  if (value >= p33) return HEAT.mid;
  return HEAT.low;
}

function rankColour(rank: number): { bg: string; text: string } | null {
  if (rank === 1) return HEAT.top1;
  if (rank === 2) return HEAT.top2;
  if (rank === 3) return HEAT.top3;
  return null;
}

function barChart(value: number, max: number, width = 20): string {
  if (max === 0) return "";
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
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
    const rowIdx = r - startRow;
    for (let c = 0; c < totalCols; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      const align = numericCols.includes(c) || pctCols.includes(c) ? "right" : "left";
      ws[addr].s = dataStyle(rowIdx, align);
      if (numericCols.includes(c) && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      if (pctCols.includes(c) && typeof ws[addr].v === "number") ws[addr].z = "0.00%";
    }
  }
}

function setCols(ws: XLSX.WorkSheet, widths: number[]) {
  ws["!cols"] = widths.map((w) => ({ wch: w }));
}

function freezeHeader(ws: XLSX.WorkSheet) {
  ws["!freeze"] = { xSplit: 0, ySplit: 1, topLeftCell: "A2", activePane: "bottomLeft" };
}

function setCell(ws: XLSX.WorkSheet, r: number, c: number, value: any, style: any, numFmt?: string) {
  const addr = XLSX.utils.encode_cell({ r, c });
  const t = typeof value === "number" ? "n" : value === "" || value == null ? "z" : "s";
  ws[addr] = { t, v: value, s: style };
  if (numFmt) ws[addr].z = numFmt;
  if (!ws["!ref"]) ws["!ref"] = addr;
}

// ─── Sheet builders ───────────────────────────────────────────────────────────

function buildSummarySheet(data: any): XLSX.WorkSheet {
  const { summary, exportedAt } = data;
  const accent = ACCENT.summary;

  // ── Title block ──────────────────────────────────────────────────────────────
  const rows: any[][] = [];

  // Row 0: big title (merged A1:F1)
  rows.push(["INFLUENCER TRACKER — PERFORMANCE REPORT", "", "", "", "", ""]);
  // Row 1: subtitle
  rows.push([`Export generated: ${fmtDate(exportedAt)}`, "", "", "", "", ""]);
  // Row 2: spacer
  rows.push(["", "", "", "", "", ""]);

  // Row 3: KPI labels (6 KPIs across columns A-F)
  rows.push(["Total Videos", "Total Views", "Avg Engagement", "Total Channels", "Total Sponsorships", "Active Platforms"]);
  // Row 4: KPI values
  const platformCount = (summary.byPlatform ?? []).length;
  rows.push([
    fmtNum(summary.totalVideos),
    fmtNum(summary.totalViews),
    `${Number(summary.avgEngagementRate ?? 0).toFixed(2)}%`,
    fmtNum(summary.totalChannels),
    fmtNum(summary.totalSponsorships),
    platformCount,
  ]);
  // Row 5: spacer
  rows.push(["", "", "", "", "", ""]);

  // Row 6: by-channel section header
  rows.push(["CHANNEL PERFORMANCE BREAKDOWN", "", "", "", "", ""]);
  // Row 7: channel table headers
  rows.push(["Channel", "Videos", "Views", "Likes", "Comments", "Sponsorships"]);

  // Row 8+: channel data
  const channelRows: any[][] = [];
  const byInfluencer: any[] = summary.byInfluencer ?? [];
  const channelStats: any[] = summary.channelStats ?? [];
  const channelStatsMap = new Map<string, any>();
  for (const cs of channelStats) channelStatsMap.set(cs.channelName ?? cs.influencerName, cs);

  for (const ch of byInfluencer) {
    const name = ch.influencerName ?? "Unknown";
    const cs = channelStatsMap.get(name) ?? {};
    channelRows.push([
      name,
      fmtNum(ch.count),
      fmtNum(cs.totalViews ?? 0),
      fmtNum(cs.totalLikes ?? 0),
      fmtNum(cs.totalComments ?? 0),
      fmtNum(cs.totalSponsors ?? 0),
    ]);
  }
  rows.push(...channelRows);

  // Spacer after channel table
  rows.push(["", "", "", "", "", ""]);

  // By-platform section
  const platformSectionRow = rows.length;
  rows.push(["VIDEOS BY PLATFORM", "", "", "", "", ""]);
  rows.push(["Platform", "Video Count", "", "", "", ""]);
  for (const p of (summary.byPlatform ?? [])) {
    rows.push([p.platform, fmtNum(p.count), "", "", "", ""]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // ── Merges ───────────────────────────────────────────────────────────────────
  ws["!merges"] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },  // title
    { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },  // subtitle
    { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } },  // spacer
    { s: { r: 6, c: 0 }, e: { r: 6, c: 5 } },  // channel section header
    { s: { r: platformSectionRow, c: 0 }, e: { r: platformSectionRow, c: 5 } },
  ];

  // ── Title row styles ─────────────────────────────────────────────────────────
  if (ws["A1"]) ws["A1"].s = titleStyle();
  if (ws["A2"]) ws["A2"].s = subTitleStyle();

  // ── KPI row styles (rows 3 & 4) ──────────────────────────────────────────────
  const kpiAccents = [ACCENT.summary, ACCENT.videos, ACCENT.viewCounts, ACCENT.channels, ACCENT.sponsorships, ACCENT.performance];
  for (let c = 0; c < 6; c++) {
    const labelAddr = XLSX.utils.encode_cell({ r: 3, c });
    const valueAddr = XLSX.utils.encode_cell({ r: 4, c });
    if (ws[labelAddr]) ws[labelAddr].s = kpiLabelStyle();
    if (ws[valueAddr]) ws[valueAddr].s = kpiValueStyle(kpiAccents[c]);
  }

  // ── Channel section header ───────────────────────────────────────────────────
  const chSecAddr = XLSX.utils.encode_cell({ r: 6, c: 0 });
  if (ws[chSecAddr]) ws[chSecAddr].s = sectionHeaderStyle(accent);

  // Channel table header (row 7)
  for (let c = 0; c < 6; c++) {
    const addr = XLSX.utils.encode_cell({ r: 7, c });
    if (ws[addr]) ws[addr].s = headerStyle(accent);
  }

  // Channel data rows (rows 8+) with per-channel accent colour
  const viewValues = channelRows.map((r) => Number(r[2]) || 0);
  const maxViews = Math.max(...viewValues, 1);
  for (let i = 0; i < channelRows.length; i++) {
    const r = 8 + i;
    const chAccent = CHANNEL_ACCENTS[i % CHANNEL_ACCENTS.length];
    // Channel name cell gets channel accent
    const nameAddr = XLSX.utils.encode_cell({ r, c: 0 });
    if (ws[nameAddr]) ws[nameAddr].s = {
      font:      { bold: true, sz: 10, name: "Calibri", color: { rgb: WHITE } },
      fill:      { fgColor: { rgb: chAccent }, patternType: "solid" },
      alignment: { horizontal: "left", vertical: "center" },
      border: { top: { style: "thin", color: { rgb: BORDER_CLR } }, bottom: { style: "thin", color: { rgb: BORDER_CLR } }, left: { style: "thin", color: { rgb: BORDER_CLR } }, right: { style: "thin", color: { rgb: BORDER_CLR } } },
    };
    // Numeric cells
    for (let c = 1; c < 6; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      const val = Number(channelRows[i][c]) || 0;
      const heat = c === 2 ? heatColour(val, maxViews * 0.33, maxViews * 0.66) : undefined;
      ws[addr].s = dataStyle(i, "right", heat?.bg, heat?.text);
      if (typeof ws[addr].v === "number") ws[addr].z = "#,##0";
    }
  }

  // Platform section header
  const platSecAddr = XLSX.utils.encode_cell({ r: platformSectionRow, c: 0 });
  if (ws[platSecAddr]) ws[platSecAddr].s = sectionHeaderStyle(accent);
  const platHdrRow = platformSectionRow + 1;
  for (let c = 0; c < 2; c++) {
    const addr = XLSX.utils.encode_cell({ r: platHdrRow, c });
    if (ws[addr]) ws[addr].s = headerStyle(accent);
  }
  const byPlatformCount = (summary.byPlatform ?? []).length;
  for (let i = 0; i < byPlatformCount; i++) {
    const r = platHdrRow + 1 + i;
    for (let c = 0; c < 2; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      ws[addr].s = dataStyle(i, c === 1 ? "right" : "left");
      if (c === 1 && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
    }
  }

  setCols(ws, [28, 14, 16, 14, 14, 16]);
  ws["!rows"] = [{ hpt: 36 }, { hpt: 18 }, { hpt: 8 }, { hpt: 22 }, { hpt: 28 }];
  return ws;
}

function buildVideosSheet(videos: any[]): XLSX.WorkSheet {
  const accent = ACCENT.videos;
  const headers = [
    "#", "Channel / Influencer", "Platform", "Title",
    "Published", "Added", "Duration (s)",
    "Views", "Likes", "Comments",
    "Engagement %", "Video URL",
  ];
  const numericCols = [0, 6, 7, 8, 9];

  // Sort by views descending
  const sorted = [...videos].sort((a, b) => Number(b.viewCount ?? 0) - Number(a.viewCount ?? 0));

  // Compute percentile thresholds for heat-map
  const viewValues = sorted.map((v) => Number(v.viewCount ?? 0));
  const likeValues = sorted.map((v) => Number(v.likes ?? 0));
  const commentValues = sorted.map((v) => Number(v.comments ?? 0));
  const viewPerc = computePercentiles(viewValues);
  const likePerc = computePercentiles(likeValues);
  const commentPerc = computePercentiles(commentValues);

  const rows = sorted.map((v, i) => [
    i + 1,
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

  // Apply data rows with heat-map on views (col 7), likes (col 8), comments (col 9)
  for (let i = 0; i < rows.length; i++) {
    const r = i + 1;
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      const align = numericCols.includes(c) ? "right" : "left";

      let heat: { bg: string; text: string } | undefined;
      if (c === 7) heat = heatColour(Number(rows[i][7]) || 0, viewPerc.p33, viewPerc.p66);
      if (c === 8) heat = heatColour(Number(rows[i][8]) || 0, likePerc.p33, likePerc.p66);
      if (c === 9) heat = heatColour(Number(rows[i][9]) || 0, commentPerc.p33, commentPerc.p66);

      // Rank medal for top 3 by views (col 7)
      const rankHeat = c === 0 ? rankColour(i + 1) : null;

      ws[addr].s = dataStyle(i, align, rankHeat?.bg ?? heat?.bg, rankHeat?.text ?? heat?.text);
      if (numericCols.includes(c) && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      if (c === 10 && typeof ws[addr].v === "number") ws[addr].z = "0.00%";
    }
  }

  freezeHeader(ws);
  setCols(ws, [5, 22, 12, 48, 13, 13, 12, 14, 10, 10, 13, 52]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildViewCountsSheet(viewCounts: any[]): XLSX.WorkSheet {
  const accent = ACCENT.viewCounts;
  const headers = ["Video ID", "Date", "Views", "Likes", "Comments", "Shares", "Engagement %", "Views Bar"];
  const numericCols = [2, 3, 4, 5];

  // Compute max views for bar chart
  const maxViews = Math.max(...viewCounts.map((vc) => Number(vc.viewCount ?? 0)), 1);
  const viewValues = viewCounts.map((vc) => Number(vc.viewCount ?? 0));
  const viewPerc = computePercentiles(viewValues);

  const rows = viewCounts.map((vc) => [
    vc.videoId,
    fmtDate(vc.date),
    fmtNum(vc.viewCount),
    fmtNum(vc.likes),
    fmtNum(vc.comments),
    fmtNum(vc.shares),
    vc.engagementRate ? Number(Number(vc.engagementRate).toFixed(4)) : "",
    barChart(Number(vc.viewCount ?? 0), maxViews, 15),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyHeaderRow(ws, headers.length, accent);

  for (let i = 0; i < rows.length; i++) {
    const r = i + 1;
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      const align = numericCols.includes(c) ? "right" : (c === 7 ? "left" : "left");

      let heat: { bg: string; text: string } | undefined;
      if (c === 2) heat = heatColour(Number(rows[i][2]) || 0, viewPerc.p33, viewPerc.p66);

      ws[addr].s = dataStyle(i, align, heat?.bg, heat?.text);
      if (numericCols.includes(c) && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      if (c === 6 && typeof ws[addr].v === "number") ws[addr].z = "0.00%";
    }
  }

  freezeHeader(ws);
  setCols(ws, [22, 14, 14, 10, 10, 10, 13, 20]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildSponsorshipsSheet(shills: any[]): XLSX.WorkSheet {
  const accent = ACCENT.sponsorships;
  const headers = [
    "#", "Brand", "Video ID", "Timestamp (s)", "Duration (s)",
    "Promo Type", "Notes", "Created At",
  ];
  const numericCols = [0, 3, 4];

  // Sort by brand then timestamp
  const sorted = [...shills].sort((a, b) =>
    (a.productBrand ?? "").localeCompare(b.productBrand ?? "") ||
    Number(a.timestamp ?? 0) - Number(b.timestamp ?? 0)
  );

  // Group by brand for colour banding
  const brandColourMap = new Map<string, string>();
  const brandAccents = ["7B3F00", "5C2D00", "8B4513", "A0522D", "6B3A2A"];
  let brandIdx = 0;
  for (const s of sorted) {
    const brand = s.productBrand ?? "Unknown";
    if (!brandColourMap.has(brand)) {
      brandColourMap.set(brand, brandAccents[brandIdx % brandAccents.length]);
      brandIdx++;
    }
  }

  const rows = sorted.map((s, i) => [
    i + 1,
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

  for (let i = 0; i < rows.length; i++) {
    const r = i + 1;
    const brand = sorted[i]?.productBrand ?? "";
    const brandAccent = brandColourMap.get(brand) ?? ACCENT.sponsorships;
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      const align = numericCols.includes(c) ? "right" : "left";
      // Brand column gets brand accent colour
      if (c === 1) {
        ws[addr].s = {
          font:      { bold: true, sz: 10, name: "Calibri", color: { rgb: WHITE } },
          fill:      { fgColor: { rgb: brandAccent }, patternType: "solid" },
          alignment: { horizontal: "left", vertical: "center" },
          border: { top: { style: "thin", color: { rgb: BORDER_CLR } }, bottom: { style: "thin", color: { rgb: BORDER_CLR } }, left: { style: "thin", color: { rgb: BORDER_CLR } }, right: { style: "thin", color: { rgb: BORDER_CLR } } },
        };
      } else {
        ws[addr].s = dataStyle(i, align);
      }
      if (numericCols.includes(c) && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
    }
  }

  freezeHeader(ws);
  setCols(ws, [5, 26, 22, 14, 12, 28, 36, 16]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildChannelsSheet(channels: any[]): XLSX.WorkSheet {
  const accent = ACCENT.channels;
  const headers = [
    "#", "Channel Name", "Handle", "Channel ID",
    "Subscribers", "Videos Tracked", "Last Sync", "Created At",
  ];
  const numericCols = [0, 4, 5];

  // Sort by subscriber count descending
  const sorted = [...channels].sort((a, b) => Number(b.subscriberCount ?? 0) - Number(a.subscriberCount ?? 0));
  const subValues = sorted.map((ch) => Number(ch.subscriberCount ?? 0));
  const subPerc = computePercentiles(subValues);

  const rows = sorted.map((ch, i) => [
    i + 1,
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

  for (let i = 0; i < rows.length; i++) {
    const r = i + 1;
    const chAccent = CHANNEL_ACCENTS[i % CHANNEL_ACCENTS.length];
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      const align = numericCols.includes(c) ? "right" : "left";

      // Channel name gets channel accent
      if (c === 1) {
        ws[addr].s = {
          font:      { bold: true, sz: 10, name: "Calibri", color: { rgb: WHITE } },
          fill:      { fgColor: { rgb: chAccent }, patternType: "solid" },
          alignment: { horizontal: "left", vertical: "center" },
          border: { top: { style: "thin", color: { rgb: BORDER_CLR } }, bottom: { style: "thin", color: { rgb: BORDER_CLR } }, left: { style: "thin", color: { rgb: BORDER_CLR } }, right: { style: "thin", color: { rgb: BORDER_CLR } } },
        };
      } else if (c === 4) {
        // Subscriber count heat-map
        const heat = heatColour(Number(rows[i][4]) || 0, subPerc.p33, subPerc.p66);
        ws[addr].s = dataStyle(i, "right", heat.bg, heat.text);
        if (typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      } else {
        ws[addr].s = dataStyle(i, align);
        if (numericCols.includes(c) && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      }
    }
  }

  freezeHeader(ws);
  setCols(ws, [5, 26, 20, 28, 16, 14, 16, 16]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildTopVideosSheet(videos: any[]): XLSX.WorkSheet {
  const accent = ACCENT.performance;
  const headers = [
    "Rank", "Medal", "Title", "Channel", "Platform",
    "Views", "Likes", "Comments", "Engagement %", "Published",
  ];

  // Sort by views descending, take top 20
  const top20 = [...videos]
    .sort((a, b) => Number(b.viewCount ?? 0) - Number(a.viewCount ?? 0))
    .slice(0, 20);

  const medals = ["🥇", "🥈", "🥉"];

  const rows = top20.map((v, i) => [
    i + 1,
    medals[i] ?? `#${i + 1}`,
    v.title ?? "",
    v.influencerName ?? "",
    v.platform ?? "",
    fmtNum(v.viewCount),
    fmtNum(v.likes),
    fmtNum(v.comments),
    v.engagementRate ? Number(Number(v.engagementRate).toFixed(4)) : "",
    fmtDate(v.publishedDate),
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyHeaderRow(ws, headers.length, accent);

  const viewValues = top20.map((v) => Number(v.viewCount ?? 0));
  const viewPerc = computePercentiles(viewValues);

  for (let i = 0; i < rows.length; i++) {
    const r = i + 1;
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      const align = [0, 5, 6, 7, 8].includes(c) ? "right" : (c === 1 ? "center" : "left");

      const rankHeat = c === 0 ? rankColour(i + 1) : null;
      const viewHeat = c === 5 ? heatColour(Number(rows[i][5]) || 0, viewPerc.p33, viewPerc.p66) : null;

      ws[addr].s = dataStyle(i, align, rankHeat?.bg ?? viewHeat?.bg, rankHeat?.text ?? viewHeat?.text);
      if ([0, 5, 6, 7].includes(c) && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      if (c === 8 && typeof ws[addr].v === "number") ws[addr].z = "0.00%";
    }
  }

  freezeHeader(ws);
  setCols(ws, [7, 7, 50, 22, 12, 14, 10, 10, 13, 14]);
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

  XLSX.utils.book_append_sheet(wb, buildSummarySheet(data),                        "📊 Summary");
  XLSX.utils.book_append_sheet(wb, buildTopVideosSheet(data.videos ?? []),          "🏆 Top Videos");
  XLSX.utils.book_append_sheet(wb, buildVideosSheet(data.videos ?? []),             "🎬 All Videos");
  XLSX.utils.book_append_sheet(wb, buildViewCountsSheet(data.viewCounts ?? []),     "📈 View Counts");
  XLSX.utils.book_append_sheet(wb, buildSponsorshipsSheet(data.sponsorships ?? []), "💰 Sponsorships");
  XLSX.utils.book_append_sheet(wb, buildChannelsSheet(data.channels ?? []),         "📡 Channels");

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `influencer-tracker-${dateStr}.xlsx`, { cellStyles: true });
}
