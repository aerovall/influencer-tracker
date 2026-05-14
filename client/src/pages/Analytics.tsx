import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { InfluencerBadge, PlatformBadge, formatNumber, formatEngagement } from "@/components/Badges";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, AreaChart, Area,
} from "recharts";
import { BarChart3, TrendingUp, Eye, ThumbsUp } from "lucide-react";
import { useMemo, useState } from "react";

const PLATFORMS = ["All", "YouTube", "Instagram", "TikTok"] as const;
const DAYS_OPTIONS = [7, 14, 30, 60, 90] as const;
const PALETTE = [
  "oklch(0.78 0.15 80)",
  "oklch(0.65 0.18 200)",
  "oklch(0.70 0.18 150)",
  "oklch(0.72 0.18 25)",
  "oklch(0.68 0.18 330)",
  "oklch(0.75 0.15 140)",
  "oklch(0.65 0.20 270)",
  "oklch(0.80 0.12 60)",
];
function getChannelColor(name: string, allNames: string[]) {
  const idx = allNames.indexOf(name);
  return PALETTE[idx % PALETTE.length] ?? PALETTE[0];
}

const PLATFORM_COLORS: Record<string, string> = {
  YouTube: "oklch(0.65 0.22 25)",
  Instagram: "oklch(0.65 0.20 330)",
  TikTok: "oklch(0.65 0.18 200)",
};

const TOOLTIP_STYLE = {
  contentStyle: { background: "oklch(0.16 0.025 255)", border: "1px solid oklch(0.25 0.03 255)", borderRadius: 8 },
  labelStyle: { color: "oklch(0.95 0.01 255)" },
};

