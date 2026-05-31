import { trpc } from "@/lib/trpc";
import { useEffect, useState, useRef } from "react";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Plus, RefreshCw, Trash2, Youtube, ChevronRight, ChevronDown,
  Eye, ThumbsUp, MessageCircle, Clock, ExternalLink, Pencil, Check, X,
  Instagram, Twitter, AlertCircle, Bot, Reply
} from "lucide-react";

const PROMO_TYPES = [
  "Verbal mention",
  "On-screen visual",
  "Dedicated video",
  "Description link",
  "Mid-roll mention",
  "Verbal mention, On-screen visual",
  "Mid-roll mention, On-screen visual",
  "Integration",
  "Pre-roll",
  "Post-roll",
] as const;

function formatNum(n: number | null | undefined): string {
  if (n == null || n === undefined) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
}

/** Format a stat that may be 0 because it's genuinely unavailable (e.g. likes from channel listing). */
function formatUnavailableStat(n: number | null | undefined): string {
  if (n == null || n === 0) return "—";
  return formatNum(n);
}

function formatDuration(s: number | null | undefined): string {
  if (!s) return "—";
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

// ─── Shill Row (inline edit) ──────────────────────────────────────────────────
function ShillRow({ shill, onDelete, onUpdate }: { shill: any; onDelete: (id: number) => void; onUpdate: (id: number, data: any) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    productBrand: shill.productBrand,
    timestamp: shill.timestamp,
    lengthSeconds: shill.lengthSeconds,
    promoType: shill.promoType,
    notes: shill.notes ?? "",
  });

  if (editing) {
    return (
      <tr className="bg-amber-500/5 border-b border-border/30">
        <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{shill.shillId}</td>
        <td className="px-3 py-2">
          <Input className="h-7 text-xs" value={form.productBrand} onChange={(e) => setForm((f) => ({ ...f, productBrand: e.target.value }))} />
        </td>
        <td className="px-3 py-2">
          <Input className="h-7 text-xs w-20" placeholder="0:00" value={form.timestamp} onChange={(e) => setForm((f) => ({ ...f, timestamp: e.target.value }))} />
        </td>
        <td className="px-3 py-2">
          <Input type="number" className="h-7 text-xs w-20" value={form.lengthSeconds} onChange={(e) => setForm((f) => ({ ...f, lengthSeconds: parseInt(e.target.value) || 0 }))} />
        </td>
        <td className="px-3 py-2">
          <Select value={form.promoType} onValueChange={(v) => setForm((f) => ({ ...f, promoType: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{PROMO_TYPES.map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}</SelectContent>
          </Select>
        </td>
        <td className="px-3 py-2 flex gap-1">
          <button className="text-green-400 hover:text-green-300" onClick={() => { onUpdate(shill.id, form); setEditing(false); }}><Check className="h-4 w-4" /></button>
          <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditing(false)}><X className="h-4 w-4" /></button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/20 hover:bg-muted/5 transition-colors group">
      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{shill.shillId}</td>
      <td className="px-3 py-2 text-sm font-medium">{shill.productBrand}</td>
      <td className="px-3 py-2 text-xs font-mono text-amber-400">{shill.timestamp}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{shill.lengthSeconds}s</td>
      <td className="px-3 py-2"><Badge variant="outline" className="text-xs border-border/50 text-muted-foreground">{shill.promoType}</Badge></td>
      <td className="px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button className="text-muted-foreground hover:text-foreground" onClick={() => setEditing(true)}><Pencil className="h-3.5 w-3.5" /></button>
        <button className="text-muted-foreground hover:text-destructive" onClick={() => onDelete(shill.id)}><Trash2 className="h-3.5 w-3.5" /></button>
      </td>
    </tr>
  );
}

// ─── Add Shill Form ───────────────────────────────────────────────────────────
function AddShillForm({ videoId, onAdded }: { videoId: string; onAdded: () => void }) {
  const [form, setForm] = useState({ productBrand: "", timestamp: "", lengthSeconds: 30, promoType: "Verbal mention", notes: "" });
  const create = trpc.shills.create.useMutation({
    onSuccess: () => { toast.success("Sponsorship added"); onAdded(); setForm({ productBrand: "", timestamp: "", lengthSeconds: 30, promoType: "Verbal mention", notes: "" }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <tr className="border-b border-amber-500/20 bg-amber-500/5">
      <td className="px-3 py-2 text-xs text-muted-foreground font-mono">auto</td>
      <td className="px-3 py-2">
        <Input className="h-7 text-xs" placeholder="Brand name" value={form.productBrand} onChange={(e) => setForm((f) => ({ ...f, productBrand: e.target.value }))} />
      </td>
      <td className="px-3 py-2">
        <Input className="h-7 text-xs w-20" placeholder="0:00" value={form.timestamp} onChange={(e) => setForm((f) => ({ ...f, timestamp: e.target.value }))} />
      </td>
      <td className="px-3 py-2">
        <Input type="number" className="h-7 text-xs w-20" value={form.lengthSeconds} onChange={(e) => setForm((f) => ({ ...f, lengthSeconds: parseInt(e.target.value) || 0 }))} />
      </td>
      <td className="px-3 py-2">
        <Select value={form.promoType} onValueChange={(v) => setForm((f) => ({ ...f, promoType: v }))}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>{PROMO_TYPES.map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}</SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <button
          className="text-amber-400 hover:text-amber-300 disabled:opacity-40"
          disabled={!form.productBrand || !form.timestamp || create.isPending}
          onClick={() => create.mutate({ videoId, ...form })}
        >
          <Check className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ─── Manual Stat Cell ────────────────────────────────────────────────────────
function ManualStatCell({
  videoId, field, manualValue, autoValue, icon
}: {
  videoId: string;
  field: "likes" | "comments";
  manualValue: number | null | undefined;  // from manualLikes/manualComments column
  autoValue: number | null | undefined;    // from likes/comments column (auto-fetched)
  icon: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [inputVal, setInputVal] = useState("");
  const [optimisticVal, setOptimisticVal] = useState<number | null>(null);
  const utils = trpc.useUtils();

  // Display priority: optimistic > manual > auto
  const displayValue = optimisticVal !== null ? optimisticVal : (manualValue != null && manualValue > 0 ? manualValue : autoValue);
  const isManual = optimisticVal !== null || (manualValue != null && manualValue > 0);
  // 0 is a valid scraped value (e.g. a video with 0 comments); only null/undefined means "no data"
  const hasValue = displayValue != null;

  const updateStats = trpc.videos.updateManualStats.useMutation({
    onMutate: ({ likes, comments }) => {
      const val = field === "likes" ? likes : comments;
      if (val !== null) setOptimisticVal(val);
    },
    onSuccess: () => {
      toast.success(`${field === "likes" ? "Likes" : "Comments"} saved`);
      utils.videos.getViewCounts.invalidate({ videoId });
      setOpen(false);
    },
    onError: (e) => {
      toast.error(e.message);
      setOptimisticVal(null); // rollback
    },
    onSettled: () => setOptimisticVal(null),
  });

  const handleSave = () => {
    const parsed = parseInt(inputVal.replace(/[^0-9]/g, ""), 10);
    if (isNaN(parsed) || parsed < 0) { toast.error("Enter a valid number"); return; }
    updateStats.mutate({
      videoId,
      likes: field === "likes" ? parsed : null,
      comments: field === "comments" ? parsed : null,
    });
  };

  return (
    <div className="flex items-center gap-1 text-sm group">
      {icon}
      <span className={hasValue ? "" : "text-muted-foreground/60"}>
        {hasValue ? formatNum(displayValue) : "—"}
      </span>
      {isManual && !open && (
        <span title="Manually entered" className="text-amber-400/60 shrink-0">
          <Pencil className="h-2.5 w-2.5" />
        </span>
      )}
      {open ? (
        <div className="flex items-center gap-1 ml-1" onClick={(e) => e.stopPropagation()}>
          <Input
            autoFocus
            type="number"
            min={0}
            placeholder="0"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") setOpen(false); }}
            className="h-6 w-20 text-xs px-1.5 py-0"
          />
          <button
            onClick={(e) => { e.stopPropagation(); handleSave(); }}
            disabled={updateStats.isPending}
            className="text-green-400 hover:text-green-300 disabled:opacity-40"
          >
            <Check className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); setOpen(false); }}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : (
        <button
          onClick={(e) => { e.stopPropagation(); setInputVal(hasValue ? String(displayValue) : ""); setOpen(true); }}
          className="opacity-0 group-hover:opacity-100 transition-opacity ml-0.5 text-muted-foreground hover:text-amber-400"
          title={`Manually enter ${field} count`}
        >
          <Pencil className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}

// ─── Video Row ────────────────────────────────────────────────────────────────
function VideoRow({ video }: { video: any }) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  // Full shill list — only loaded when row is expanded (avoids N+1 on channel page)
  const { data: shills, refetch } = trpc.shills.list.useQuery({ videoId: video.videoId }, { enabled: expanded });
  // Lightweight count — always loaded so the badge shows before expanding
  const { data: shillCount } = trpc.shills.countByVideo.useQuery({ videoId: video.videoId });
  const { data: stats } = trpc.videos.getViewCounts.useQuery({ videoId: video.videoId }, { enabled: true });
  const latestStats = stats?.[stats.length - 1];

  const deleteShill = trpc.shills.delete.useMutation({
    onSuccess: () => { refetch(); utils.shills.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const updateShill = trpc.shills.update.useMutation({
    onSuccess: () => { refetch(); utils.shills.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <>
      <tr className="border-b border-border/20 hover:bg-muted/5 transition-colors cursor-pointer" onClick={() => setExpanded((e) => !e)}>
        <td className="px-4 py-3 w-8">
          {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {video.thumbnailUrl ? (
              <img src={video.thumbnailUrl} alt="" className="w-16 h-9 object-cover rounded border border-border/30 shrink-0" />
            ) : (
              <div className="w-16 h-9 bg-muted/20 rounded border border-border/30 shrink-0 flex items-center justify-center">
                <Youtube className="h-4 w-4 text-muted-foreground/40" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate max-w-xs">{video.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">{video.videoId}</span>
                <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="text-muted-foreground hover:text-amber-400">
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">{video.publishedDate}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1 text-sm">
            <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{formatNum(latestStats?.viewCount)}</span>
          </div>
        </td>
        <td className="px-4 py-3">
          <ManualStatCell
            videoId={video.videoId}
            field="likes"
            manualValue={latestStats?.manualLikes}
            autoValue={latestStats?.likes}
            icon={<ThumbsUp className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          />
        </td>
        <td className="px-4 py-3">
          <ManualStatCell
            videoId={video.videoId}
            field="comments"
            manualValue={latestStats?.manualComments}
            autoValue={latestStats?.comments}
            icon={<MessageCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          />
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(video.durationSeconds)}
          </div>
        </td>
        <td className="px-4 py-3">
          {/* Use shillCount (always loaded) for badge; fall back to shills.length once expanded */}
          {((expanded ? (shills?.length ?? 0) : (shillCount ?? 0)) > 0) && (
            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-400 bg-amber-500/5">
              {expanded ? shills?.length : shillCount} shill{(expanded ? (shills?.length ?? 0) : (shillCount ?? 0)) !== 1 ? "s" : ""}
            </Badge>
          )}
        </td>
      </tr>

      {/* Expanded section: Sponsorship Log + Comment Panel */}
      {expanded && (
        <tr>
          <td colSpan={8} className="bg-muted/5 border-b border-border/30 px-4 py-3">
            <div className="rounded-lg border border-border/30 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-muted/10 border-b border-border/20">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sponsorship Log</span>
                <span className="text-xs text-muted-foreground">{video.videoId}</span>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/5">
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">shill_id</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">product_brand</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">timestamp</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">length_seconds</th>
                    <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">promo_type</th>
                    <th className="px-3 py-2 w-16"></th>
                  </tr>
                </thead>
                <tbody>
                  <AddShillForm videoId={video.videoId} onAdded={() => { refetch(); }} />
                  {(shills ?? []).map((s: any) => (
                    <ShillRow
                      key={s.id}
                      shill={s}
                      onDelete={(id) => deleteShill.mutate({ shillId: String(id) })}
                      onUpdate={(id, data) => updateShill.mutate({ shillId: String(id), ...data })}
                    />
                  ))}
                  {(shills ?? []).length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-3 py-4 text-center text-xs text-muted-foreground">
                        No sponsorships logged yet. Add one above.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Robot Scrape Panel */}
            <CommentPanel videoId={video.videoId} />
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Comment Panel ───────────────────────────────────────────────────────────
function CommentPanel({ videoId }: { videoId: string }) {
  const utils = trpc.useUtils();
  const { data: commentData, isLoading } = trpc.videos.getCommentData.useQuery({ videoId });

  const scrape = trpc.videos.scrapeComments.useMutation({
    onSuccess: (res) => {
      if (res.result.error) {
        toast.error(`Scrape failed: ${res.result.error}`);
      } else {
        const lc = res.result.likeCount;
        const cc = res.result.commentCount;
        toast.success(`Scraped! ${lc != null ? formatNum(lc) + " likes" : ""} \u00b7 ${cc ?? ""} comments`);
        utils.videos.getCommentData.invalidate({ videoId });
        utils.videos.getViewCounts.invalidate({ videoId });
      }
    },
    onError: (e) => toast.error(`Scrape error: ${e.message}`),
  });

  const snap = commentData;
  const hasData = snap && !snap.scrapeError && (snap.likeCount != null || snap.commentCount);

  return (
    <div className="rounded-lg border border-border/30 overflow-hidden mt-3">
      <div className="flex items-center justify-between px-4 py-2 bg-muted/10 border-b border-border/20">
        <div className="flex items-center gap-2">
          <Bot className="h-3.5 w-3.5 text-amber-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Robot Scrape</span>
          {snap?.date && (
            <span className="text-xs text-muted-foreground/60">· last scraped {snap.date}</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-6 text-xs gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
          disabled={scrape.isPending}
          onClick={() => scrape.mutate({ videoId })}
        >
          {scrape.isPending ? (
            <><RefreshCw className="h-3 w-3 animate-spin" /> Scraping...</>
          ) : (
            <><Bot className="h-3 w-3" /> Scrape Now</>
          )}
        </Button>
      </div>

      {isLoading ? (
        <div className="px-4 py-3 space-y-2">
          <div className="h-4 bg-muted/20 rounded w-1/3 animate-pulse" />
          <div className="h-4 bg-muted/20 rounded w-2/3 animate-pulse" />
        </div>
      ) : hasData ? (
        <div className="px-4 py-3 space-y-3">
          {/* Stats row */}
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-1.5">
              <ThumbsUp className="h-3.5 w-3.5 text-amber-400" />
              <span className="font-medium">{snap.likeCount != null ? formatNum(snap.likeCount) : "—"}</span>
              <span className="text-muted-foreground text-xs">likes</span>
            </div>
            <div className="flex items-center gap-1.5">
              <MessageCircle className="h-3.5 w-3.5 text-blue-400" />
              <span className="font-medium">{snap.commentCount ?? "—"}</span>
              <span className="text-muted-foreground text-xs">comments</span>
            </div>
          </div>

          {/* Top comment */}
          {snap.topCommentText && (
            <div className="rounded-md border border-border/30 bg-muted/5 p-3 space-y-1.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-amber-500/20 flex items-center justify-center">
                    <span className="text-[9px] font-bold text-amber-400">#1</span>
                  </div>
                  <span className="text-xs font-semibold">{snap.topCommentAuthor ?? "Unknown"}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <ThumbsUp className="h-3 w-3" />
                  <span>{snap.topCommentLikes ?? "0"}</span>
                  {(snap.topCommentReplyCount ?? 0) > 0 && (
                    <>
                      <span className="mx-1">·</span>
                      <Reply className="h-3 w-3" />
                      <span>{snap.topCommentReplyCount} replies</span>
                    </>
                  )}
                </div>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{snap.topCommentText}</p>
            </div>
          )}
        </div>
      ) : snap?.scrapeError ? (
        <div className="px-4 py-3 flex items-center gap-2 text-xs text-red-400">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          <span>Scrape error: {snap.scrapeError}</span>
        </div>
      ) : (
        <div className="px-4 py-3 text-xs text-muted-foreground">
          No data yet. Click <strong>Scrape Now</strong> to fetch likes, comment count, and top comment from YouTube.
        </div>
      )}
    </div>
  );
}

// ─── Channel Card ─────────────────────────────────────────────────────────────
function ChannelCard({ channel }: { channel: any }) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  // Track whether we've already shown the completion toast to avoid duplicates
  const prevScrapeStatusRef = useRef<string>("idle");

  const { data: videoPage, isLoading: videosLoading } = trpc.channels.listByChannel.useQuery(
    { channelId: channel.channelId, page, limit: PAGE_SIZE },
    { enabled: expanded }
  );
  const videos = videoPage?.videos ?? [];
  const totalVideos = videoPage?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalVideos / PAGE_SIZE));

  // Per-channel scrape job polling.
  // IMPORTANT: polling is driven entirely by the *data* status (not a separate boolean state)
  // so that toggling the Videos dropdown (which re-renders the component) never stops polling.
  const { data: channelScrapeStatus } = trpc.videos.channelScrapeStatus.useQuery(
    { channelId: channel.channelId },
    {
      // Poll every 2s while the server-side job is running; stop automatically when done/error.
      refetchInterval: (query) => {
        const status = (query.state.data as any)?.status;
        return status === "running" ? 2000 : false;
      },
      // Keep the last known data while re-fetching so the progress bar never disappears.
      staleTime: 30_000,
    }
  );
  const startChannelScrape = trpc.videos.startChannelScrape.useMutation({
    onSuccess: (res) => {
      if ((res as any).alreadyRunning) {
        toast.info("A scrape is already running for this channel.");
      } else {
        // Immediately refetch so the progress bar appears without waiting 2s.
        utils.videos.channelScrapeStatus.invalidate({ channelId: channel.channelId });
        const total = (res as any).total ?? 0;
        toast.info(`Scraping ${total} video${total !== 1 ? "s" : ""} for ${channel.channelName}...`);
      }
    },
    onError: (e) => toast.error(`Scrape failed: ${e.message}`),
  });
  // Fire completion toast exactly once when status transitions running → done/error.
  useEffect(() => {
    if (!channelScrapeStatus) return;
    const prev = prevScrapeStatusRef.current;
    if (prev === "running" && (channelScrapeStatus.status === "done" || channelScrapeStatus.status === "error")) {
      const errCount = channelScrapeStatus.errors.length;
      if (channelScrapeStatus.status === "error") {
        toast.error(`Scrape failed for ${channel.channelName}.`);
      } else if (errCount > 0) {
        toast.warning(`Scrape done — ${channelScrapeStatus.done} scraped, ${errCount} error${errCount !== 1 ? "s" : ""}`);
      } else {
        toast.success(`Scrape complete — ${channelScrapeStatus.done} video${channelScrapeStatus.done !== 1 ? "s" : ""} updated!`);
      }
      utils.videos.getCommentData.invalidate();
      utils.videos.getCommentDataBulk.invalidate();
      utils.videos.list.invalidate();
      utils.videos.getViewCounts.invalidate();
      utils.channels.listByChannel.invalidate({ channelId: channel.channelId });
      utils.channels.list.invalidate();
    }
    prevScrapeStatusRef.current = channelScrapeStatus.status;
  }, [channelScrapeStatus?.status, channelScrapeStatus?.done]);
  const isChannelScraping = channelScrapeStatus?.status === "running";
  const channelScrapePercent = channelScrapeStatus?.percent ?? 0;

  const syncChannel = trpc.channels.syncChannel.useMutation({
    onSuccess: (res) => {
      const channelLabel = res.channelName ? `${res.channelName}: ` : "";
      if (res.newVideos > 0) {
        toast.success(`${channelLabel}${res.newVideos} new video${res.newVideos !== 1 ? "s" : ""} discovered! Stats refreshed for ${res.updatedStats} video${res.updatedStats !== 1 ? "s" : ""}.`);
      } else {
        toast.success(`${channelLabel}Already up to date — stats refreshed for ${res.updatedStats} video${res.updatedStats !== 1 ? "s" : ""}.`);
      }
      utils.channels.list.invalidate();
      utils.channels.listByChannel.invalidate();
      utils.videos.list.invalidate();
      utils.videos.getViewCounts.invalidate();
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });

  const unlink = trpc.channels.unlink.useMutation({
    onSuccess: () => { toast.success("Channel unlinked"); utils.channels.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="border-border/50 bg-card/60">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {channel.thumbnailUrl ? (
              <img src={channel.thumbnailUrl} alt="" className="w-10 h-10 rounded-full border border-border/30" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Youtube className="h-5 w-5 text-red-500/60" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">{channel.channelName}</h3>
                {channel.channelHandle && (
                  <span className="text-xs text-muted-foreground">@{channel.channelHandle}</span>
                )}
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-muted-foreground">{formatNum(channel.subscriberCount)} subscribers</span>
                {channel.lastCheckedAt && (
                  <span className="text-xs text-muted-foreground">
                    Last sync: {new Date(channel.lastCheckedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              disabled={syncChannel.isPending}
              onClick={() => syncChannel.mutate({ channelId: channel.channelId })}
            >
              <RefreshCw className={`h-3 w-3 ${syncChannel.isPending ? "animate-spin" : ""}`} />
              Sync
            </Button>
            <Button
              size="sm"
              variant="outline"
              className={`gap-1.5 text-xs h-7 border-amber-500/40 text-amber-400 hover:bg-amber-500/10 ${isChannelScraping ? "opacity-80" : ""}`}
              disabled={isChannelScraping || startChannelScrape.isPending}
              onClick={() => startChannelScrape.mutate({ channelId: channel.channelId })}
            >
              <Bot className={`h-3 w-3 ${isChannelScraping ? "animate-pulse" : ""}`} />
              {isChannelScraping ? `${channelScrapePercent}%` : "Scrape"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              onClick={() => { setExpanded((e) => !e); setPage(1); }}
            >
              {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {expanded ? "Hide" : "Videos"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive h-7 w-7 p-0"
              onClick={() => unlink.mutate({ channelId: channel.channelId })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>

      {/* Per-channel scrape progress bar */}
      {isChannelScraping && (
        <div className="px-4 pb-3 space-y-1.5">
          <Progress value={channelScrapePercent} className="h-1.5" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="text-amber-400/80 flex items-center gap-1">
              <Bot className="h-3 w-3 animate-pulse" />
              Scraping likes &amp; comments...
            </span>
            <span>{channelScrapeStatus?.done ?? 0} / {channelScrapeStatus?.total ?? 0} videos</span>
          </div>
        </div>
      )}

      {expanded && (
        <CardContent className="pt-0">
          <div className="border border-border/30 rounded-lg overflow-hidden">
            {videosLoading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
              </div>
            ) : videos.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">
                No videos found for this channel. Try syncing.
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/20 bg-muted/5">
                    <th className="px-4 py-2 w-8"></th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Video</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Published</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Views</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Likes</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Comments</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                    <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Shills</th>
                  </tr>
                </thead>
                <tbody>
                  {videos.map((v: any) => <VideoRow key={v.videoId} video={v} />)}
                </tbody>
              </table>
            )}
          </div>
          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-2 pt-3">
              <span className="text-xs text-muted-foreground">
                {totalVideos} videos &middot; page {page} of {totalPages}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  &lsaquo; Prev
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next &rsaquo;
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

// ─── Bulk Scrape Bar ─────────────────────────────────────────────────────────
function BulkScrapeBar() {
  const utils = trpc.useUtils();
  const [polling, setPolling] = useState(false);
  const prevStatusRef = useRef<string>("idle");

  const { data: jobStatus } = trpc.videos.bulkScrapeStatus.useQuery(undefined, {
    refetchInterval: polling ? 2000 : false,
    staleTime: 0,
  });

  const startBulkScrape = trpc.videos.startBulkScrape.useMutation({
    onSuccess: (res) => {
      if (res.alreadyRunning) {
        toast.info("A scrape is already in progress.");
      } else {
        setPolling(true);
        toast.info("Bulk scrape started — scraping all YouTube videos...");
      }
    },
    onError: (e) => toast.error(`Failed to start scrape: ${e.message}`),
  });

  // Watch for job completion
  useEffect(() => {
    if (!jobStatus) return;
    const prev = prevStatusRef.current;
    if (prev === "running" && jobStatus.status === "done") {
      setPolling(false);
      const errCount = jobStatus.errors.length;
      if (errCount > 0) {
        toast.warning(`Bulk scrape done — ${jobStatus.done} scraped, ${errCount} error${errCount !== 1 ? "s" : ""}`);
      } else {
        toast.success(`Bulk scrape complete — ${jobStatus.done} videos updated!`);
      }
      // Refresh all comment data and the videos list
      utils.videos.getCommentData.invalidate();
      utils.videos.getCommentDataBulk.invalidate();
      utils.videos.list.invalidate();
      utils.videos.getViewCounts.invalidate();
      utils.channels.list.invalidate();
      utils.channels.listByChannel.invalidate();
    }
    if (jobStatus.status === "running") setPolling(true);
    prevStatusRef.current = jobStatus.status;
  }, [jobStatus?.status, jobStatus?.done]);

  const isRunning = jobStatus?.status === "running";
  const isDone = jobStatus?.status === "done";
  const percent = jobStatus?.percent ?? 0;
  const done = jobStatus?.done ?? 0;
  const total = jobStatus?.total ?? 0;
  const currentId = jobStatus?.currentVideoId;

  return (
    <div className="rounded-xl border border-border/40 bg-card/60 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-amber-400" />
          <span className="text-sm font-semibold">Robot Scraper</span>
          {isRunning && (
            <span className="text-xs text-amber-400 animate-pulse">
              Scraping {done}/{total} videos...
            </span>
          )}
          {isDone && !isRunning && (
            <span className="text-xs text-green-400">
              Last run: {done} videos scraped
              {(jobStatus?.errors.length ?? 0) > 0 && (
                <span className="text-amber-400 ml-1">({jobStatus?.errors.length} errors)</span>
              )}
            </span>
          )}
          {!isRunning && !isDone && (
            <span className="text-xs text-muted-foreground">Extracts likes, comment count &amp; top comment — no API key needed</span>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          className="gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10"
          disabled={isRunning || startBulkScrape.isPending}
          onClick={() => startBulkScrape.mutate()}
        >
          <Bot className="h-3.5 w-3.5" />
          {isRunning ? "Scraping..." : "Bulk Scrape All"}
        </Button>
      </div>

      {isRunning && (
        <div className="space-y-1.5">
          <Progress value={percent} className="h-2" />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>{percent}% complete</span>
            {currentId && <span className="font-mono opacity-60">yt_{currentId}</span>}
            <span>{done} / {total} videos</span>
          </div>
        </div>
      )}

      {isDone && (jobStatus?.errors.length ?? 0) > 0 && (
        <div className="text-xs text-amber-400/80 bg-amber-500/5 border border-amber-500/20 rounded-lg px-3 py-2">
          {jobStatus?.errors.length} video{(jobStatus?.errors.length ?? 0) !== 1 ? "s" : ""} could not be scraped (YouTube rate limit or bot detection). Try again later.
        </div>
      )}

      {/* Per-video recent results list */}
      {(isRunning || isDone) && (jobStatus?.recentResults?.length ?? 0) > 0 && (
        <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
          {[...(jobStatus?.recentResults ?? [])].reverse().map((r) => (
            <div key={r.videoId} className="flex items-center justify-between text-xs px-2 py-1 rounded bg-background/40">
              <span className="font-mono text-muted-foreground truncate max-w-[200px]">yt_{r.videoId}</span>
              {r.status === "scraped" ? (
                <div className="flex items-center gap-3 text-green-400">
                  <span className="flex items-center gap-1">
                    <ThumbsUp className="h-3 w-3" />
                    {r.likeCount != null ? formatNum(r.likeCount) : "—"}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageCircle className="h-3 w-3" />
                    {r.commentCount ?? "—"}
                  </span>
                  <span className="text-green-500 font-medium">✓ scraped</span>
                </div>
              ) : (
                <span className="text-red-400 font-medium">✗ error</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Link YouTube Channel Dialog ──────────────────────────────────────────────
function LinkChannelDialog({ onLinked }: { onLinked: () => void }) {
  const [open, setOpen] = useState(false);
  const [channelInput, setChannelInput] = useState("");

  const link = trpc.channels.link.useMutation({
    onSuccess: (res) => {
      toast.success(`Linked "${res.channelName}" — ${res.videosDiscovered} videos discovered`);
      setOpen(false);
      setChannelInput("");
      onLinked();
    },
    onError: (e) => toast.error(`Failed to link channel: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2 bg-red-600 hover:bg-red-700 text-white">
          <Youtube className="h-4 w-4" /> Link Channel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" /> Link YouTube Channel
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 text-xs text-green-400">
            No API key required. Paste a channel URL, @handle, or channel ID — the system resolves it automatically.
          </div>
          <div className="space-y-2">
            <Label>Channel URL, @Handle, or Channel ID</Label>
            <Input
              placeholder="e.g. https://youtube.com/@MrBeast or @MrBeast or UCX6OQ3DkcsbYNE6H8uQQuVA"
              value={channelInput}
              onChange={(e) => setChannelInput(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">Accepts: full YouTube channel URL, @handle, or bare UC... channel ID</p>
          </div>
          <Button
            className="w-full"
            disabled={!channelInput || link.isPending}
            onClick={() => link.mutate({ channelInput, influencerName: undefined })}
          >
            {link.isPending ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" /> Resolving channel & fetching uploads...
              </span>
            ) : "Link Channel & Discover Videos"}
          </Button>
          {link.isPending && (
            <p className="text-xs text-muted-foreground text-center">
              This may take 10–20 seconds while we fetch the last 10 uploads and their stats.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Link Social Account Dialog (Instagram / X) ───────────────────────────────
function LinkSocialDialog({ platform, onLinked }: { platform: "Instagram" | "X"; onLinked: () => void }) {
  const [open, setOpen] = useState(false);
  const [handle, setHandle] = useState("");

  const link = trpc.socialAccounts.link.useMutation({
    onSuccess: (res: any) => {
      toast.success(`Linked @${res.account.handle} on ${platform}`);
      setOpen(false);
      setHandle("");
      onLinked();
    },
    onError: (e: any) => toast.error(`Failed to link account: ${e.message}`),
  });

  const isInstagram = platform === "Instagram";
  const Icon = isInstagram ? Instagram : Twitter;
  const color = isInstagram ? "text-pink-500" : "text-sky-400";
  const borderColor = isInstagram ? "border-pink-500/20 bg-pink-500/5 text-pink-400" : "border-sky-400/20 bg-sky-400/5 text-sky-400";
  const btnColor = isInstagram ? "bg-pink-600 hover:bg-pink-700" : "bg-sky-600 hover:bg-sky-700";
  const placeholder = isInstagram ? "@username or https://instagram.com/username" : "@handle or https://x.com/handle";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className={`gap-2 ${btnColor} text-white`}>
          <Icon className="h-4 w-4" /> Link {platform} Account
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className={`h-5 w-5 ${color}`} /> Link {platform} Account
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className={`border rounded-lg p-3 text-xs ${borderColor}`}>
            Links public {platform} accounts. Tracks {isInstagram ? "views, impressions, likes, and comments" : "impressions, likes, retweets, and replies"} on recent posts daily.
          </div>
          <div className="space-y-2">
            <Label>{platform} Handle or URL</Label>
            <Input
              placeholder={placeholder}
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
            />
          </div>
          <Button
            className={`w-full text-white ${btnColor}`}
            disabled={!handle || link.isPending}
            onClick={() => link.mutate({ platform, handle })}
          >
            {link.isPending ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" /> Resolving account...
              </span>
            ) : `Link ${platform} Account`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Social Account Card ──────────────────────────────────────────────────────
function SocialAccountCard({ account }: { account: any }) {
  const utils = trpc.useUtils();
  const isInstagram = account.platform === "Instagram";
  const Icon = isInstagram ? Instagram : Twitter;
  const color = isInstagram ? "text-pink-500" : "text-sky-400";
  const borderColor = isInstagram ? "border-pink-500/20" : "border-sky-400/20";

  const unlink = trpc.socialAccounts.unlink.useMutation({
    onSuccess: () => { toast.success("Account unlinked"); utils.socialAccounts.list.invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const sync = trpc.socialAccounts.syncAccount.useMutation({
    onSuccess: (res: any) => {
      toast.success(`Synced: ${res.newPosts} new posts`);
      utils.socialAccounts.list.invalidate();
    },
    onError: (e: any) => toast.error(`Sync failed: ${e.message}`),
  });

  return (
    <Card className={`border-border/50 bg-card/60 ${borderColor}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {account.thumbnailUrl ? (
              <img src={account.thumbnailUrl} alt="" className="w-10 h-10 rounded-full border border-border/30" />
            ) : (
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${isInstagram ? "bg-pink-500/10" : "bg-sky-400/10"}`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{account.displayName ?? account.handle}</span>
                <span className="text-xs text-muted-foreground">@{account.handle}</span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-xs text-muted-foreground">{formatNum(account.followerCount)} followers</span>
                <span className="text-xs text-muted-foreground">{account.postCount ?? 0} posts</span>
                {account.lastCheckedAt && (
                  <span className="text-xs text-muted-foreground">
                    Last sync: {new Date(account.lastCheckedAt).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs h-7"
              disabled={sync.isPending}
              onClick={() => sync.mutate({ accountId: account.accountId })}
            >
              <RefreshCw className={`h-3 w-3 ${sync.isPending ? "animate-spin" : ""}`} />
              Sync
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive h-7 w-7 p-0"
              onClick={() => unlink.mutate({ accountId: account.accountId })}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── YouTube Tab ──────────────────────────────────────────────────────────────
function YouTubeTab() {
  const utils = trpc.useUtils();
  const { data: channels, isLoading } = trpc.channels.list.useQuery();
  const [filterChannel, setFilterChannel] = useState<string>("all");

  const filtered = filterChannel === "all" ? (channels ?? []) : (channels ?? []).filter((c) => c.channelId === filterChannel);

  return (
    <div className="space-y-4">
      {/* Robot Scraper bulk action bar */}
      <BulkScrapeBar />

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* Channel name filter */}
          {(channels?.length ?? 0) > 0 && (
            <Select value={filterChannel} onValueChange={setFilterChannel}>
              <SelectTrigger className="w-52 h-8 text-xs">
                <SelectValue placeholder="All Channels" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Channels</SelectItem>
                {(channels ?? []).map((c) => (
                  <SelectItem key={c.channelId} value={c.channelId}>{c.channelName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <span className="text-xs text-muted-foreground">{channels?.length ?? 0} channel{(channels?.length ?? 0) !== 1 ? "s" : ""} linked</span>
        </div>
        <LinkChannelDialog onLinked={() => utils.channels.list.invalidate()} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-24 w-full rounded-xl" />)}</div>
      ) : filtered.length === 0 ? (
        <Card className="border-border/50 bg-card/60 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className="w-14 h-14 rounded-full bg-red-500/10 flex items-center justify-center">
              <Youtube className="h-7 w-7 text-red-500/60" />
            </div>
            <div className="text-center">
              <p className="font-semibold">No YouTube channels linked</p>
              <p className="text-sm text-muted-foreground mt-1">Link a channel to auto-discover uploads and track stats daily.</p>
            </div>
            <LinkChannelDialog onLinked={() => utils.channels.list.invalidate()} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((ch) => <ChannelCard key={ch.channelId} channel={ch} />)}
        </div>
      )}
    </div>
  );
}

// ─── Social Tab (Instagram / X) ───────────────────────────────────────────────
function SocialTab({ platform }: { platform: "Instagram" | "X" }) {
  const utils = trpc.useUtils();
  const { data: accounts, isLoading } = trpc.socialAccounts.list.useQuery({ platform });
  const { data: apiStatus } = trpc.socialAccounts.apiStatus.useQuery();
  const isInstagram = platform === "Instagram";
  const Icon = isInstagram ? Instagram : Twitter;
  const color = isInstagram ? "text-pink-500" : "text-sky-400";
  const apiConnected = isInstagram ? apiStatus?.instagram : apiStatus?.twitter;

  return (
    <div className="space-y-4">
      {/* API key status banner */}
      {apiStatus && !apiConnected && (
        <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-amber-400 mt-0.5 shrink-0" />
          <div className="text-sm">
            <p className="font-medium text-amber-300">
              {isInstagram ? "Instagram API key required" : "Twitter/X API key required"}
            </p>
            <p className="text-amber-400/80 mt-0.5 text-xs">
              {isInstagram
                ? "Set INSTAGRAM_ACCESS_TOKEN in Settings → Secrets to enable follower counts and post data. Requires a Facebook Developer account with Instagram Graph API."
                : "Set TWITTER_BEARER_TOKEN in Settings → Secrets to enable follower counts and tweet data. Get a free Bearer Token at developer.x.com."}
            </p>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{accounts?.length ?? 0} account{(accounts?.length ?? 0) !== 1 ? "s" : ""} linked</span>
        <LinkSocialDialog platform={platform} onLinked={() => utils.socialAccounts.list.invalidate()} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}</div>
      ) : (accounts?.length ?? 0) === 0 ? (
        <Card className="border-border/50 bg-card/60 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <div className={`w-14 h-14 rounded-full flex items-center justify-center ${isInstagram ? "bg-pink-500/10" : "bg-sky-400/10"}`}>
              <Icon className={`h-7 w-7 ${color} opacity-60`} />
            </div>
            <div className="text-center">
              <p className="font-semibold">No {platform} accounts linked</p>
              <p className="text-sm text-muted-foreground mt-1">
                Link a {platform} account to track {isInstagram ? "likes and comments" : "impressions, likes, retweets, and replies"} daily.
              </p>
            </div>
            <LinkSocialDialog platform={platform} onLinked={() => utils.socialAccounts.list.invalidate()} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(accounts ?? []).map((acc: any) => <SocialAccountCard key={acc.accountId} account={acc} />)}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Channels() {
  const { data: ytChannels } = trpc.channels.list.useQuery();
  const { data: igAccounts } = trpc.socialAccounts.list.useQuery({ platform: "Instagram" });
  const { data: xAccounts } = trpc.socialAccounts.list.useQuery({ platform: "X" });
  const utils = trpc.useUtils();

  const totalAccounts = (ytChannels?.length ?? 0) + (igAccounts?.length ?? 0) + (xAccounts?.length ?? 0);

  // Mark all unseen videos as seen when this page is opened — clears the sidebar badge
  const markSeen = trpc.channels.markSeen.useMutation({
    onSuccess: () => utils.channels.unseenCount.invalidate(),
  });
  useEffect(() => { markSeen.mutate(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Accounts & Channels</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Link YouTube channels, Instagram accounts, and X accounts to track content and stats automatically.
        </p>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Total Linked", value: totalAccounts },
          { label: "YouTube Channels", value: ytChannels?.length ?? 0 },
          { label: "Instagram Accounts", value: igAccounts?.length ?? 0 },
          { label: "X Accounts", value: xAccounts?.length ?? 0 },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold mt-1 text-amber-400">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Platform tabs */}
      <Tabs defaultValue="youtube">
        <TabsList className="grid grid-cols-3 w-72">
          <TabsTrigger value="youtube" className="gap-1.5 text-xs">
            <Youtube className="h-3.5 w-3.5 text-red-500" /> YouTube
          </TabsTrigger>
          <TabsTrigger value="instagram" className="gap-1.5 text-xs">
            <Instagram className="h-3.5 w-3.5 text-pink-500" /> Instagram
          </TabsTrigger>
          <TabsTrigger value="x" className="gap-1.5 text-xs">
            <Twitter className="h-3.5 w-3.5 text-sky-400" /> X
          </TabsTrigger>
        </TabsList>
        <TabsContent value="youtube" className="mt-4"><YouTubeTab /></TabsContent>
        <TabsContent value="instagram" className="mt-4"><SocialTab platform="Instagram" /></TabsContent>
        <TabsContent value="x" className="mt-4"><SocialTab platform="X" /></TabsContent>
      </Tabs>
    </div>
  );
}
