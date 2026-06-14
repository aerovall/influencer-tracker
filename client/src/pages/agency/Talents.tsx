import { trpc } from "@/lib/trpc";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { Users, Youtube, TrendingUp, Video, ArrowRight } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

function fmtNum(n: number | null | undefined) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function TalentsPage() {
  const { data: channels = [], isLoading } = trpc.channels.list.useQuery();
  const [search, setSearch] = useState("");

  const filtered = channels.filter((ch: any) =>
    !search || (ch.channelName ?? ch.channelId ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Talents</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{channels.length} talent{channels.length !== 1 ? "s" : ""} tracked</p>
        </div>
        <Input
          placeholder="Search talents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-56"
        />
      </div>

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
            <TalentCard key={ch.channelId} channel={ch} />
          ))}
        </div>
      )}
    </div>
  );
}

function TalentCard({ channel }: { channel: any }) {
  const [, setLocation] = useLocation();
  return (
    <div className="rounded-xl border bg-card p-5 space-y-4 hover:border-primary/30 transition-colors">
      <div className="flex items-center gap-3">
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
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-1.5"
        onClick={() => setLocation(`/agency/talents/${channel.channelId}`)}
      >
        View Profile <ArrowRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
