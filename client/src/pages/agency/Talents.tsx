import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { useState, useMemo } from "react";
import { Users, Youtube, ArrowRight, GitCompareArrows, X, Check, Eye, Video, TrendingUp } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

function fmtNum(n: number | null | undefined) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

// ─── Comparison Table ─────────────────────────────────────────────────────────

function ComparisonTable({ channels, onRemove }: { channels: any[]; onRemove: (id: string) => void }) {
  const { data: talentStats = [] } = trpc.affiliate.talentStats.useQuery();

  const statsMap = useMemo(() => {
    const m: Record<string, any> = {};
    (talentStats as any[]).forEach((s: any) => { m[s.channelId] = s; });
    return m;
  }, [talentStats]);

  if (channels.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-muted/10 flex flex-col items-center justify-center py-10 text-center">
        <GitCompareArrows className="h-10 w-10 text-muted-foreground/30 mb-3" />
        <p className="text-sm text-muted-foreground">Select 2–3 talents to compare side by side</p>
      </div>
    );
  }

  const rows = [
    { label: "Subscribers", icon: <Users className="h-3.5 w-3.5" />, getValue: (ch: any) => fmtNum(ch.subscriberCount) },
    { label: "Videos", icon: <Video className="h-3.5 w-3.5" />, getValue: (ch: any) => fmtNum(ch.videoCount) },
    { label: "Total Views", icon: <Eye className="h-3.5 w-3.5" />, getValue: (ch: any) => fmtNum(statsMap[ch.channelId]?.totalViews) },
    { label: "Avg Views / Video", icon: <TrendingUp className="h-3.5 w-3.5" />, getValue: (ch: any) => fmtNum(statsMap[ch.channelId]?.avgViewsPerVideo) },
    { label: "Campaigns", icon: <Check className="h-3.5 w-3.5" />, getValue: (ch: any) => String(statsMap[ch.channelId]?.campaignCount ?? 0) },
    { label: "Platform", icon: null, getValue: (ch: any) => ch.platform ?? "YouTube" },
    { label: "Last Sync", icon: null, getValue: (ch: any) => ch.lastSyncAt ? new Date(ch.lastSyncAt).toLocaleDateString() : "—" },
  ];

  // Highlight the best value for numeric rows
  function getBestIdx(row: typeof rows[0]) {
    const vals = channels.map((ch) => {
      const raw = row.getValue(ch).replace(/[^0-9.]/g, "");
      return parseFloat(raw) || 0;
    });
    const max = Math.max(...vals);
    return max > 0 ? vals.indexOf(max) : -1;
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      {/* Header row */}
      <div className="grid border-b" style={{ gridTemplateColumns: `180px repeat(${channels.length}, 1fr)` }}>
        <div className="px-4 py-3 bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wide">Metric</div>
        {channels.map((ch: any) => (
          <div key={ch.channelId} className="px-4 py-3 bg-muted/30 flex items-center gap-2 border-l">
            {ch.thumbnailUrl ? (
              <img src={ch.thumbnailUrl} alt={ch.channelName} className="h-7 w-7 rounded-full object-cover shrink-0" />
            ) : (
              <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Youtube className="h-3.5 w-3.5 text-primary" />
              </div>
            )}
            <span className="text-sm font-semibold truncate flex-1">{ch.channelName ?? ch.channelId}</span>
            <button
              onClick={() => onRemove(ch.channelId)}
              className="shrink-0 text-muted-foreground/40 hover:text-muted-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Data rows */}
      {rows.map((row, ri) => {
        const bestIdx = getBestIdx(row);
        return (
          <div
            key={row.label}
            className={`grid border-b last:border-0 ${ri % 2 === 0 ? "" : "bg-muted/10"}`}
            style={{ gridTemplateColumns: `180px repeat(${channels.length}, 1fr)` }}
          >
            <div className="px-4 py-3 flex items-center gap-2 text-sm text-muted-foreground">
              {row.icon}
              {row.label}
            </div>
            {channels.map((ch: any, ci: number) => (
              <div
                key={ch.channelId}
                className={`px-4 py-3 text-sm font-medium border-l ${bestIdx === ci ? "text-amber-500" : ""}`}
              >
                {row.getValue(ch)}
                {bestIdx === ci && <span className="ml-1.5 text-xs text-amber-500/60">▲</span>}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// ─── Talent Card ──────────────────────────────────────────────────────────────

function TalentCard({
  channel,
  compareMode,
  selected,
  onToggleSelect,
}: {
  channel: any;
  compareMode: boolean;
  selected: boolean;
  onToggleSelect: (id: string) => void;
}) {
  const [, setLocation] = useLocation();
  return (
    <div
      className={`rounded-xl border bg-card p-5 space-y-4 transition-colors ${
        compareMode
          ? selected
            ? "border-amber-500/60 bg-amber-500/5"
            : "hover:border-muted-foreground/30 cursor-pointer"
          : "hover:border-primary/30"
      }`}
      onClick={compareMode ? () => onToggleSelect(channel.channelId) : undefined}
    >
      <div className="flex items-center gap-3">
        {compareMode && (
          <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${selected ? "border-amber-500 bg-amber-500" : "border-muted-foreground/30"}`}>
            {selected && <Check className="h-3 w-3 text-black" />}
          </div>
        )}
        {channel.thumbnailUrl ? (
          <img src={channel.thumbnailUrl} alt={channel.channelName} className="h-12 w-12 rounded-full object-cover border shrink-0" />
        ) : (
          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Youtube className="h-5 w-5 text-primary" />
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold truncate">{channel.channelName ?? channel.channelId}</p>
          <p className="text-xs text-muted-foreground">{fmtNum(channel.subscriberCount)} subscribers</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground mb-0.5">Videos</p>
          <p className="text-sm font-semibold">{fmtNum(channel.videoCount)}</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground mb-0.5">Platform</p>
          <p className="text-sm font-semibold capitalize">{channel.platform ?? "YouTube"}</p>
        </div>
        <div className="rounded-lg bg-muted/30 p-2">
          <p className="text-xs text-muted-foreground mb-0.5">Subscribers</p>
          <p className="text-sm font-semibold">{fmtNum(channel.subscriberCount)}</p>
        </div>
      </div>

      {channel.lastSyncAt && (
        <p className="text-xs text-muted-foreground">
          Last sync: {new Date(channel.lastSyncAt).toLocaleDateString()}
        </p>
      )}

      {!compareMode && (
        <Button
          variant="outline"
          size="sm"
          className="w-full gap-1.5"
          onClick={() => setLocation(`/agency/talents/${channel.channelId}`)}
        >
          View Profile <ArrowRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function TalentsPage() {
  const { data: channels = [], isLoading } = trpc.channels.list.useQuery();
  const [search, setSearch] = useState("");
  const [compareMode, setCompareMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const filtered = channels.filter((ch: any) =>
    !search || (ch.channelName ?? ch.channelId ?? "").toLowerCase().includes(search.toLowerCase())
  );

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 3) return prev; // max 3
      return [...prev, id];
    });
  }

  function exitCompare() {
    setCompareMode(false);
    setSelectedIds([]);
  }

  const selectedChannels = (channels as any[]).filter((ch: any) => selectedIds.includes(ch.channelId));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Talents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{channels.length} talent{channels.length !== 1 ? "s" : ""} tracked</p>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          {compareMode && (
            <Badge variant="outline" className="text-amber-500 border-amber-500/40 bg-amber-500/5">
              {selectedIds.length}/3 selected
            </Badge>
          )}
          <Input
            placeholder="Search talents..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-48"
          />
          <Button
            variant={compareMode ? "default" : "outline"}
            size="sm"
            className="gap-1.5 shrink-0"
            onClick={() => compareMode ? exitCompare() : setCompareMode(true)}
          >
            <GitCompareArrows className="h-4 w-4" />
            {compareMode ? "Exit Compare" : "Compare"}
          </Button>
        </div>
      </div>

      {/* Comparison table (shown when in compare mode and ≥1 selected) */}
      {compareMode && (
        <ComparisonTable channels={selectedChannels} onRemove={(id) => setSelectedIds((p) => p.filter((x) => x !== id))} />
      )}

      {/* Talent grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <div key={i} className="h-40 rounded-xl bg-muted/40 animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No talents found.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((ch: any) => (
            <TalentCard
              key={ch.channelId}
              channel={ch}
              compareMode={compareMode}
              selected={selectedIds.includes(ch.channelId)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {compareMode && selectedIds.length < 2 && (
        <p className="text-center text-sm text-muted-foreground">
          Select at least 2 talents to see the comparison table above.
        </p>
      )}
    </div>
  );
}
