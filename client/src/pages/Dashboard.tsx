import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfluencerBadge, PlatformBadge, AlertTypeBadge, formatNumber, formatEngagement } from "@/components/Badges";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Activity, AlertTriangle, Eye, TrendingUp, Video, Zap, Download } from "lucide-react";
import { useMemo, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { downloadDashboardExcel } from "@/lib/exportExcel";
import { toast } from "sonner";

// Dynamic color palette for any number of channels
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

function KpiCard({ title, value, sub, icon: Icon, accent }: {
  title: string; value: string | number; sub?: string; icon: React.ElementType; accent?: string;
}) {
  return (
    <Card className="stat-card border-border/50 bg-card/80 backdrop-blur">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold tracking-tight" style={accent ? { color: accent } : {}}>
              {value}
            </p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className="p-2 rounded-lg bg-primary/10">
            <Icon className="h-5 w-5" style={{ color: "oklch(0.78 0.15 80)" }} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { data: kpis, isLoading: kpisLoading } = trpc.analytics.kpis.useQuery();
  const { data: trends, isLoading: trendsLoading } = trpc.analytics.trends.useQuery({ days: 30 });
  const { data: alerts, isLoading: alertsLoading } = trpc.alerts.list.useQuery({ limit: 8 });
  const { data: recentVideos } = trpc.videos.list.useQuery({});
  const [exporting, setExporting] = useState(false);

  const markRead = trpc.alerts.markRead.useMutation({
    onSuccess: () => utils.alerts.list.invalidate(),
  });
  const utils = trpc.useUtils();

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const data = await utils.analytics.exportStats.fetch();
      downloadDashboardExcel(data);
      toast.success("Excel file downloaded!");
    } catch (err: any) {
      toast.error(`Export failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  }, [utils]);

  // Build chart data: daily total views grouped by influencer — dynamic channel names
  const { chartData, channelNames } = useMemo(() => {
    if (!trends) return { chartData: [], channelNames: [] as string[] };
    const byDate = new Map<string, Record<string, number>>();
    const nameSet = new Set<string>();
    for (const row of trends) {
      if (!byDate.has(row.date)) byDate.set(row.date, {});
      const entry = byDate.get(row.date)!;
      entry[row.influencerName] = (entry[row.influencerName] ?? 0) + Number(row.viewCount);
      nameSet.add(row.influencerName);
    }
    return {
      chartData: Array.from(byDate.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-14)
        .map(([date, vals]) => ({ date: date.slice(5), ...vals })),
      channelNames: Array.from(nameSet).sort(),
    };
  }, [trends]);

  // Top 5 videos by latest view count
  const topVideos = useMemo(() => {
    if (!recentVideos) return [];
    return recentVideos.slice(0, 5);
  }, [recentVideos]);

  return (
    <div className="space-y-8 p-2">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Real-time overview of all influencer activity across platforms
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleExport}
          disabled={exporting}
          className="shrink-0 gap-2 border-border/60 hover:bg-primary/10"
        >
          <Download className="h-4 w-4" />
          {exporting ? "Exporting…" : "Export Excel"}
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpisLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-6">
                <Skeleton className="h-8 w-24 mb-2" />
                <Skeleton className="h-4 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <KpiCard title="Total Videos" value={formatNumber(kpis?.totalVideos)} icon={Video} />
            <KpiCard title="Total Views" value={formatNumber(kpis?.totalViews)} icon={Eye} accent="oklch(0.78 0.15 80)" />
            <KpiCard title="Avg Engagement" value={`${kpis?.avgEngagementRate ?? "0"}%`} icon={TrendingUp} />
            <KpiCard
              title="Unread Alerts"
              value={kpis?.unreadAlerts ?? 0}
              icon={AlertTriangle}
              accent={Number(kpis?.unreadAlerts) > 0 ? "oklch(0.78 0.15 80)" : undefined}
            />
          </>
        )}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* View Trend Chart */}
        <Card className="lg:col-span-2 border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Activity className="h-4 w-4" style={{ color: "oklch(0.78 0.15 80)" }} />
              View Trends — Last 14 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trendsLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-48 flex items-center justify-center text-muted-foreground text-sm">
                No view data yet. Add videos and run a sync.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.25 0.03 255)" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: "oklch(0.60 0.02 255)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "oklch(0.60 0.02 255)" }} tickFormatter={(v) => formatNumber(v)} />
                  <Tooltip
                    contentStyle={{ background: "oklch(0.16 0.025 255)", border: "1px solid oklch(0.25 0.03 255)", borderRadius: 8 }}
                    labelStyle={{ color: "oklch(0.95 0.01 255)" }}
                    formatter={(v: number) => [formatNumber(v), ""]}
                  />
                  <Legend />
                  {channelNames.map((name) => (
                    <Line
                      key={name}
                      type="monotone"
                      dataKey={name}
                      stroke={getChannelColor(name, channelNames)}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Platform / Influencer Breakdown */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Zap className="h-4 w-4" style={{ color: "oklch(0.78 0.15 80)" }} />
              Videos by Platform
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpisLoading ? (
              <Skeleton className="h-48 w-full" />
            ) : (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={140}>
                  <BarChart data={kpis?.byPlatform ?? []} layout="vertical">
                    <XAxis type="number" tick={{ fontSize: 11, fill: "oklch(0.60 0.02 255)" }} />
                    <YAxis dataKey="platform" type="category" tick={{ fontSize: 11, fill: "oklch(0.60 0.02 255)" }} width={70} />
                    <Tooltip
                      contentStyle={{ background: "oklch(0.16 0.025 255)", border: "1px solid oklch(0.25 0.03 255)", borderRadius: 8 }}
                      labelStyle={{ color: "oklch(0.95 0.01 255)" }}
                    />
                    <Bar dataKey="count" fill="oklch(0.78 0.15 80)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
                <div className="space-y-2 pt-2 border-t border-border/50">
                  {(kpis?.byInfluencer ?? []).map((row) => (
                    <div key={row.influencerName} className="flex items-center justify-between">
                      <InfluencerBadge name={row.influencerName} />
                      <span className="text-sm text-muted-foreground">{row.count} videos</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-400" />
              Recent Alerts
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setLocation("/reports")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            {alertsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : (alerts?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">No alerts yet.</p>
            ) : (
              <div className="space-y-2">
                {alerts?.map((alert) => (
                  <div
                    key={alert.id}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      alert.isRead ? "border-border/30 opacity-60" : "border-amber-500/20 bg-amber-500/5"
                    }`}
                  >
                    <AlertTypeBadge type={alert.alertType ?? "custom"} />
                    <p className="text-xs text-muted-foreground flex-1 leading-relaxed">{alert.message}</p>
                    {!alert.isRead && (
                      <button
                        onClick={() => markRead.mutate({ id: alert.id })}
                        className="text-xs text-primary hover:underline shrink-0"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Videos */}
        <Card className="border-border/50 bg-card/80">
          <CardHeader className="pb-2 flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Video className="h-4 w-4" style={{ color: "oklch(0.78 0.15 80)" }} />
              Recent Videos
            </CardTitle>
            <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setLocation("/videos")}>
              View all
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topVideos.map((video) => (
                <div key={video.videoId} className="flex items-center gap-3 group">
                  <div className="flex-1 min-w-0">
                    <a
                      href={video.videoUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-medium truncate block hover:text-primary transition-colors"
                    >
                      {video.title}
                    </a>
                    <div className="flex items-center gap-2 mt-1">
                      <InfluencerBadge name={video.influencerName} />
                      <PlatformBadge platform={video.platform} />
                      <span className="text-xs text-muted-foreground">{video.publishedDate}</span>
                    </div>
                  </div>
                </div>
              ))}
              {topVideos.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No videos yet. Add videos or run a sync.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
