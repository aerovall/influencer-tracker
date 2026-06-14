import { trpc } from "@/lib/trpc";
import { useMemo, useState, useRef } from "react";
import {
  ArrowLeft, Users, TrendingUp, DollarSign, Briefcase,
  Video, Link2, BarChart3, ExternalLink, Clock, Eye,
  ThumbsUp, CheckCircle2, AlertCircle, Plus, MousePointerClick,
  Pencil, Image, Trash2, Loader2, Film, RefreshCw, MessageSquare, ChevronLeft, ChevronRight,
  ChevronDown, Save, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AnimatedNumber } from "@/components/AnimatedNumber";
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useLocation, useParams } from "wouter";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function fmtSubs(n: number | null | undefined) {
  if (!n) return "—";
  return fmtNum(n);
}

function fmtDuration(secs: number | null | undefined) {
  if (!secs) return "—";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function fmtCurrency(n: number, currency = "USD") {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return `${currency} ${n.toLocaleString()}`;
}

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/40 ${className}`} />;
}

const DELIVERABLE_STATUS_COLORS: Record<string, string> = {
  brief_sent:    "bg-blue-500/15 text-blue-500",
  script_review: "bg-violet-500/15 text-violet-500",
  filming:       "bg-amber-500/15 text-amber-500",
  editing:       "bg-orange-500/15 text-orange-500",
  review:        "bg-yellow-500/15 text-yellow-600",
  published:     "bg-emerald-500/15 text-emerald-500",
  cancelled:     "bg-red-500/15 text-red-500",
};

const CAMPAIGN_STATUS_COLORS: Record<string, string> = {
  active:    "bg-emerald-500/15 text-emerald-500",
  planning:  "bg-blue-500/15 text-blue-500",
  completed: "bg-muted text-muted-foreground",
  paused:    "bg-amber-500/15 text-amber-500",
  cancelled: "bg-red-500/15 text-red-500",
  draft:     "bg-muted text-muted-foreground",
};

const TABS = [
  { id: "overview",   label: "Overview",   icon: <TrendingUp className="h-3.5 w-3.5" /> },
  { id: "videos",     label: "Videos",     icon: <Film className="h-3.5 w-3.5" /> },
  { id: "campaigns",  label: "Campaigns",  icon: <Briefcase className="h-3.5 w-3.5" /> },
  { id: "affiliate",  label: "Affiliate",  icon: <Link2 className="h-3.5 w-3.5" /> },
  { id: "results",    label: "Results",    icon: <BarChart3 className="h-3.5 w-3.5" /> },
] as const;

type TabId = typeof TABS[number]["id"];

const PLATFORMS = ["YouTube", "Instagram", "TikTok"] as const;

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TalentProfile() {
  const { channelId } = useParams<{ channelId: string }>();
  const [, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<TabId>("overview");

  // ── All hooks must be called unconditionally before any early returns ──
  const { data, isLoading, error } = trpc.affiliate.talentProfile.useQuery(
    { channelId: channelId ?? "" },
    { enabled: !!channelId }
  );

  const utils = trpc.useUtils();
  const { data: campaigns = [] } = trpc.campaigns.list.useQuery();

  // Videos tab state
  const [videoSearch, setVideoSearch] = useState("");
  const [ytFetching, setYtFetching] = useState(false);
  const [ytFetched, setYtFetched] = useState(false);
  const [addVideoOpen, setAddVideoOpen] = useState(false);
  const [addVideoForm, setAddVideoForm] = useState({
    videoUrl: "",
    title: "",
    publishedDate: new Date().toISOString().split("T")[0],
    thumbnailUrl: "",
    durationSeconds: undefined as number | undefined,
  });
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [videoPage, setVideoPage] = useState(1);
  const { data: enrichedData, isLoading: videosLoading, refetch: refetchVideos } = trpc.videos.listEnriched.useQuery(
    { channelId: channelId ?? "", page: videoPage, limit: 30, search: videoSearch || undefined },
    { enabled: !!channelId }
  );
  const channelVideos = enrichedData?.videos ?? [];
  const videoTotal = enrichedData?.total ?? 0;

  const syncChannel = trpc.channels.syncChannel.useMutation({
    onSuccess: (res) => {
      const label = res.channelName ? `${res.channelName}: ` : "";
      if (res.newVideos > 0) {
        toast.success(`${label}${res.newVideos} new video${res.newVideos !== 1 ? "s" : ""} discovered! Stats refreshed for ${res.updatedStats}.`);
      } else {
        toast.success(`${label}Already up to date — stats refreshed for ${res.updatedStats} video${res.updatedStats !== 1 ? "s" : ""}.`);
      }
      utils.videos.listEnriched.invalidate({ channelId: channelId ?? "" });
      refetchVideos();
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });

  const createVideo = trpc.videos.create.useMutation({
    onSuccess: () => {
      utils.videos.listEnriched.invalidate({ channelId: channelId ?? "" });
      setAddVideoOpen(false);
      setAddVideoForm({ videoUrl: "", title: "", publishedDate: new Date().toISOString().split("T")[0], thumbnailUrl: "", durationSeconds: undefined });
      setYtFetched(false);
      toast.success("Video added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteVideo = trpc.videos.delete.useMutation({
    onSuccess: () => {
      utils.videos.listEnriched.invalidate({ channelId: channelId ?? "" });
      toast.success("Video removed");
    },
    onError: (e) => toast.error(e.message),
  });

  // Assign to campaign state
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignForm, setAssignForm] = useState({
    campaignId: "",
    contentType: "dedicated_video",
    dueDate: "",
    agreedFee: "",
    currency: "USD",
    briefNotes: "",
  });

  const createDeliverable = trpc.deliverables.create.useMutation({
    onSuccess: () => {
      utils.affiliate.talentProfile.invalidate({ channelId: channelId ?? "" });
      setAssignOpen(false);
      setAssignForm({ campaignId: "", contentType: "dedicated_video", dueDate: "", agreedFee: "", currency: "USD", briefNotes: "" });
      toast.success("Talent assigned to campaign");
    },
    onError: (e) => toast.error(e.message),
  });

  // Edit deliverable state
  const [editDelivOpen, setEditDelivOpen] = useState(false);
  const [editDelivForm, setEditDelivForm] = useState<{
    id: number; status: string; agreedFee: string; currency: string;
    dueDate: string; briefNotes: string; videoId: string; screenshotUrl: string;
  } | null>(null);

  const updateDeliverable = trpc.deliverables.update.useMutation({
    onSuccess: () => {
      utils.affiliate.talentProfile.invalidate({ channelId: channelId ?? "" });
      setEditDelivOpen(false);
      setEditDelivForm(null);
      toast.success("Deliverable updated");
    },
    onError: (e) => toast.error(e.message),
  });

  function openEditDeliverable(d: any) {
    setEditDelivForm({
      id: d.id,
      status: d.status ?? "brief_sent",
      agreedFee: d.agreedFee != null ? String(d.agreedFee) : "",
      currency: d.currency ?? "USD",
      dueDate: d.dueDate ?? "",
      briefNotes: d.briefNotes ?? "",
      videoId: d.videoId ?? "",
      screenshotUrl: d.screenshotUrl ?? "",
    });
    setEditDelivOpen(true);
  }

  function handleEditDelivSubmit() {
    if (!editDelivForm) return;
    updateDeliverable.mutate({
      id: editDelivForm.id,
      status: editDelivForm.status as any,
      agreedFee: editDelivForm.agreedFee || "0",
      currency: editDelivForm.currency,
      dueDate: editDelivForm.dueDate || undefined,
      briefNotes: editDelivForm.briefNotes || undefined,
      videoId: editDelivForm.videoId || undefined,
      screenshotUrl: editDelivForm.screenshotUrl || undefined,
    });
  }

  function handleAssignSubmit() {
    const cid = parseInt(assignForm.campaignId);
    if (!cid) return toast.error("Please select a campaign");
    createDeliverable.mutate({
      campaignId: cid,
      talentName: data?.channel?.channelName ?? data?.channel?.channelId ?? "",
      channelId: data?.channel?.channelId || undefined,
      contentType: assignForm.contentType as any,
      dueDate: assignForm.dueDate || undefined,
      agreedFee: assignForm.agreedFee || "0",
      currency: assignForm.currency,
      briefNotes: assignForm.briefNotes || undefined,
    });
  }

  // Auto-fetch YouTube metadata when URL is pasted
  const handleVideoUrlChange = (url: string) => {
    setAddVideoForm(f => ({ ...f, videoUrl: url }));
    setYtFetched(false);
    if (fetchTimeoutRef.current) clearTimeout(fetchTimeoutRef.current);
    fetchTimeoutRef.current = setTimeout(async () => {
      const ytPattern = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))[a-zA-Z0-9_-]{11}/;
      if (!ytPattern.test(url)) return;
      setYtFetching(true);
      try {
        const result = await utils.videos.fetchYouTubeInfo.fetch({ url });
        if (result) {
          setAddVideoForm(f => ({
            ...f,
            title: result.data.title || f.title,
            publishedDate: result.data.publishedDate || f.publishedDate,
            thumbnailUrl: result.data.thumbnailUrl || f.thumbnailUrl,
            durationSeconds: result.data.durationSeconds,
          }));
          setYtFetched(true);
          toast.success("YouTube metadata fetched automatically");
        }
      } catch {
        // silently fail
      } finally {
        setYtFetching(false);
      }
    }, 600);
  };

  const chartData = useMemo(() => {
    if (!data?.viewTrend?.length) return null;
    const labels = data.viewTrend.map((d: any) => d.date?.slice(5) ?? "");
    const values = data.viewTrend.map((d: any) => Number(d.total_views ?? 0));
    return {
      labels,
      datasets: [{
        label: "Daily Views",
        data: values,
        fill: true,
        tension: 0.4,
        borderColor: "oklch(0.78 0.15 80)",
        backgroundColor: "oklch(0.78 0.15 80 / 0.12)",
        pointRadius: 3,
        pointHoverRadius: 5,
        borderWidth: 2,
      }],
    };
  }, [data?.viewTrend]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: any) => ` ${fmtNum(ctx.raw)} views`,
        },
      },
    },
    scales: {
      x: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#888", font: { size: 11 } } },
      y: { grid: { color: "rgba(255,255,255,0.05)" }, ticks: { color: "#888", font: { size: 11 }, callback: (v: any) => fmtNum(v) } },
    },
  };

  // ── Early returns (after all hooks) ──
  if (isLoading) return <TalentProfileSkeleton />;
  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-4">
        <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-muted-foreground">Talent not found or failed to load.</p>
        <Button variant="outline" size="sm" onClick={() => setLocation("/agency/talents")}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Back to Talents
        </Button>
      </div>
    );
  }

  const { channel, totalViews, totalAffiliateRevenue, topVideos, deliverables, affiliateLinks, results } = data;

  // ── Total affiliate clicks ──
  const totalAffiliateClicks = affiliateLinks.reduce((sum: number, l: any) => sum + Number(l.total_clicks ?? 0), 0);

  // Search is now server-side via listEnriched; filteredVideos = channelVideos directly
  const filteredVideos = channelVideos as any[];

  // Expandable video row state
  const [expandedVideoId, setExpandedVideoId] = useState<string | null>(null);
  const { data: videoShills = [], refetch: refetchShills } = trpc.shills.listByVideo.useQuery(
    { videoId: expandedVideoId ?? "" },
    { enabled: !!expandedVideoId }
  );
  const [shillForm, setShillForm] = useState({ productBrand: "", campaignId: "", timestamp: "0:00", lengthSeconds: 30, promoType: "Verbal mention", notes: "" });
  const createShill = trpc.shills.create.useMutation({
    onSuccess: () => { refetchShills(); setShillForm({ productBrand: "", campaignId: "", timestamp: "0:00", lengthSeconds: 30, promoType: "Verbal mention", notes: "" }); toast.success("Sponsorship added"); },
    onError: (e) => toast.error(e.message),
  });
  const deleteShill = trpc.shills.delete.useMutation({
    onSuccess: () => { refetchShills(); toast.success("Sponsorship removed"); },
    onError: (e) => toast.error(e.message),
  });
  const updateShillMutation = trpc.shills.update.useMutation({
    onSuccess: () => { refetchShills(); toast.success("Updated"); },
    onError: (e) => toast.error(e.message),
  });
  // Campaign link column: update deliverable video_id
  const updateDeliverableVideoId = trpc.deliverables.update.useMutation({
    onSuccess: () => { utils.videos.listEnriched.invalidate({ channelId: channelId ?? "" }); toast.success("Campaign linked"); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* ── Back ── */}
      <Button variant="ghost" size="sm" className="gap-1.5 -ml-2 text-muted-foreground hover:text-foreground" onClick={() => setLocation("/agency/talents")}>
        <ArrowLeft className="h-4 w-4" /> All Talents
      </Button>

      {/* ── Hero ── */}
      <div className="flex items-start gap-5 flex-wrap">
        {channel.thumbnailUrl ? (
          <img src={channel.thumbnailUrl} alt={channel.channelName} className="h-20 w-20 rounded-full object-cover border-2 border-border shrink-0" />
        ) : (
          <div className="h-20 w-20 rounded-full bg-muted flex items-center justify-center border-2 border-border shrink-0">
            <Users className="h-8 w-8 text-muted-foreground" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight">{channel.channelName}</h1>
            <a
              href={`https://youtube.com/channel/${channel.channelId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ExternalLink className="h-3 w-3" /> YouTube
            </a>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {fmtSubs(channel.subscriberCount)} subscribers
          </p>
        </div>
        <Button
          onClick={() => setAssignOpen(true)}
          className="gap-2 shrink-0 ml-auto"
          size="sm"
        >
          <Plus className="h-4 w-4" /> Assign to Campaign
        </Button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <KpiCard icon={<Eye className="h-5 w-5 text-amber-500" />} label="Total Views" value={fmtNum(totalViews)} accent="amber" />
        <KpiCard icon={<Users className="h-5 w-5 text-blue-500" />} label="Subscribers" value={fmtSubs(channel.subscriberCount)} accent="blue" />
        <KpiCard icon={<Briefcase className="h-5 w-5 text-violet-500" />} label="Campaigns" value={String(deliverables.length > 0 ? new Set(deliverables.map((d: any) => d.campaign_id)).size : 0)} accent="violet" />
        <KpiCard icon={<MousePointerClick className="h-5 w-5 text-sky-500" />} label="Affiliate Clicks" value={fmtNum(totalAffiliateClicks)} accent="sky" />
        <KpiCard icon={<DollarSign className="h-5 w-5 text-emerald-500" />} label="Affiliate Revenue" value={fmtCurrency(totalAffiliateRevenue)} accent="emerald" />
      </div>

      {/* ── Tabs ── */}
      <div>
        {/* Tab bar */}
        <div className="flex items-center gap-1 border-b border-border/50 pb-0 mb-6 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap
                ${activeTab === tab.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                }`}
            >
              {tab.icon}
              {tab.label}
              {tab.id === "videos" && (channelVideos as any[]).length > 0 && (
                <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-normal">
                  {(channelVideos as any[]).length}
                </span>
              )}
              {tab.id === "campaigns" && deliverables.length > 0 && (
                <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-normal">
                  {deliverables.length}
                </span>
              )}
              {tab.id === "affiliate" && affiliateLinks.length > 0 && (
                <span className="ml-1 text-xs bg-muted text-muted-foreground rounded-full px-1.5 py-0.5 font-normal">
                  {affiliateLinks.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── OVERVIEW TAB ── */}
        {activeTab === "overview" && (
          <div className="space-y-6">
            {/* View Trend Chart */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-amber-500" /> View Trend — Last 30 Days
              </h2>
              <div className="rounded-xl border bg-card p-4">
                {chartData ? (
                  <div style={{ height: 220 }}>
                    <Line data={chartData} options={chartOptions as any} />
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
                    No view data available for the last 30 days
                  </div>
                )}
              </div>
            </section>

            {/* Top Videos */}
            <section className="space-y-3">
              <h2 className="text-base font-semibold flex items-center gap-2">
                <Video className="h-4 w-4 text-blue-500" /> Top Videos
              </h2>
              {topVideos.length === 0 ? (
                <EmptyState icon={<Video className="h-7 w-7" />} message="No videos tracked yet" />
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
                  {topVideos.map((v: any, i: number) => (
                    <div key={v.videoId ?? v.video_id ?? i} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                      <span className="text-xs font-bold text-muted-foreground/50 w-5 shrink-0 text-center">{i + 1}</span>
                      {(v.thumbnailUrl ?? v.thumbnail_url) ? (
                        <img src={v.thumbnailUrl ?? v.thumbnail_url} alt={v.title} className="h-10 w-16 rounded object-cover shrink-0" />
                      ) : (
                        <div className="h-10 w-16 rounded bg-muted shrink-0 flex items-center justify-center">
                          <Video className="h-4 w-4 text-muted-foreground/40" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate leading-tight">{v.title ?? "Untitled"}</p>
                        <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                          <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{fmtNum(v.viewCount ?? v.view_count)}</span>
                          {(v.likes ?? 0) > 0 && <span className="flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{fmtNum(v.likes)}</span>}
                          {(v.durationSeconds ?? v.duration_seconds ?? 0) > 0 && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{fmtDuration(v.durationSeconds ?? v.duration_seconds)}</span>}
                        </div>
                      </div>
                      <a
                        href={`https://youtube.com/watch?v=${v.videoId ?? v.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        )}

        {/* ── VIDEOS TAB ── */}
        {activeTab === "videos" && (
          <div className="space-y-4">
            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <Input
                placeholder="Search videos..."
                value={videoSearch}
                onChange={(e) => { setVideoSearch(e.target.value); setVideoPage(1); }}
                className="max-w-xs"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-2"
                  disabled={syncChannel.isPending}
                  onClick={() => syncChannel.mutate({ channelId: channelId ?? "" })}
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${syncChannel.isPending ? "animate-spin" : ""}`} />
                  {syncChannel.isPending ? "Syncing…" : "Sync from YouTube"}
                </Button>
                <Button size="sm" className="gap-2" onClick={() => setAddVideoOpen(true)}>
                  <Plus className="h-4 w-4" /> Add Video
                </Button>
              </div>
            </div>

            {videosLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
              </div>
            ) : filteredVideos.length === 0 ? (
              <EmptyState icon={<Film className="h-7 w-7" />} message={videoSearch ? "No videos match your search" : "No videos tracked yet. Add a video or sync from YouTube."} />
            ) : (
              <>
                <div className="rounded-xl border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border/50 bg-muted/20">
                          <th className="px-3 py-3 w-8"></th>
                          <th className="text-left px-3 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Video</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"><Eye className="h-3 w-3 inline mr-1" />Views</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"><ThumbsUp className="h-3 w-3 inline mr-1" />Likes</th>
                          <th className="text-right px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap"><MessageSquare className="h-3 w-3 inline mr-1" />Comments</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Top Comment</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Campaign</th>
                          <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider whitespace-nowrap">Published</th>
                          <th className="px-3 py-3 w-8"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredVideos.map((video: any, idx: number) => {
                          const isExpanded = expandedVideoId === video.videoId;
                          const PROMO_TYPES = ["Verbal mention","On-screen visual","Dedicated video","Description link","Mid-roll mention","Verbal mention, On-screen visual","Mid-roll mention, On-screen visual","Integration","Pre-roll","Post-roll"];
                          return (
                          <>
                          <tr
                            key={video.videoId}
                            className={`border-b border-border/30 cursor-pointer hover:bg-accent/30 transition-colors ${isExpanded ? "bg-accent/20" : idx % 2 === 0 ? "" : "bg-muted/10"}`}
                            onClick={() => setExpandedVideoId(isExpanded ? null : video.videoId)}
                          >
                            {/* Expand toggle */}
                            <td className="px-3 py-2 text-muted-foreground">
                              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                            </td>
                            {/* Thumbnail + Title */}
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-3">
                                {video.thumbnailUrl ? (
                                  <img src={video.thumbnailUrl} alt="" className="h-9 w-16 object-cover rounded shrink-0" />
                                ) : (
                                  <div className="h-9 w-16 rounded bg-muted flex items-center justify-center shrink-0">
                                    <Film className="h-3.5 w-3.5 text-muted-foreground/40" />
                                  </div>
                                )}
                                <div className="min-w-0">
                                  <a
                                    href={video.videoUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    onClick={(e) => e.stopPropagation()}
                                    className="font-medium hover:text-primary transition-colors flex items-center gap-1 max-w-xs"
                                  >
                                    <span className="truncate text-sm">{video.title}</span>
                                    <ExternalLink className="h-3 w-3 shrink-0 opacity-40" />
                                  </a>
                                  {(video.durationSeconds ?? 0) > 0 && (
                                    <span className="text-xs text-muted-foreground flex items-center gap-0.5 mt-0.5">
                                      <Clock className="h-2.5 w-2.5" />{fmtDuration(video.durationSeconds)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            {/* Views */}
                            <td className="px-4 py-2 text-right font-mono text-xs tabular-nums">
                              {video.latestViews > 0 ? fmtNum(video.latestViews) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            {/* Likes */}
                            <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-rose-400">
                              {video.latestLikes > 0 ? fmtNum(video.latestLikes) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            {/* Comments */}
                            <td className="px-4 py-2 text-right font-mono text-xs tabular-nums text-sky-400">
                              {video.latestComments > 0 ? fmtNum(video.latestComments) : <span className="text-muted-foreground/40">—</span>}
                            </td>
                            {/* Top Comment */}
                            <td className="px-4 py-2 max-w-xs">
                              {video.topCommentText ? (
                                <div className="space-y-0.5">
                                  <p className="text-xs text-muted-foreground truncate max-w-[200px]" title={video.topCommentText}>
                                    "{video.topCommentText}"
                                  </p>
                                  <p className="text-xs text-muted-foreground/50">
                                    {video.topCommentAuthor && <span>@{video.topCommentAuthor}</span>}
                                    {video.topCommentLikes != null && video.topCommentLikes > 0 && (
                                      <span className="ml-1">· {fmtNum(video.topCommentLikes)} ♥</span>
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <span className="text-muted-foreground/30 text-xs">—</span>
                              )}
                            </td>
                            {/* Campaign — dropdown selector */}
                            <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                              <Select
                                value={video.linkedDeliverable ? String(video.linkedDeliverable.campaignId) : ""}
                                onValueChange={(val) => {
                                  if (!val) return;
                                  // Find a deliverable for this campaign linked to this channel and update its video_id
                                  const deliverable = deliverables.find((d: any) => String(d.campaign_id ?? d.campaignId) === val);
                                  if (deliverable) {
                                    updateDeliverableVideoId.mutate({ id: deliverable.id, videoId: video.videoId });
                                  } else {
                                    toast.error("No deliverable found for this campaign on this talent. Create one in the Campaigns tab first.");
                                  }
                                }}
                              >
                                <SelectTrigger className="h-7 text-xs w-[160px] border-dashed">
                                  <SelectValue placeholder="Link campaign…" />
                                </SelectTrigger>
                                <SelectContent>
                                  {campaigns.map((c: any) => (
                                    <SelectItem key={c.campaign.id} value={String(c.campaign.id)} className="text-xs">
                                      {c.campaign.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              {video.linkedDeliverable && (
                                <span className={`mt-1 inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${DELIVERABLE_STATUS_COLORS[video.linkedDeliverable.status] ?? "bg-muted text-muted-foreground"}`}>
                                  {(video.linkedDeliverable.status ?? "").replace(/_/g, " ")}
                                </span>
                              )}
                            </td>
                            {/* Published */}
                            <td className="px-4 py-2 text-muted-foreground whitespace-nowrap text-xs">{video.publishedDate}</td>
                            {/* Delete */}
                            <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => deleteVideo.mutate({ videoId: video.videoId })}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                title="Remove video"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                          {/* ── Expanded Sponsorship Log ── */}
                          {isExpanded && (
                            <tr key={`${video.videoId}-shill`} className="bg-muted/5 border-b border-border/30">
                              <td colSpan={9} className="px-6 py-4">
                                <div className="space-y-3">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sponsorship Log</p>
                                    <span className="text-xs text-muted-foreground/50">{video.videoId}</span>
                                  </div>
                                  {/* Existing shills */}
                                  {(videoShills as any[]).length > 0 ? (
                                    <table className="w-full text-xs">
                                      <thead>
                                        <tr className="border-b border-border/30">
                                          <th className="text-left py-1 pr-3 text-muted-foreground font-medium uppercase tracking-wider">Shill ID</th>
                                          <th className="text-left py-1 pr-3 text-muted-foreground font-medium uppercase tracking-wider">Campaign / Brand</th>
                                          <th className="text-left py-1 pr-3 text-muted-foreground font-medium uppercase tracking-wider">Timestamp</th>
                                          <th className="text-left py-1 pr-3 text-muted-foreground font-medium uppercase tracking-wider">Length (s)</th>
                                          <th className="text-left py-1 pr-3 text-muted-foreground font-medium uppercase tracking-wider">Promo Type</th>
                                          <th className="py-1 w-6"></th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {(videoShills as any[]).map((s: any) => (
                                          <tr key={s.shillId} className="border-b border-border/20 hover:bg-accent/10">
                                            <td className="py-1.5 pr-3 text-muted-foreground/60 font-mono">{s.shillId}</td>
                                            <td className="py-1.5 pr-3 font-medium">
                                              {s.campaignId
                                                ? (campaigns.find((c: any) => c.campaign.id === s.campaignId)?.campaign.name ?? `Campaign #${s.campaignId}`)
                                                : s.productBrand}
                                            </td>
                                            <td className="py-1.5 pr-3 font-mono">{s.timestamp}</td>
                                            <td className="py-1.5 pr-3 font-mono">{s.lengthSeconds}</td>
                                            <td className="py-1.5 pr-3">
                                              <Select
                                                value={s.promoType}
                                                onValueChange={(val) => updateShillMutation.mutate({ shillId: s.shillId, promoType: val })}
                                              >
                                                <SelectTrigger className="h-6 text-xs w-[180px] border-0 bg-transparent p-0 focus:ring-0">
                                                  <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  {PROMO_TYPES.map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                                                </SelectContent>
                                              </Select>
                                            </td>
                                            <td className="py-1.5">
                                              <button onClick={() => deleteShill.mutate({ shillId: s.shillId })} className="text-muted-foreground/40 hover:text-destructive">
                                                <X className="h-3 w-3" />
                                              </button>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  ) : (
                                    <p className="text-xs text-muted-foreground/50 text-center py-2">No sponsorships logged yet. Add one below.</p>
                                  )}
                                  {/* Add new shill row */}
                                  <div className="flex items-end gap-2 flex-wrap border-t border-border/30 pt-3">
                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Campaign</label>
                                      <Select
                                        value={shillForm.campaignId}
                                        onValueChange={(val) => {
                                          const camp = campaigns.find((c: any) => String(c.campaign.id) === val);
                                          setShillForm(f => ({ ...f, campaignId: val, productBrand: camp?.campaign.name ?? f.productBrand }));
                                        }}
                                      >
                                        <SelectTrigger className="h-7 text-xs w-[160px]"><SelectValue placeholder="Select campaign…" /></SelectTrigger>
                                        <SelectContent>
                                          {campaigns.map((c: any) => <SelectItem key={c.campaign.id} value={String(c.campaign.id)} className="text-xs">{c.campaign.name}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Brand</label>
                                      <Input
                                        className="h-7 text-xs w-[120px]"
                                        placeholder="Brand name"
                                        value={shillForm.productBrand}
                                        onChange={(e) => setShillForm(f => ({ ...f, productBrand: e.target.value }))}
                                      />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Timestamp</label>
                                      <Input className="h-7 text-xs w-[70px]" placeholder="0:00" value={shillForm.timestamp}
                                        onChange={(e) => setShillForm(f => ({ ...f, timestamp: e.target.value }))} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Length (s)</label>
                                      <Input className="h-7 text-xs w-[70px]" type="number" value={shillForm.lengthSeconds}
                                        onChange={(e) => setShillForm(f => ({ ...f, lengthSeconds: Number(e.target.value) }))} />
                                    </div>
                                    <div className="flex flex-col gap-1">
                                      <label className="text-xs text-muted-foreground uppercase tracking-wider">Promo Type</label>
                                      <Select value={shillForm.promoType} onValueChange={(val) => setShillForm(f => ({ ...f, promoType: val }))}>
                                        <SelectTrigger className="h-7 text-xs w-[180px]"><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                          {PROMO_TYPES.map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Button
                                      size="sm"
                                      className="h-7 gap-1 text-xs"
                                      disabled={createShill.isPending || !shillForm.productBrand}
                                      onClick={() => createShill.mutate({
                                        videoId: video.videoId,
                                        productBrand: shillForm.productBrand,
                                        campaignId: shillForm.campaignId ? parseInt(shillForm.campaignId) : undefined,
                                        timestamp: shillForm.timestamp || "0:00",
                                        lengthSeconds: shillForm.lengthSeconds,
                                        promoType: shillForm.promoType,
                                      })}
                                    >
                                      <Save className="h-3 w-3" /> Save
                                    </Button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                          </>
                        )})}
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Pagination */}
                {videoTotal > 30 && (
                  <div className="flex items-center justify-between text-sm text-muted-foreground">
                    <span>{videoTotal} videos total</span>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" disabled={videoPage <= 1} onClick={() => setVideoPage(p => p - 1)}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span>Page {videoPage} of {Math.ceil(videoTotal / 30)}</span>
                      <Button variant="outline" size="sm" disabled={videoPage >= Math.ceil(videoTotal / 30)} onClick={() => setVideoPage(p => p + 1)}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── CAMPAIGNS TAB ── */}
        {activeTab === "campaigns" && (
          <div className="space-y-3">
            {deliverables.length === 0 ? (
              <EmptyState icon={<Briefcase className="h-7 w-7" />} message="No campaigns assigned yet" />
            ) : (
              <div className="space-y-2">
                {deliverables.map((d: any) => {
                  const isEditable = d.campaign_status !== "completed" && d.campaign_status !== "cancelled" && d.status !== "cancelled";
                  return (
                    <div key={d.id} className="rounded-xl border bg-card px-4 py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${CAMPAIGN_STATUS_COLORS[d.campaign_status] ?? "bg-muted text-muted-foreground"}`}>
                              {d.campaign_status}
                            </span>
                            <p className="text-sm font-medium truncate">{d.campaign_name}</p>
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">{d.client_name ?? "No client"} · {d.contentType?.replace(/_/g, " ") ?? d.content_type?.replace(/_/g, " ")}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${DELIVERABLE_STATUS_COLORS[d.status] ?? "bg-muted text-muted-foreground"}`}>
                            {d.status?.replace(/_/g, " ")}
                          </span>
                          {isEditable && (
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground" onClick={() => openEditDeliverable(d)}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
                        {(d.agreedFee ?? d.agreed_fee) && parseFloat(d.agreedFee ?? d.agreed_fee) > 0 && (
                          <span className="flex items-center gap-1 text-emerald-500 font-medium">
                            <DollarSign className="h-3 w-3" /> {parseFloat(d.agreedFee ?? d.agreed_fee).toLocaleString()} {d.currency}
                          </span>
                        )}
                        {(d.dueDate ?? d.due_date) && <span>Due {d.dueDate ?? d.due_date}</span>}
                        {(d.videoId ?? d.video_id) && (
                          <a href={`https://youtube.com/watch?v=${d.videoId ?? d.video_id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-blue-500 hover:underline">
                            <Video className="h-3 w-3" /> Video
                          </a>
                        )}
                      </div>
                      {(d.screenshotUrl) && (
                        <div className="mt-1">
                          <a href={d.screenshotUrl} target="_blank" rel="noopener noreferrer">
                            <img
                              src={d.screenshotUrl}
                              alt="Screenshot"
                              className="rounded-lg border max-h-40 object-cover hover:opacity-90 transition-opacity cursor-pointer"
                              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                            />
                          </a>
                        </div>
                      )}
                      {(d.briefNotes) && (
                        <p className="text-xs text-muted-foreground italic border-t pt-2 mt-1">{d.briefNotes}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── AFFILIATE TAB ── */}
        {activeTab === "affiliate" && (
          <div className="space-y-3">
            {affiliateLinks.length === 0 ? (
              <EmptyState icon={<Link2 className="h-7 w-7" />} message="No affiliate links yet" />
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">URL</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campaign</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Clicks</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Conv.</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue</th>
                      <th className="text-center px-4 py-3 font-medium text-muted-foreground">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {affiliateLinks.map((link: any) => (
                      <tr key={link.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <a
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-500 hover:underline flex items-center gap-1 max-w-[200px] truncate"
                          >
                            {link.url} <ExternalLink className="h-3 w-3 shrink-0" />
                          </a>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{link.campaign_name ?? "—"}</td>
                        <td className="px-4 py-3 text-right">{fmtNum(Number(link.total_clicks))}</td>
                        <td className="px-4 py-3 text-right">{fmtNum(Number(link.total_conversions))}</td>
                        <td className="px-4 py-3 text-right font-medium text-emerald-500">
                          {Number(link.total_revenue) > 0 ? fmtCurrency(Number(link.total_revenue)) : "—"}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${link.is_active ? "bg-emerald-500/15 text-emerald-500" : "bg-muted text-muted-foreground"}`}>
                            {link.is_active ? <CheckCircle2 className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
                            {link.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── RESULTS TAB ── */}
        {activeTab === "results" && (
          <div className="space-y-3">
            {results.length === 0 ? (
              <EmptyState icon={<BarChart3 className="h-7 w-7" />} message="No performance results recorded yet" />
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campaign</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Views</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Likes</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Comments</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Eng. Rate</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Clicks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r: any) => (
                      <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3 font-medium">{r.campaign_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{r.content_type?.replace(/_/g, " ")}</td>
                        <td className="px-4 py-3 text-right">{fmtNum(r.views)}</td>
                        <td className="px-4 py-3 text-right">{fmtNum(r.likes)}</td>
                        <td className="px-4 py-3 text-right">{fmtNum(r.comments)}</td>
                        <td className="px-4 py-3 text-right">
                          {r.engagement_rate ? `${parseFloat(r.engagement_rate).toFixed(2)}%` : "—"}
                        </td>
                        <td className="px-4 py-3 text-right">{fmtNum(r.link_clicks)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Assign to Campaign Dialog ── */}
      <Dialog open={assignOpen} onOpenChange={setAssignOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Assign to Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Campaign *</Label>
              <Select value={assignForm.campaignId} onValueChange={(v) => setAssignForm(f => ({ ...f, campaignId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select campaign" /></SelectTrigger>
                <SelectContent>
                  {(campaigns as any[]).map((row: any) => (
                    <SelectItem key={row.campaign.id} value={String(row.campaign.id)}>{row.campaign.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Content Type</Label>
              <Select value={assignForm.contentType} onValueChange={(v) => setAssignForm(f => ({ ...f, contentType: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["dedicated_video","integration","short","story","post","live","other"].map(t => (
                    <SelectItem key={t} value={t}>{t.replace(/_/g, " ")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Agreed Fee</Label>
                <Input type="number" min="0" placeholder="0" value={assignForm.agreedFee} onChange={(e) => setAssignForm(f => ({ ...f, agreedFee: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={assignForm.currency} onValueChange={(v) => setAssignForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["USD","EUR","GBP","SGD","AUD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Due Date</Label>
              <Input type="date" value={assignForm.dueDate} onChange={(e) => setAssignForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Brief Notes</Label>
              <Textarea rows={3} placeholder="Campaign brief, talking points..." value={assignForm.briefNotes} onChange={(e) => setAssignForm(f => ({ ...f, briefNotes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignOpen(false)}>Cancel</Button>
            <Button onClick={handleAssignSubmit} disabled={createDeliverable.isPending}>
              {createDeliverable.isPending ? "Assigning..." : "Assign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Edit Deliverable Dialog ── */}
      <Dialog open={editDelivOpen} onOpenChange={setEditDelivOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Deliverable</DialogTitle>
          </DialogHeader>
          {editDelivForm && (
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={editDelivForm.status} onValueChange={(v) => setEditDelivForm(f => f ? { ...f, status: v } : f)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["brief_sent","script_review","filming","editing","review","published","cancelled"].map(s => (
                      <SelectItem key={s} value={s}>{s.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Agreed Fee</Label>
                  <Input type="number" min="0" placeholder="0" value={editDelivForm.agreedFee} onChange={(e) => setEditDelivForm(f => f ? { ...f, agreedFee: e.target.value } : f)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Currency</Label>
                  <Select value={editDelivForm.currency} onValueChange={(v) => setEditDelivForm(f => f ? { ...f, currency: v } : f)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["USD","EUR","GBP","SGD","AUD"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={editDelivForm.dueDate} onChange={(e) => setEditDelivForm(f => f ? { ...f, dueDate: e.target.value } : f)} />
              </div>
              <div className="space-y-1.5">
                <Label>Video ID</Label>
                <Input placeholder="YouTube video ID (e.g. dQw4w9WgXcQ)" value={editDelivForm.videoId} onChange={(e) => setEditDelivForm(f => f ? { ...f, videoId: e.target.value } : f)} />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5"><Image className="h-3.5 w-3.5" /> Screenshot / Proof URL</Label>
                <Input placeholder="https://..." value={editDelivForm.screenshotUrl} onChange={(e) => setEditDelivForm(f => f ? { ...f, screenshotUrl: e.target.value } : f)} />
                {editDelivForm.screenshotUrl && (
                  <img src={editDelivForm.screenshotUrl} alt="Preview" className="rounded-lg border max-h-32 object-cover mt-1" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Brief Notes</Label>
                <Textarea rows={3} placeholder="Notes, talking points..." value={editDelivForm.briefNotes} onChange={(e) => setEditDelivForm(f => f ? { ...f, briefNotes: e.target.value } : f)} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDelivOpen(false)}>Cancel</Button>
            <Button onClick={handleEditDelivSubmit} disabled={updateDeliverable.isPending}>
              {updateDeliverable.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add Video Dialog ── */}
      <Dialog open={addVideoOpen} onOpenChange={(v) => { setAddVideoOpen(v); if (!v) { setYtFetched(false); setAddVideoForm({ videoUrl: "", title: "", publishedDate: new Date().toISOString().split("T")[0], thumbnailUrl: "", durationSeconds: undefined }); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Video for {channel.channelName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Video URL</Label>
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  {ytFetching && <Loader2 className="h-3 w-3 animate-spin" />}
                  {ytFetched && <CheckCircle2 className="h-3 w-3 text-green-500" />}
                  {ytFetching ? "Fetching metadata..." : ytFetched ? "Auto-filled from YouTube" : "Paste URL to auto-fill"}
                </span>
              </div>
              <Input
                placeholder="https://youtube.com/watch?v=... or youtu.be/..."
                value={addVideoForm.videoUrl}
                onChange={(e) => handleVideoUrlChange(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Title <span className="text-xs text-muted-foreground">(auto-filled for YouTube)</span></Label>
              <Input placeholder="Video title" value={addVideoForm.title} onChange={(e) => setAddVideoForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Published Date</Label>
              <Input type="date" value={addVideoForm.publishedDate} onChange={(e) => setAddVideoForm(f => ({ ...f, publishedDate: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Thumbnail URL <span className="text-xs text-muted-foreground">(auto-filled for YouTube)</span></Label>
              <Input placeholder="https://..." value={addVideoForm.thumbnailUrl} onChange={(e) => setAddVideoForm(f => ({ ...f, thumbnailUrl: e.target.value }))} />
            </div>
            <Button
              className="w-full"
              disabled={createVideo.isPending || ytFetching || !addVideoForm.videoUrl || !addVideoForm.title}
              onClick={() => createVideo.mutate({
                influencerName: channel.channelName ?? channel.channelId,
                platform: "YouTube",
                ...addVideoForm,
              })}
            >
              {createVideo.isPending ? "Adding..." : "Add Video"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string; accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">{icon}</div>
      </div>
      <p className="text-2xl font-bold tracking-tight"><AnimatedNumber value={value} /></p>
    </div>
  );
}

function EmptyState({ icon, message }: { icon: React.ReactNode; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-8 text-center rounded-xl border border-dashed bg-muted/10">
      <div className="text-muted-foreground/30 mb-2">{icon}</div>
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function TalentProfileSkeleton() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <Skeleton className="h-8 w-32" />
      <div className="flex items-start gap-5">
        <Skeleton className="h-20 w-20 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)}
      </div>
      <Skeleton className="h-12 rounded-xl" />
      <Skeleton className="h-64 rounded-xl" />
    </div>
  );
}
