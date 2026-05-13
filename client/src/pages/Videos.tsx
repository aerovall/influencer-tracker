import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { InfluencerBadge, PlatformBadge, formatNumber } from "@/components/Badges";
import { ExternalLink, Plus, Trash2, Eye, ThumbsUp, MessageSquare } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const INFLUENCERS = ["Levi", "NoBs", "Danielle"] as const;
const PLATFORMS = ["YouTube", "Instagram", "TikTok"] as const;

function AddVideoDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    influencerName: "Levi" as typeof INFLUENCERS[number],
    platform: "YouTube" as typeof PLATFORMS[number],
    videoUrl: "",
    title: "",
    publishedDate: new Date().toISOString().split("T")[0],
    thumbnailUrl: "",
  });

  const create = trpc.videos.create.useMutation({
    onSuccess: () => {
      toast.success("Video added successfully");
      setOpen(false);
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Add Video
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Video Manually</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Influencer</Label>
              <Select value={form.influencerName} onValueChange={(v) => setForm((f) => ({ ...f, influencerName: v as typeof INFLUENCERS[number] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INFLUENCERS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={form.platform} onValueChange={(v) => setForm((f) => ({ ...f, platform: v as typeof PLATFORMS[number] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Video URL</Label>
            <Input placeholder="https://..." value={form.videoUrl} onChange={(e) => setForm((f) => ({ ...f, videoUrl: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Title</Label>
            <Input placeholder="Video title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Published Date</Label>
            <Input type="date" value={form.publishedDate} onChange={(e) => setForm((f) => ({ ...f, publishedDate: e.target.value }))} />
          </div>
          <div className="space-y-2">
            <Label>Thumbnail URL (optional)</Label>
            <Input placeholder="https://..." value={form.thumbnailUrl} onChange={(e) => setForm((f) => ({ ...f, thumbnailUrl: e.target.value }))} />
          </div>
          <Button
            className="w-full"
            disabled={create.isPending || !form.videoUrl || !form.title}
            onClick={() => create.mutate(form)}
          >
            {create.isPending ? "Adding..." : "Add Video"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Videos() {
  const [influencerFilter, setInfluencerFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [search, setSearch] = useState("");

  const utils = trpc.useUtils();
  const { data: videos, isLoading } = trpc.videos.list.useQuery({
    influencerName: influencerFilter === "all" ? undefined : influencerFilter,
    platform: platformFilter === "all" ? undefined : platformFilter,
  });

  const deleteVideo = trpc.videos.delete.useMutation({
    onSuccess: () => {
      toast.success("Video removed");
      utils.videos.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = videos?.filter((v) =>
    search === "" || v.title.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Video Catalog</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {filtered.length} video{filtered.length !== 1 ? "s" : ""} tracked
          </p>
        </div>
        <AddVideoDialog onSuccess={() => utils.videos.list.invalidate()} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search videos..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={influencerFilter} onValueChange={setInfluencerFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Influencer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Influencers</SelectItem>
            {INFLUENCERS.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Platforms</SelectItem>
            {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-14 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-sm">No videos found. Add videos manually or run a sync from the Admin panel.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Title</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Influencer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Published</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Date Added</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Video ID</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((video, idx) => (
                    <tr
                      key={video.videoId}
                      className={`border-b border-border/30 hover:bg-accent/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 max-w-xs">
                          {video.thumbnailUrl && (
                            <img src={video.thumbnailUrl} alt="" className="h-8 w-14 object-cover rounded shrink-0" />
                          )}
                          <a
                            href={video.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-medium truncate hover:text-primary transition-colors flex items-center gap-1"
                          >
                            {video.title}
                            <ExternalLink className="h-3 w-3 shrink-0 opacity-50" />
                          </a>
                        </div>
                      </td>
                      <td className="px-4 py-3"><InfluencerBadge name={video.influencerName} /></td>
                      <td className="px-4 py-3"><PlatformBadge platform={video.platform} /></td>
                      <td className="px-4 py-3 text-muted-foreground">{video.publishedDate}</td>
                      <td className="px-4 py-3 text-muted-foreground">{video.dateAdded}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted/30 px-1.5 py-0.5 rounded font-mono">{video.videoId}</code>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteVideo.mutate({ videoId: video.videoId })}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                          title="Remove video"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
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
