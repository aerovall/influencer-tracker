import { useParams, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Users, TrendingUp, DollarSign, Briefcase,
  Video, Link2, BarChart3, ExternalLink, Clock, Eye,
  ThumbsUp, MessageSquare, CheckCircle2, AlertCircle, Star, Plus, MousePointerClick,
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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function TalentProfile() {
  const { channelId } = useParams<{ channelId: string }>();
  const [, setLocation] = useLocation();

  // ── All hooks must be called unconditionally before any early returns ──
  const { data, isLoading, error } = trpc.affiliate.talentProfile.useQuery(
    { channelId: channelId ?? "" },
    { enabled: !!channelId }
  );

  const utils = trpc.useUtils();
  const { data: campaigns = [] } = trpc.campaigns.list.useQuery();
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

  function handleAssignSubmit() {
    const cid = parseInt(assignForm.campaignId);
    if (!cid) return toast.error("Please select a campaign");
    createDeliverable.mutate({
      campaignId: cid,
      talentName: channel.channelName ?? channel.channelId,
      channelId: channel.channelId || undefined,
      contentType: assignForm.contentType as any,
      dueDate: assignForm.dueDate || undefined,
      agreedFee: assignForm.agreedFee || "0",
      currency: assignForm.currency,
      briefNotes: assignForm.briefNotes || undefined,
    });
  }

  // ── Total affiliate clicks ──
  const totalAffiliateClicks = affiliateLinks.reduce((sum: number, l: any) => sum + Number(l.total_clicks ?? 0), 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8">
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

      {/* ── View Trend Chart ── */}
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

      {/* ── Main Grid: Top Videos + Campaign History ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top Videos */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Video className="h-4 w-4 text-blue-500" /> Top Videos
          </h2>
          {topVideos.length === 0 ? (
            <EmptyState icon={<Video className="h-7 w-7" />} message="No videos tracked yet" />
          ) : (
            <div className="space-y-2">
              {topVideos.map((v: any, i: number) => (
                <div key={v.video_id} className="flex items-center gap-3 rounded-xl border bg-card px-3 py-2.5">
                  <span className="text-xs font-bold text-muted-foreground/50 w-5 shrink-0 text-center">{i + 1}</span>
                  {v.thumbnail_url ? (
                    <img src={v.thumbnail_url} alt={v.title} className="h-10 w-16 rounded object-cover shrink-0" />
                  ) : (
                    <div className="h-10 w-16 rounded bg-muted shrink-0 flex items-center justify-center">
                      <Video className="h-4 w-4 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate leading-tight">{v.title ?? "Untitled"}</p>
                    <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                      <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{fmtNum(v.view_count)}</span>
                      {v.likes > 0 && <span className="flex items-center gap-0.5"><ThumbsUp className="h-3 w-3" />{fmtNum(v.likes)}</span>}
                      {v.duration_seconds > 0 && <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" />{fmtDuration(v.duration_seconds)}</span>}
                    </div>
                  </div>
                  <a
                    href={`https://youtube.com/watch?v=${v.video_id}`}
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

        {/* Campaign History */}
        <section className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-violet-500" /> Campaign History
          </h2>
          {deliverables.length === 0 ? (
            <EmptyState icon={<Briefcase className="h-7 w-7" />} message="No campaigns assigned yet" />
          ) : (
            <div className="space-y-2">
              {deliverables.map((d: any) => (
                <div key={d.id} className="rounded-xl border bg-card px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${CAMPAIGN_STATUS_COLORS[d.campaign_status] ?? "bg-muted text-muted-foreground"}`}>
                          {d.campaign_status}
                        </span>
                        <p className="text-sm font-medium truncate">{d.campaign_name}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{d.client_name ?? "No client"} · {d.content_type?.replace(/_/g, " ")}</p>
                    </div>
                    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium shrink-0 ${DELIVERABLE_STATUS_COLORS[d.status] ?? "bg-muted text-muted-foreground"}`}>
                      {d.status?.replace(/_/g, " ")}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                    {d.agreed_fee && parseFloat(d.agreed_fee) > 0 && (
                      <span className="flex items-center gap-1 text-emerald-500 font-medium">
                        <DollarSign className="h-3 w-3" /> {parseFloat(d.agreed_fee).toLocaleString()}
                      </span>
                    )}
                    {d.due_date && <span>Due {d.due_date}</span>}
                    {d.video_id && (
                      <a
                        href={`https://youtube.com/watch?v=${d.video_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-blue-500 hover:underline"
                      >
                        <Video className="h-3 w-3" /> Video
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Affiliate Links ── */}
      <section className="space-y-3">
        <h2 className="text-base font-semibold flex items-center gap-2">
          <Link2 className="h-4 w-4 text-emerald-500" /> Affiliate Links
        </h2>
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
      </section>

      {/* ── Talent Results ── */}
      {results.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-base font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-amber-500" /> Performance Results
          </h2>
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
        </section>
      )}
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
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-72 rounded-xl" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    </div>
  );
}
