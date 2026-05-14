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
  // Removed: Engagement % column. Title column is hyperlinked to video URL.
  const headers = [
    "#", "Channel / Influencer", "Platform", "Title",
    "Published", "Added", "Duration (s)",
    "Views", "Likes", "Comments",
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

      // Rank medal for top 3 by views (col 0)
      const rankHeat = c === 0 ? rankColour(i + 1) : null;

      ws[addr].s = dataStyle(i, align, rankHeat?.bg ?? heat?.bg, rankHeat?.text ?? heat?.text);
      if (numericCols.includes(c) && typeof ws[addr].v === "number") ws[addr].z = "#,##0";

      // Hyperlink on Title column (c === 3)
      if (c === 3 && sorted[i]?.videoUrl) {
        ws[addr].l = { Target: sorted[i].videoUrl, Tooltip: sorted[i].title ?? "" };
        if (!rankHeat && !heat) {
          ws[addr].s = { ...ws[addr].s, font: { ...ws[addr].s.font, underline: true, color: { rgb: "1A3A8F" } } };
        }
      }
    }
  }

  freezeHeader(ws);
  setCols(ws, [5, 22, 12, 55, 13, 13, 12, 14, 10, 10]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildViewCountsSheet(viewCounts: any[], videos: any[]): XLSX.WorkSheet {
  const accent = ACCENT.viewCounts;

  // Build a map from videoId -> video object for fast lookup
  const videoMap = new Map<string, any>();
  for (const v of videos) {
    if (v.videoId) videoMap.set(v.videoId, v);
  }

  // Deduplicate: keep only the latest snapshot per video (highest date)
  const latestMap = new Map<string, any>();
  for (const vc of viewCounts) {
    const existing = latestMap.get(vc.videoId);
    if (!existing || new Date(vc.date) > new Date(existing.date)) {
      latestMap.set(vc.videoId, vc);
    }
  }
  const deduped = Array.from(latestMap.values());

  // Columns: Video Title, Channel, Date, Views, Likes, Comments (no Views Bar)
  const headers = ["Video Title", "Channel", "Date", "Views", "Likes", "Comments"];
  const numericCols = [3, 4, 5]; // Views, Likes, Comments

  // Sort by views descending
  const sorted = [...deduped].sort((a, b) => Number(b.viewCount ?? 0) - Number(a.viewCount ?? 0));

  const viewValues = sorted.map((vc) => Number(vc.viewCount ?? 0));
  const likeValues = sorted.map((vc) => Number(vc.likes ?? 0));
  const commentValues = sorted.map((vc) => Number(vc.comments ?? 0));
  const viewPerc = computePercentiles(viewValues);
  const likePerc = computePercentiles(likeValues);
  const commentPerc = computePercentiles(commentValues);

  const rows = sorted.map((vc) => {
    const videoObj = videoMap.get(vc.videoId);
    return [
      videoObj?.title ?? videoObj?.videoId ?? vc.videoId ?? "",
      videoObj?.influencerName ?? "",
      fmtDate(vc.date),
      fmtNum(vc.viewCount),
      fmtNum(vc.likes),
      fmtNum(vc.comments),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyHeaderRow(ws, headers.length, accent);

  for (let i = 0; i < rows.length; i++) {
    const r = i + 1;
    const vc = sorted[i];
    const videoObj = videoMap.get(vc.videoId);
    for (let c = 0; c < headers.length; c++) {
      const addr = XLSX.utils.encode_cell({ r, c });
      if (!ws[addr]) ws[addr] = { t: "z" };
      const align = numericCols.includes(c) ? "right" : "left";

      let heat: { bg: string; text: string } | undefined;
      if (c === 3) heat = heatColour(Number(rows[i][3]) || 0, viewPerc.p33, viewPerc.p66);
      if (c === 4) heat = heatColour(Number(rows[i][4]) || 0, likePerc.p33, likePerc.p66);
      if (c === 5) heat = heatColour(Number(rows[i][5]) || 0, commentPerc.p33, commentPerc.p66);

      ws[addr].s = dataStyle(i, align, heat?.bg, heat?.text);
      if (numericCols.includes(c) && typeof ws[addr].v === "number") ws[addr].z = "#,##0";

      // Add hyperlink on title column
      if (c === 0 && videoObj?.videoUrl) {
        ws[addr].l = { Target: videoObj.videoUrl, Tooltip: videoObj.title ?? "" };
        ws[addr].s = { ...ws[addr].s, font: { ...ws[addr].s.font, underline: true, color: { rgb: "1A3A8F" } } };
      }
    }
  }

  freezeHeader(ws);
  setCols(ws, [56, 22, 14, 14, 12, 12]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildSponsorshipsSheet(shills: any[], videos: any[]): XLSX.WorkSheet {
  const accent = ACCENT.sponsorships;
  // Build video lookup map
  const videoMap = new Map<string, any>();
  for (const v of videos) {
    if (v.videoId) videoMap.set(v.videoId, v);
  }

  const headers = [
    "#", "Brand", "Video Title", "Channel", "Timestamp (s)", "Duration (s)",
    "Promo Type", "Notes", "Created At",
  ];
  const numericCols = [0, 4, 5];

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

  const rows = sorted.map((s, i) => {
    const videoObj = videoMap.get(s.videoId);
    return [
      i + 1,
      s.productBrand,
      videoObj?.title ?? s.videoId ?? "",
      videoObj?.influencerName ?? "",
      fmtNum(s.timestamp),
      fmtNum(s.lengthSeconds),
      s.promoType ?? "",
      s.notes ?? "",
      fmtDate(s.createdAt),
    ];
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  applyHeaderRow(ws, headers.length, accent);

  for (let i = 0; i < rows.length; i++) {
    const r = i + 1;
    const brand = sorted[i]?.productBrand ?? "";
    const brandAccent = brandColourMap.get(brand) ?? ACCENT.sponsorships;
    const videoObj = videoMap.get(sorted[i]?.videoId);
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
      // Add hyperlink on Video Title column (c === 2)
      if (c === 2 && videoObj?.videoUrl) {
        ws[addr].l = { Target: videoObj.videoUrl, Tooltip: videoObj.title ?? "" };
        ws[addr].s = { ...ws[addr].s, font: { ...ws[addr].s.font, underline: true, color: { rgb: "1A3A8F" } } };
      }
    }
  }

  freezeHeader(ws);
  setCols(ws, [5, 26, 52, 22, 14, 12, 20, 36, 16]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildChannelsSheet(channels: any[]): XLSX.WorkSheet {
  const accent = ACCENT.channels;
  // Removed: Handle column. Columns: #, Channel Name, Channel ID, Subscribers, Videos Tracked, Last Sync, Created At
  const headers = [
    "#", "Channel Name", "Channel ID",
    "Subscribers", "Videos Tracked", "Last Sync", "Created At",
  ];
  const numericCols = [0, 3, 4];

  // Sort by subscriber count descending
  const sorted = [...channels].sort((a, b) => Number(b.subscriberCount ?? 0) - Number(a.subscriberCount ?? 0));
  const subValues = sorted.map((ch) => Number(ch.subscriberCount ?? 0));
  const subPerc = computePercentiles(subValues);

  const rows = sorted.map((ch, i) => [
    i + 1,
    ch.channelName,
    ch.channelId,
    // subscriberCount is stored as the full integer (e.g. 232000 for 232K)
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
      } else if (c === 3) {
        // Subscriber count heat-map — format with comma separator (e.g. 232,000)
        const heat = heatColour(Number(rows[i][3]) || 0, subPerc.p33, subPerc.p66);
        ws[addr].s = dataStyle(i, "right", heat.bg, heat.text);
        if (typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      } else {
        ws[addr].s = dataStyle(i, align);
        if (numericCols.includes(c) && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      }
    }
  }

  freezeHeader(ws);
  setCols(ws, [5, 26, 28, 16, 14, 16, 16]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

function buildTopVideosSheet(videos: any[]): XLSX.WorkSheet {
  const accent = ACCENT.performance;
  // Removed: Engagement % column
  const headers = [
    "Rank", "Medal", "Title", "Channel", "Platform",
    "Views", "Likes", "Comments", "Published",
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
      const align = [0, 5, 6, 7].includes(c) ? "right" : (c === 1 ? "center" : "left");

      const rankHeat = c === 0 ? rankColour(i + 1) : null;
      const viewHeat = c === 5 ? heatColour(Number(rows[i][5]) || 0, viewPerc.p33, viewPerc.p66) : null;

      ws[addr].s = dataStyle(i, align, rankHeat?.bg ?? viewHeat?.bg, rankHeat?.text ?? viewHeat?.text);
      if ([0, 5, 6, 7].includes(c) && typeof ws[addr].v === "number") ws[addr].z = "#,##0";

      // Hyperlink on Title column (c === 2)
      if (c === 2 && top20[i]?.videoUrl) {
        ws[addr].l = { Target: top20[i].videoUrl, Tooltip: top20[i].title ?? "" };
        if (!rankHeat && !viewHeat) {
          ws[addr].s = { ...ws[addr].s, font: { ...ws[addr].s.font, underline: true, color: { rgb: "1A3A8F" } } };
        }
      }
    }
  }

  freezeHeader(ws);
  setCols(ws, [7, 7, 55, 22, 12, 14, 10, 10, 14]);
  ws["!rows"] = [{ hpt: 22 }];
  return ws;
}

// ─── Daily Reports sheet ────────────────────────────────────────────────────

/** Parse channel blocks from a daily report's content string */
function parseReportChannels(content: string): Array<{
  name: string;
  views: number;
  likes: number;
  comments: number;
  sponsorships: number;
  bestTitle: string;
  bestViews: number;
  videos: Array<{ title: string; views: number; likes: number; comments: number; isBest: boolean }>;
}> {
  const channelBlocks = content.split(/\n(?=### )/).filter((b) => b.startsWith("### "));
  return channelBlocks.map((block) => {
    const lines = block.split("\n");
    const name = lines[0]?.slice(4).trim() ?? "";
    const statsLine = lines.find((l) => l.startsWith("- Views:")) ?? "";
    const views = parseInt((statsLine.match(/Views:\s*([\d,]+)/) ?? [])[1]?.replace(/,/g, "") ?? "0");
    const likes = parseInt((statsLine.match(/Likes:\s*([\d,]+)/) ?? [])[1]?.replace(/,/g, "") ?? "0");
    const comments = parseInt((statsLine.match(/Comments:\s*([\d,]+)/) ?? [])[1]?.replace(/,/g, "") ?? "0");
    const sponsorships = parseInt((statsLine.match(/Sponsorships:\s*([\d,]+)/) ?? [])[1]?.replace(/,/g, "") ?? "0");

    // Parse individual video lines ("  ★ BEST Title: **views** views | ♥ likes | ⎵ comments" or "  › Title: views views")
    const videoLines = lines.filter((l) => /^\s+[★›]/.test(l));
    const videos = videoLines.map((l) => {
      const isBest = l.includes("★ BEST");
      const clean = l.replace(/^\s+[★›]\s*(BEST\s*)?/, "");
      const vViewsMatch = clean.match(/:\s*\*{0,2}([\d,]+)\s*views/);
      const vLikesMatch = clean.match(/♥\s*([\d,]+)/);
      const vCommentsMatch = clean.match(/⎵\s*([\d,]+)/);
      const title = clean.split(":")[0]?.trim() ?? "";
      return {
        title,
        views: parseInt((vViewsMatch?.[1] ?? "0").replace(/,/g, "")),
        likes: parseInt((vLikesMatch?.[1] ?? "0").replace(/,/g, "")),
        comments: parseInt((vCommentsMatch?.[1] ?? "0").replace(/,/g, "")),
        isBest,
      };
    });

    const bestLine = lines.find((l) => l.includes("★ BEST")) ?? "";
    let bestTitle = "";
    let bestViews = 0;
    if (bestLine) {
      const m = bestLine.replace(/^\s*★ BEST\s*/, "").match(/^(.+?):\s*\*{0,2}([\d,]+)\s*views/);
      if (m) { bestTitle = m[1].trim(); bestViews = parseInt(m[2].replace(/,/g, "")); }
    }
    return { name, views, likes, comments, sponsorships, bestTitle, bestViews, videos };
  });
}

function buildDailyReportsSheet(reports: any[]): XLSX.WorkSheet {
  const ACCENT_REPORT = "1A3A5C"; // deep slate-blue
  const CHART_COLS = 9; // columns used for the visual section
  const TABLE_COLS = 6; // Video Title | Views | Likes | Comments | Sponsorships | Best?

  // Only daily reports, newest first
  const dailyReports = [...reports]
    .filter((r) => r.type === "daily")
    .sort((a, b) => new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());

  const rows: any[][] = [];
  // Track styling metadata per row: { type, meta }
  type RowMeta =
    | { type: "title" }
    | { type: "subtitle" }
    | { type: "spacer" }
    | { type: "reportHeader" }
    | { type: "chartSectionHeader" }
    | { type: "chartBar"; chIdx: number; barWidth: number; maxBar: number }
    | { type: "chartSpacer" }
    | { type: "tableHeader" }
    | { type: "tableRow"; chIdx: number; isBest: boolean }
    | { type: "videoHeader"; chIdx: number }
    | { type: "videoRow"; chIdx: number; isBest: boolean };
  const meta: RowMeta[] = [];

  const push = (row: any[], m: RowMeta) => { rows.push(row); meta.push(m); };

  // ── Global title ──────────────────────────────────────────────────────────────
  push(["DAILY REPORTS — CHANNEL PERFORMANCE", "", "", "", "", "", "", "", ""], { type: "title" });
  push([`Exported: ${fmtDate(new Date())}`, "", "", "", "", "", "", "", ""], { type: "subtitle" });
  push(["", "", "", "", "", "", "", "", ""], { type: "spacer" });

  for (const report of dailyReports) {
    const channels = parseReportChannels(report.content ?? "");
    if (channels.length === 0) continue;

    // ── Report header ─────────────────────────────────────────────────────────
    push([
      `📅 ${report.title ?? "Daily Report"}`,
      `Period: ${report.periodStart ?? ""} → ${report.periodEnd ?? ""}`,
      "", "",
      `Total Views: ${(report.totalViews ?? 0).toLocaleString()}`,
      "",
      `Active Videos: ${report.totalVideos ?? 0}`,
      "",
      `Generated: ${fmtDate(report.createdAt)}`,
    ], { type: "reportHeader" });

    // ── Visual bar chart section: channels sorted ASCENDING by views ──────────
    const sortedAsc = [...channels].sort((a, b) => a.views - b.views);
    const maxViews = Math.max(...sortedAsc.map((c) => c.views), 1);
    const BAR_MAX = 30; // max Unicode bar width

    push(["CHANNEL VIEWS COMPARISON", "", "", "", "", "", "", "", ""], { type: "chartSectionHeader" });
    push(["Channel", "Views", "Likes", "Comments", "Sponsorships", "Views Bar", "", "", ""], { type: "tableHeader" });

    sortedAsc.forEach((ch, chIdx) => {
      const bw = Math.round((ch.views / maxViews) * BAR_MAX);
      push([
        ch.name,
        ch.views,
        ch.likes,
        ch.comments,
        ch.sponsorships,
        "█".repeat(bw) + "░".repeat(BAR_MAX - bw),
        "", "", "",
      ], { type: "chartBar", chIdx, barWidth: bw, maxBar: BAR_MAX });
    });

    push(["", "", "", "", "", "", "", "", ""], { type: "chartSpacer" });

    // ── Per-channel video breakdown tables ────────────────────────────────────
    channels.forEach((ch, chIdx) => {
      if (ch.videos.length === 0) return;

      // Channel sub-header
      push([
        `📡 ${ch.name}`,
        `Views: ${ch.views.toLocaleString()}`,
        `Likes: ${ch.likes.toLocaleString()}`,
        `Comments: ${ch.comments.toLocaleString()}`,
        `Sponsorships: ${ch.sponsorships}`,
        "", "", "", "",
      ], { type: "videoHeader", chIdx });

      // Video table header
      push(["Video Title", "Views", "Likes", "Comments", "Best?", "", "", "", ""], { type: "tableHeader" });

      // Sort videos ascending by views
      const sortedVideos = [...ch.videos].sort((a, b) => a.views - b.views);
      sortedVideos.forEach((v) => {
        push([
          v.title,
          v.views,
          v.likes,
          v.comments,
          v.isBest ? "★ BEST" : "",
          "", "", "", "",
        ], { type: "videoRow", chIdx, isBest: v.isBest });
      });

      push(["", "", "", "", "", "", "", "", ""], { type: "chartSpacer" });
    });

    push(["", "", "", "", "", "", "", "", ""], { type: "spacer" });
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);

  // ── Apply styles row by row ───────────────────────────────────────────────────
  const merges: XLSX.Range[] = [
    { s: { r: 0, c: 0 }, e: { r: 0, c: CHART_COLS - 1 } },
    { s: { r: 1, c: 0 }, e: { r: 1, c: CHART_COLS - 1 } },
    { s: { r: 2, c: 0 }, e: { r: 2, c: CHART_COLS - 1 } },
  ];

  rows.forEach((_, r) => {
    const m = meta[r];
    if (!m) return;

    if (m.type === "title") {
      const addr = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[addr]) ws[addr].s = {
        font:      { bold: true, sz: 18, name: "Calibri", color: { rgb: WHITE } },
        fill:      { fgColor: { rgb: ACCENT_REPORT }, patternType: "solid" },
        alignment: { horizontal: "left", vertical: "center" },
      };
    }

    if (m.type === "subtitle") {
      const addr = XLSX.utils.encode_cell({ r, c: 0 });
      if (ws[addr]) ws[addr].s = subTitleStyle();
    }

    if (m.type === "reportHeader") {
      merges.push({ s: { r, c: 0 }, e: { r, c: CHART_COLS - 1 } });
      for (let c = 0; c < CHART_COLS; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "z" };
        ws[addr].s = {
          font:      { bold: true, sz: 12, name: "Calibri", color: { rgb: WHITE } },
          fill:      { fgColor: { rgb: ACCENT_REPORT }, patternType: "solid" },
          alignment: { horizontal: c === 0 ? "left" : "center", vertical: "center" },
          border: { bottom: { style: "medium", color: { rgb: ACCENT_REPORT } } },
        };
      }
    }

    if (m.type === "chartSectionHeader") {
      merges.push({ s: { r, c: 0 }, e: { r, c: CHART_COLS - 1 } });
      const addr = XLSX.utils.encode_cell({ r, c: 0 });
      if (!ws[addr]) ws[addr] = { t: "z" };
      ws[addr].s = sectionHeaderStyle("2563EB"); // bright blue
    }

    if (m.type === "tableHeader") {
      for (let c = 0; c < TABLE_COLS; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "z" };
        ws[addr].s = headerStyle(ACCENT_REPORT);
      }
    }

    if (m.type === "chartBar") {
      const chAccent = CHANNEL_ACCENTS[m.chIdx % CHANNEL_ACCENTS.length];
      for (let c = 0; c < CHART_COLS; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "z" };
        if (c === 0) {
          ws[addr].s = {
            font:      { bold: true, sz: 10, name: "Calibri", color: { rgb: WHITE } },
            fill:      { fgColor: { rgb: chAccent }, patternType: "solid" },
            alignment: { horizontal: "left", vertical: "center" },
            border: { top: { style: "thin", color: { rgb: BORDER_CLR } }, bottom: { style: "thin", color: { rgb: BORDER_CLR } }, left: { style: "thin", color: { rgb: BORDER_CLR } }, right: { style: "thin", color: { rgb: BORDER_CLR } } },
          };
        } else if (c === 5) {
          // Bar column — fill with channel colour proportional to bar width
          const fillPct = m.barWidth / m.maxBar;
          const barBg = fillPct >= 0.66 ? HEAT.high.bg : fillPct >= 0.33 ? HEAT.mid.bg : HEAT.low.bg;
          ws[addr].s = {
            font:      { sz: 9, name: "Courier New", color: { rgb: barBg === HEAT.high.bg ? "FFFFFF" : "1F2937" } },
            fill:      { fgColor: { rgb: "F1F5F9" }, patternType: "solid" },
            alignment: { horizontal: "left", vertical: "center" },
            border: { top: { style: "thin", color: { rgb: BORDER_CLR } }, bottom: { style: "thin", color: { rgb: BORDER_CLR } }, left: { style: "thin", color: { rgb: BORDER_CLR } }, right: { style: "thin", color: { rgb: BORDER_CLR } } },
          };
        } else if ([1, 2, 3, 4].includes(c)) {
          ws[addr].s = dataStyle(m.chIdx, "right");
          if (typeof ws[addr].v === "number") ws[addr].z = "#,##0";
        } else {
          ws[addr].s = dataStyle(m.chIdx, "left");
        }
      }
    }

    if (m.type === "videoHeader") {
      const chAccent = CHANNEL_ACCENTS[m.chIdx % CHANNEL_ACCENTS.length];
      merges.push({ s: { r, c: 0 }, e: { r, c: TABLE_COLS - 1 } });
      for (let c = 0; c < TABLE_COLS; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "z" };
        ws[addr].s = {
          font:      { bold: true, sz: 11, name: "Calibri", color: { rgb: WHITE } },
          fill:      { fgColor: { rgb: chAccent }, patternType: "solid" },
          alignment: { horizontal: c === 0 ? "left" : "center", vertical: "center" },
          border: { bottom: { style: "medium", color: { rgb: chAccent } } },
        };
      }
    }

    if (m.type === "videoRow") {
      for (let c = 0; c < TABLE_COLS; c++) {
        const addr = XLSX.utils.encode_cell({ r, c });
        if (!ws[addr]) ws[addr] = { t: "z" };
        const isNumeric = [1, 2, 3].includes(c);
        const align: "left" | "right" = isNumeric ? "right" : "left";
        if (m.isBest) {
          // Best video row — gold highlight
          ws[addr].s = {
            font:      { bold: true, sz: 10, name: "Calibri", color: { rgb: "FFFFFF" } },
            fill:      { fgColor: { rgb: HEAT.top1.bg }, patternType: "solid" },
            alignment: { horizontal: align, vertical: "center" },
            border: { top: { style: "thin", color: { rgb: BORDER_CLR } }, bottom: { style: "thin", color: { rgb: BORDER_CLR } }, left: { style: "thin", color: { rgb: BORDER_CLR } }, right: { style: "thin", color: { rgb: BORDER_CLR } } },
          };
        } else {
          ws[addr].s = dataStyle(m.chIdx, align);
        }
        if (isNumeric && typeof ws[addr].v === "number") ws[addr].z = "#,##0";
      }
    }
  });

  ws["!merges"] = merges;
  setCols(ws, [52, 14, 12, 12, 12, 36, 10, 10, 10]);
  ws["!rows"] = [{ hpt: 32 }, { hpt: 16 }, { hpt: 8 }];
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
  XLSX.utils.book_append_sheet(wb, buildVideosSheet(data.videos ?? []),             "🎥 All Videos");
  XLSX.utils.book_append_sheet(wb, buildViewCountsSheet(data.viewCounts ?? [], data.videos ?? []), "📈 View Counts");
  XLSX.utils.book_append_sheet(wb, buildSponsorshipsSheet(data.sponsorships ?? [], data.videos ?? []), "💰 Sponsorships");
  XLSX.utils.book_append_sheet(wb, buildChannelsSheet(data.channels ?? []),         "📡 Channels");
  if ((data.reports ?? []).length > 0) {
    XLSX.utils.book_append_sheet(wb, buildDailyReportsSheet(data.reports ?? []),    "📅 Daily Reports");
  }

  const dateStr = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `influencer-tracker-${dateStr}.xlsx`, { cellStyles: true });
}