export default function Analytics() {
  const [days, setDays] = useState<number>(30);
  const [influencerFilter, setInfluencerFilter] = useState("All");
  const [platformFilter, setPlatformFilter] = useState("All");

  const { data: trends, isLoading } = trpc.analytics.trends.useQuery({ days });

  // Derive unique channel names dynamically from data
  const channelNames = useMemo(() => {
    if (!trends) return [] as string[];
    return Array.from(new Set(trends.map((r) => r.influencerName))).sort();
  }, [trends]);
  const influencerOptions = useMemo(() => ["All", ...channelNames], [channelNames]);

  // Filter trends
  const filteredTrends = useMemo(() => {
    if (!trends) return [];
    return trends.filter((row) => {
      if (influencerFilter !== "All" && row.influencerName !== influencerFilter) return false;
      if (platformFilter !== "All" && row.platform !== platformFilter) return false;
      return true;
    });
  }, [trends, influencerFilter, platformFilter]);

  // Daily views by influencer
  const viewsByInfluencer = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>();
    for (const row of filteredTrends) {
      if (!byDate.has(row.date)) byDate.set(row.date, {});
      const entry = byDate.get(row.date)!;
      entry[row.influencerName] = (entry[row.influencerName] ?? 0) + Number(row.viewCount);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date: date.slice(5), ...vals }));
  }, [filteredTrends]);

  // Daily views by platform
  const viewsByPlatform = useMemo(() => {
    const byDate = new Map<string, Record<string, number>>();
    for (const row of filteredTrends) {
      if (!byDate.has(row.date)) byDate.set(row.date, {});
      const entry = byDate.get(row.date)!;
      entry[row.platform] = (entry[row.platform] ?? 0) + Number(row.viewCount);
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, vals]) => ({ date: date.slice(5), ...vals }));
  }, [filteredTrends]);

  // Engagement rate over time
  const engagementTrend = useMemo(() => {
    const byDate = new Map<string, { total: number; count: number }>();
    for (const row of filteredTrends) {
      if (!byDate.has(row.date)) byDate.set(row.date, { total: 0, count: 0 });
      const entry = byDate.get(row.date)!;
      entry.total += parseFloat(String(row.engagementRate ?? 0));
      entry.count += 1;
    }
    return Array.from(byDate.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { total, count }]) => ({
        date: date.slice(5),
        engagementRate: count > 0 ? parseFloat((total / count).toFixed(4)) : 0,
      }));
  }, [filteredTrends]);

  // Top videos by total views
  const topVideos = useMemo(() => {
    const byVideo = new Map<string, { title: string; influencer: string; platform: string; views: number; likes: number; comments: number; engagement: number }>();
    for (const row of filteredTrends) {
      if (!byVideo.has(row.videoId)) {
        byVideo.set(row.videoId, { title: row.title, influencer: row.influencerName, platform: row.platform, views: 0, likes: 0, comments: 0, engagement: 0 });
      }
      const entry = byVideo.get(row.videoId)!;
      entry.views = Math.max(entry.views, Number(row.viewCount));
      entry.likes = Math.max(entry.likes, Number(row.likes ?? 0));
      entry.comments = Math.max(entry.comments, Number(row.comments ?? 0));
      entry.engagement = Math.max(entry.engagement, parseFloat(String(row.engagementRate ?? 0)));
    }
    return Array.from(byVideo.values())
      .sort((a, b) => b.views - a.views)
      .slice(0, 10);
  }, [filteredTrends]);

  // Summary stats
  const summaryStats = useMemo(() => {
    const totalViews = topVideos.reduce((s, v) => s + v.views, 0);
    const totalLikes = topVideos.reduce((s, v) => s + v.likes, 0);
    const totalComments = topVideos.reduce((s, v) => s + v.comments, 0);
    const avgEng = topVideos.length > 0
      ? topVideos.reduce((s, v) => s + v.engagement, 0) / topVideos.length
      : 0;
    return { totalViews, totalLikes, totalComments, avgEng };
  }, [topVideos]);

  return (
    <div className="space-y-6 p-2">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Performance trends per influencer and platform</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DAYS_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>Last {d}d</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={influencerFilter} onValueChange={setInfluencerFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {influencerOptions.map((n) => <SelectItem key={n} value={n}>{n === "All" ? "All Influencers" : n}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={platformFilter} onValueChange={setPlatformFilter}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p === "All" ? "All Platforms" : p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Views", value: formatNumber(summaryStats.totalViews), icon: Eye },
          { label: "Total Likes", value: formatNumber(summaryStats.totalLikes), icon: ThumbsUp },
          { label: "Total Comments", value: formatNumber(summaryStats.totalComments), icon: BarChart3 },
          { label: "Avg Engagement", value: formatEngagement(summaryStats.avgEng), icon: TrendingUp },
        ].map(({ label, value, icon: Icon }) => (
          <Card key={label} className="border-border/50 bg-card/80">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Icon className="h-4 w-4" style={{ color: "oklch(0.78 0.15 80)" }} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold">{value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Views by Influencer */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Views by Influencer</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-56 w-full" /> : viewsByInfluencer.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">No data for this period.</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={viewsByInfluencer}>
                <defs>
                  {channelNames.map((name) => (
                    <linearGradient key={name} id={`grad-${name}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={getChannelColor(name, channelNames)} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={getChannelColor(name, channelNames)} stopOpacity={0} />
                    </linearGradient>
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 255)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.02 255)" }} />
                <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.02 255)" }} tickFormatter={formatNumber} />
                <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatNumber(v), ""]} />
                <Legend />
                {channelNames.map((name) => (
                  <Area
                    key={name}
                    type="monotone"
                    dataKey={name}
                    stroke={getChannelColor(name, channelNames)}
                    fill={`url(#grad-${name})`}
                    strokeWidth={2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Views by Platform + Engagement */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Views by Platform</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : viewsByPlatform.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={viewsByPlatform}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 255)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.02 255)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.02 255)" }} tickFormatter={formatNumber} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [formatNumber(v), ""]} />
                  <Legend />
                  {["YouTube", "Instagram", "TikTok"].map((p) => (
                    <Bar key={p} dataKey={p} fill={PLATFORM_COLORS[p]} stackId="a" radius={[2, 2, 0, 0]} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">Avg Engagement Rate Over Time</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? <Skeleton className="h-48 w-full" /> : engagementTrend.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">No data.</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={engagementTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 255)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.02 255)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.02 255)" }} tickFormatter={(v) => `${v.toFixed(1)}%`} />
                  <Tooltip {...TOOLTIP_STYLE} formatter={(v: number) => [`${v.toFixed(2)}%`, "Engagement"]} />
                  <Line type="monotone" dataKey="engagementRate" stroke="oklch(0.78 0.15 80)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Top Videos Table */}
      <Card className="border-border/50 bg-card/80">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Top Videos by Views</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {topVideos.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">No video data available.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Video</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Influencer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Views</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Likes</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Comments</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Engagement</th>
                  </tr>
                </thead>
                <tbody>
                  {topVideos.map((video, idx) => (
                    <tr key={idx} className={`border-b border-border/30 hover:bg-accent/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 max-w-xs">
                        <span className="font-medium truncate block">{video.title}</span>
                      </td>
                      <td className="px-4 py-3"><InfluencerBadge name={video.influencer} /></td>
                      <td className="px-4 py-3"><PlatformBadge platform={video.platform as "YouTube" | "Instagram" | "TikTok"} /></td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{formatNumber(video.views)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{formatNumber(video.likes)}</td>
                      <td className="px-4 py-3 text-right font-mono text-sm">{formatNumber(video.comments)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-mono text-sm ${video.engagement > 5 ? "text-emerald-400" : video.engagement > 2 ? "text-amber-400" : "text-muted-foreground"}`}>
                          {formatEngagement(video.engagement)}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
