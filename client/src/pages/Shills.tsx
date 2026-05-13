import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { InfluencerBadge, PlatformBadge } from "@/components/Badges";
import { Plus, Trash2, Tag, Clock } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PROMO_TYPES = ["Integration", "Dedicated", "Pre-roll", "Mid-roll", "Post-roll", "Affiliate", "Gifted"] as const;

function AddShillDialog({ videos, onSuccess }: { videos: { videoId: string; title: string; influencerName: string; platform: string }[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    videoId: "",
    productBrand: "",
    timestamp: "0:00",
    lengthSeconds: 30,
    promoType: "Integration",
    notes: "",
  });

  const create = trpc.shills.create.useMutation({
    onSuccess: () => {
      toast.success("Sponsorship logged");
      setOpen(false);
      setForm({ videoId: "", productBrand: "", timestamp: "0:00", lengthSeconds: 30, promoType: "Integration", notes: "" });
      onSuccess();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" /> Log Sponsorship
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Log Brand Sponsorship</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="space-y-2">
            <Label>Video</Label>
            <Select value={form.videoId} onValueChange={(v) => setForm((f) => ({ ...f, videoId: v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select a video..." />
              </SelectTrigger>
              <SelectContent>
                {videos.map((v) => (
                  <SelectItem key={v.videoId} value={v.videoId}>
                    <span className="truncate">{v.influencerName} — {v.title.slice(0, 40)}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Brand / Product</Label>
            <Input placeholder="e.g. NordVPN, Squarespace" value={form.productBrand} onChange={(e) => setForm((f) => ({ ...f, productBrand: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Timestamp (m:ss)</Label>
              <Input placeholder="e.g. 4:32" value={form.timestamp} onChange={(e) => setForm((f) => ({ ...f, timestamp: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Length (seconds)</Label>
              <Input type="number" min={1} value={form.lengthSeconds} onChange={(e) => setForm((f) => ({ ...f, lengthSeconds: Number(e.target.value) }))} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Promo Type</Label>
            <Select value={form.promoType} onValueChange={(v) => setForm((f) => ({ ...f, promoType: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROMO_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input placeholder="Any additional notes..." value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
          </div>
          <Button
            className="w-full"
            disabled={create.isPending || !form.videoId || !form.productBrand}
            onClick={() => create.mutate(form)}
          >
            {create.isPending ? "Logging..." : "Log Sponsorship"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Shills() {
  const [brandFilter, setBrandFilter] = useState("");
  const utils = trpc.useUtils();

  const { data: shills, isLoading } = trpc.shills.list.useQuery({});
  const { data: brandSummary } = trpc.shills.brandSummary.useQuery();
  const { data: videos } = trpc.videos.list.useQuery({});

  const deleteShill = trpc.shills.delete.useMutation({
    onSuccess: () => {
      toast.success("Sponsorship removed");
      utils.shills.list.invalidate();
      utils.shills.brandSummary.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const filtered = (shills ?? []).filter((s) =>
    brandFilter === "" || s.productBrand.toLowerCase().includes(brandFilter.toLowerCase())
  );

  const videoList = (videos ?? []).map((v) => ({
    videoId: v.videoId,
    title: v.title,
    influencerName: v.influencerName,
    platform: v.platform,
  }));

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Sponsorships</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {filtered.length} sponsorship{filtered.length !== 1 ? "s" : ""} logged
          </p>
        </div>
        <AddShillDialog
          videos={videoList}
          onSuccess={() => {
            utils.shills.list.invalidate();
            utils.shills.brandSummary.invalidate();
          }}
        />
      </div>

      {/* Brand Summary Cards */}
      {(brandSummary?.length ?? 0) > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {brandSummary?.slice(0, 8).map((brand) => (
            <Card key={brand.productBrand} className="border-border/50 bg-card/80">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Tag className="h-3.5 w-3.5 text-primary" />
                  <span className="text-sm font-semibold truncate">{brand.productBrand}</span>
                </div>
                <p className="text-xs text-muted-foreground">{brand.count} sponsorship{Number(brand.count) !== 1 ? "s" : ""}</p>
                <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                  <Clock className="h-3 w-3" />
                  Avg {Math.round(Number(brand.avgSeconds ?? 0))}s
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter */}
      <div>
        <Input
          placeholder="Filter by brand..."
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="max-w-xs"
        />
      </div>

      {/* Table */}
      <Card className="border-border/50 bg-card/80">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground">
              <p className="text-sm">No sponsorships logged yet. Click "Log Sponsorship" to add one.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Shill ID</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Video</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Influencer</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Brand</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Timestamp</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Length</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase tracking-wider">Notes</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((shill, idx) => (
                    <tr
                      key={shill.shillId}
                      className={`border-b border-border/30 hover:bg-accent/30 transition-colors ${idx % 2 === 0 ? "" : "bg-muted/10"}`}
                    >
                      <td className="px-4 py-3">
                        <code className="text-xs bg-muted/30 px-1.5 py-0.5 rounded font-mono">{shill.shillId}</code>
                      </td>
                      <td className="px-4 py-3 max-w-[180px]">
                        <span className="truncate block text-xs text-muted-foreground" title={shill.videoTitle ?? shill.videoId}>
                          {shill.videoTitle ?? shill.videoId}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {shill.influencerName && <InfluencerBadge name={shill.influencerName} />}
                      </td>
                      <td className="px-4 py-3">
                        {shill.platform && <PlatformBadge platform={shill.platform as "YouTube" | "Instagram" | "TikTok"} />}
                      </td>
                      <td className="px-4 py-3 font-medium">{shill.productBrand}</td>
                      <td className="px-4 py-3 font-mono text-sm">{shill.timestamp}</td>
                      <td className="px-4 py-3 text-muted-foreground">{shill.lengthSeconds}s</td>
                      <td className="px-4 py-3">
                        <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">{shill.promoType}</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground max-w-[120px]">
                        <span className="truncate block">{shill.notes ?? "—"}</span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => deleteShill.mutate({ shillId: shill.shillId })}
                          className="text-muted-foreground hover:text-destructive transition-colors"
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
