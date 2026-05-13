import { trpc } from "@/lib/trpc";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { InfluencerBadge } from "@/components/Badges";
import {
  Plus, RefreshCw, Trash2, Youtube, ChevronRight, ChevronDown,
  Eye, ThumbsUp, Clock, Calendar, ExternalLink, Tag, Pencil, Check, X
} from "lucide-react";

const INFLUENCERS = ["Levi", "NoBs", "Danielle"] as const;
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
  if (!n) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString();
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
function ShillRow({
  shill,
  onDelete,
  onUpdate,
}: {
  shill: any;
  onDelete: (id: number) => void;
  onUpdate: (id: number, data: any) => void;
}) {
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
        <td className="px-3 py-2 text-xs text-muted-foreground font-mono">{shill.videoId}</td>
        <td className="px-3 py-2">
          <Input
            className="h-7 text-xs"
            value={form.productBrand}
            onChange={(e) => setForm((f) => ({ ...f, productBrand: e.target.value }))}
          />
        </td>
        <td className="px-3 py-2">
          <Input
            className="h-7 text-xs w-20"
            placeholder="0:00"
            value={form.timestamp}
            onChange={(e) => setForm((f) => ({ ...f, timestamp: e.target.value }))}
          />
        </td>
        <td className="px-3 py-2">
          <Input
            type="number"
            className="h-7 text-xs w-20"
            value={form.lengthSeconds}
            onChange={(e) => setForm((f) => ({ ...f, lengthSeconds: parseInt(e.target.value) || 0 }))}
          />
        </td>
        <td className="px-3 py-2">
          <Select value={form.promoType} onValueChange={(v) => setForm((f) => ({ ...f, promoType: v }))}>
            <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PROMO_TYPES.map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </td>
        <td className="px-3 py-2 flex gap-1">
          <button
            className="text-green-400 hover:text-green-300 transition-colors"
            onClick={() => { onUpdate(shill.id, form); setEditing(false); }}
          >
            <Check className="h-4 w-4" />
          </button>
          <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setEditing(false)}>
            <X className="h-4 w-4" />
          </button>
        </td>
      </tr>
    );
  }

  return (
    <tr className="border-b border-border/20 hover:bg-muted/5 transition-colors group">
      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{shill.shillId}</td>
      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{shill.videoId}</td>
      <td className="px-3 py-2 text-sm font-medium">{shill.productBrand}</td>
      <td className="px-3 py-2 text-xs font-mono text-amber-400">{shill.timestamp}</td>
      <td className="px-3 py-2 text-xs text-muted-foreground">{shill.lengthSeconds}s</td>
      <td className="px-3 py-2">
        <Badge variant="outline" className="text-xs border-border/50 text-muted-foreground">{shill.promoType}</Badge>
      </td>
      <td className="px-3 py-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
        <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => setEditing(true)}>
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button className="text-muted-foreground hover:text-destructive transition-colors" onClick={() => onDelete(shill.id)}>
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </td>
    </tr>
  );
}

// ─── Add Shill Form ───────────────────────────────────────────────────────────
function AddShillForm({ videoId, onAdded }: { videoId: string; onAdded: () => void }) {
  const [form, setForm] = useState({
    productBrand: "",
    timestamp: "",
    lengthSeconds: 30,
    promoType: "Verbal mention",
    notes: "",
  });

  const create = trpc.shills.create.useMutation({
    onSuccess: () => { toast.success("Sponsorship added"); onAdded(); setForm({ productBrand: "", timestamp: "", lengthSeconds: 30, promoType: "Verbal mention", notes: "" }); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <tr className="border-b border-amber-500/20 bg-amber-500/5">
      <td className="px-3 py-2 text-xs text-muted-foreground font-mono">auto</td>
      <td className="px-3 py-2 text-xs font-mono text-muted-foreground">{videoId}</td>
      <td className="px-3 py-2">
        <Input
          className="h-7 text-xs"
          placeholder="Brand name"
          value={form.productBrand}
          onChange={(e) => setForm((f) => ({ ...f, productBrand: e.target.value }))}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          className="h-7 text-xs w-20"
          placeholder="0:00"
          value={form.timestamp}
          onChange={(e) => setForm((f) => ({ ...f, timestamp: e.target.value }))}
        />
      </td>
      <td className="px-3 py-2">
        <Input
          type="number"
          className="h-7 text-xs w-20"
          value={form.lengthSeconds}
          onChange={(e) => setForm((f) => ({ ...f, lengthSeconds: parseInt(e.target.value) || 0 }))}
        />
      </td>
      <td className="px-3 py-2">
        <Select value={form.promoType} onValueChange={(v) => setForm((f) => ({ ...f, promoType: v }))}>
          <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {PROMO_TYPES.map((p) => <SelectItem key={p} value={p} className="text-xs">{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </td>
      <td className="px-3 py-2">
        <button
          className="text-amber-400 hover:text-amber-300 transition-colors disabled:opacity-40"
          disabled={!form.productBrand || !form.timestamp || create.isPending}
          onClick={() => create.mutate({ videoId, ...form })}
        >
          <Check className="h-4 w-4" />
        </button>
      </td>
    </tr>
  );
}

// ─── Video Row with expandable shill table ────────────────────────────────────
function VideoRow({ video }: { video: any }) {
  const [expanded, setExpanded] = useState(false);
  const utils = trpc.useUtils();

  const { data: shills, refetch } = trpc.shills.list.useQuery(
    { videoId: video.videoId },
    { enabled: expanded }
  );

  const { data: stats } = trpc.videos.getViewCounts.useQuery(
    { videoId: video.videoId },
    { enabled: true }
  );

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
      {/* Video row */}
      <tr
        className="border-b border-border/20 hover:bg-muted/5 transition-colors cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <td className="px-4 py-3 w-8">
          {expanded
            ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
            : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            {video.thumbnailUrl ? (
              <img
                src={video.thumbnailUrl}
                alt=""
                className="w-16 h-9 object-cover rounded border border-border/30 shrink-0"
              />
            ) : (
              <div className="w-16 h-9 bg-muted/20 rounded border border-border/30 shrink-0 flex items-center justify-center">
                <Youtube className="h-4 w-4 text-muted-foreground/40" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate max-w-xs">{video.title}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground font-mono">{video.videoId}</span>
                <a
                  href={video.videoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-muted-foreground hover:text-amber-400 transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {video.publishedDate}
          </div>
        </td>
        <td className="px-4 py-3 text-sm">
          <div className="flex items-center gap-1.5 text-amber-400">
            <Eye className="h-3.5 w-3.5" />
            {formatNum(latestStats?.viewCount)}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <ThumbsUp className="h-3.5 w-3.5" />
            {formatNum(latestStats?.likes)}
          </div>
        </td>
        <td className="px-4 py-3 text-sm text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" />
            {formatDuration(video.durationSeconds)}
          </div>
        </td>
        <td className="px-4 py-3">
          <Badge variant="outline" className="text-xs border-border/40 text-muted-foreground gap-1">
            <Tag className="h-3 w-3" />
            {shills?.length ?? "—"} shills
          </Badge>
        </td>
      </tr>

      {/* Expanded shill table */}
      {expanded && (
        <tr>
          <td colSpan={7} className="p-0 bg-muted/5">
            <div className="mx-4 my-3 rounded-lg border border-border/40 overflow-hidden">
              <div className="px-4 py-2.5 bg-muted/10 border-b border-border/30 flex items-center justify-between">
                <span className="text-xs font-semibold text-amber-400 uppercase tracking-wider">
                  Sponsorship Log — {video.title}
                </span>
                <span className="text-xs text-muted-foreground">{shills?.length ?? 0} entries</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/5">
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">shill_id</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">video_id</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">product_brand</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">timestamp</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">length_seconds</th>
                      <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">promo_type</th>
                      <th className="px-3 py-2 w-16"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {(shills ?? []).map((s: any) => (
                      <ShillRow
                        key={s.id}
                        shill={s}
                        onDelete={(id) => deleteShill.mutate({ shillId: String(id) })}
                        onUpdate={(id, data) => updateShill.mutate({ shillId: String(id), ...data })}
                      />
                    ))}
                    <AddShillForm videoId={video.videoId} onAdded={() => refetch()} />
                  </tbody>
                </table>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Channel Card ─────────────────────────────────────────────────────────────
function ChannelCard({ channel }: { channel: any }) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(false);

  const { data, isLoading } = trpc.channels.getWithVideos.useQuery(
    { channelId: channel.channelId },
    { enabled: expanded }
  );

  const sync = trpc.channels.syncChannel.useMutation({
    onSuccess: (r) => {
      toast.success(`Sync complete — ${r.newVideos} new video(s), ${r.updatedStats} stats updated`);
      utils.channels.list.invalidate();
      if (expanded) utils.channels.getWithVideos.invalidate({ channelId: channel.channelId });
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });

  const unlink = trpc.channels.unlink.useMutation({
    onSuccess: () => { toast.success("Channel unlinked"); utils.channels.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Card className="border-border/50 bg-card/80 overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {channel.thumbnailUrl ? (
              <img
                src={channel.thumbnailUrl}
                alt=""
                className="w-12 h-12 rounded-full border-2 border-amber-500/30 shrink-0 object-cover"
              />
            ) : (
              <div className="w-12 h-12 rounded-full bg-muted/20 border-2 border-border/30 shrink-0 flex items-center justify-center">
                <Youtube className="h-5 w-5 text-red-500/60" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{channel.channelName}</h3>
                <Youtube className="h-4 w-4 text-red-500 shrink-0" />
              </div>
              {channel.channelHandle && (
                <p className="text-xs text-muted-foreground">{channel.channelHandle}</p>
              )}
              <div className="flex items-center gap-3 mt-1">
                <InfluencerBadge name={channel.influencerName} />
                <span className="text-xs text-muted-foreground">
                  {formatNum(channel.subscriberCount)} subscribers
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs"
              disabled={sync.isPending}
              onClick={() => sync.mutate({ channelId: channel.channelId })}
            >
              <RefreshCw className={`h-3.5 w-3.5 ${sync.isPending ? "animate-spin" : ""}`} />
              {sync.isPending ? "Syncing..." : "Sync"}
            </Button>
            <button
              className="text-muted-foreground hover:text-destructive transition-colors"
              onClick={() => {
                if (confirm(`Unlink ${channel.channelName}?`)) unlink.mutate({ channelId: channel.channelId });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {channel.lastCheckedAt && (
          <p className="text-xs text-muted-foreground mt-2">
            Last synced: {new Date(channel.lastCheckedAt).toLocaleString()}
          </p>
        )}
      </CardHeader>

      <Separator className="opacity-30" />

      <CardContent className="pt-3 pb-0">
        <button
          className="w-full flex items-center justify-between py-2 text-sm font-medium hover:text-amber-400 transition-colors"
          onClick={() => setExpanded((e) => !e)}
        >
          <span>Videos ({data?.videos?.length ?? "..."})</span>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </button>

        {expanded && (
          <div className="pb-3">
            {isLoading ? (
              <div className="space-y-2 py-2">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : (data?.videos?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">
                No videos found. Click Sync to discover uploads.
              </p>
            ) : (
              <div className="overflow-x-auto rounded-lg border border-border/30 mt-2">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border/30 bg-muted/10">
                      <th className="px-4 py-2 w-8"></th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Video</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Published</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Views</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Likes</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Duration</th>
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sponsorships</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.videos?.map((v: any) => <VideoRow key={v.videoId} video={v} />)}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Link Channel Dialog ──────────────────────────────────────────────────────
function LinkChannelDialog({ onLinked }: { onLinked: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    channelInput: "",
    influencerName: "Levi" as typeof INFLUENCERS[number],
  });

  const link = trpc.channels.link.useMutation({
    onSuccess: (r) => {
      toast.success(
        `Linked "${r.channelName}" — ${r.videosDiscovered} videos discovered, ${r.newVideosAdded} added`
      );
      setOpen(false);
      setForm({ channelInput: "", influencerName: "Levi" });
      onLinked();
    },
    onError: (e) => toast.error(`Failed to link channel: ${e.message}`),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Plus className="h-4 w-4" /> Link YouTube Channel
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Youtube className="h-5 w-5 text-red-500" />
            Link YouTube Channel
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
              value={form.channelInput}
              onChange={(e) => setForm((f) => ({ ...f, channelInput: e.target.value }))}
            />
            <p className="text-xs text-muted-foreground">
              Accepts: full YouTube channel URL, @handle, or bare UC... channel ID
            </p>
          </div>
          <div className="space-y-2">
            <Label>Assign to Influencer</Label>
            <Select
              value={form.influencerName}
              onValueChange={(v) => setForm((f) => ({ ...f, influencerName: v as typeof INFLUENCERS[number] }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {INFLUENCERS.map((inf) => (
                  <SelectItem key={inf} value={inf}>{inf}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            className="w-full"
            disabled={!form.channelInput || link.isPending}
            onClick={() => link.mutate(form)}
          >
            {link.isPending ? (
              <span className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Resolving channel & fetching uploads...
              </span>
            ) : (
              "Link Channel & Discover Videos"
            )}
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

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function Channels() {
  const utils = trpc.useUtils();
  const { data: channels, isLoading } = trpc.channels.list.useQuery();

  const grouped = (channels ?? []).reduce<Record<string, typeof channels>>((acc, ch) => {
    const key = ch!.influencerName;
    if (!acc[key]) acc[key] = [];
    acc[key]!.push(ch);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">YouTube Channels</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Link channels to auto-discover uploads and track stats daily. Expand any video to log sponsorships.
          </p>
        </div>
        <LinkChannelDialog onLinked={() => utils.channels.list.invalidate()} />
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Linked Channels", value: channels?.length ?? 0 },
          { label: "Influencers", value: Object.keys(grouped).length },
          { label: "Total Videos Tracked", value: "—" },
        ].map((stat) => (
          <Card key={stat.label} className="border-border/50 bg-card/60">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{stat.label}</p>
              <p className="text-2xl font-bold mt-1 text-amber-400">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Channel list */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </div>
      ) : (channels?.length ?? 0) === 0 ? (
        <Card className="border-border/50 bg-card/60 border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 gap-4">
            <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
              <Youtube className="h-8 w-8 text-red-500/60" />
            </div>
            <div className="text-center">
              <p className="font-semibold">No channels linked yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Link a YouTube channel to start tracking uploads, views, likes, and sponsorships automatically.
              </p>
            </div>
            <LinkChannelDialog onLinked={() => utils.channels.list.invalidate()} />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {INFLUENCERS.filter((inf) => grouped[inf]?.length).map((inf) => (
            <div key={inf} className="space-y-3">
              <div className="flex items-center gap-3">
                <InfluencerBadge name={inf} />
                <span className="text-xs text-muted-foreground">
                  {grouped[inf]?.length} channel{grouped[inf]!.length !== 1 ? "s" : ""}
                </span>
              </div>
              <div className="space-y-3 pl-2">
                {grouped[inf]?.map((ch: any) => <ChannelCard key={ch.channelId} channel={ch} />)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
