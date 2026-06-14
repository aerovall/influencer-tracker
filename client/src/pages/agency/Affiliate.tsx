import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, MoreVertical, Link2, Pencil, Trash2, Copy, ExternalLink } from "lucide-react";

const emptyForm = {
  talentName: "",
  campaignId: "",
  channelId: "",
  url: "",
  shortCode: "",
  commissionType: "flat",
  commissionRate: "",
  notes: "",
};

export default function AffiliatePage() {
  const utils = trpc.useUtils();
  const { data: links = [], isLoading } = trpc.affiliate.listLinks.useQuery();
  const { data: campaigns = [] } = trpc.campaigns.list.useQuery();
  const { data: channels = [] } = trpc.channels.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const createMutation = trpc.affiliate.createLink.useMutation({
    onSuccess: () => { utils.affiliate.listLinks.invalidate(); setDialogOpen(false); setForm(emptyForm); toast.success("Affiliate link created"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateMutation = trpc.affiliate.updateLink.useMutation({
    onSuccess: () => { utils.affiliate.listLinks.invalidate(); setDialogOpen(false); setEditingId(null); toast.success("Link updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  // No delete procedure in affiliate router — use updateLink to deactivate
  function deactivateLink(id: number) {
    updateMutation.mutate({ id, isActive: false });
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(link: any) {
    setEditingId(link.id);
    setForm({
      talentName: link.talentName,
      campaignId: link.campaignId?.toString() ?? "",
      channelId: link.channelId ?? "",
      url: link.url,
      shortCode: link.shortCode ?? "",
      commissionType: link.commissionType,
      commissionRate: link.commissionRate ?? "",
      notes: link.notes ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.talentName.trim() || !form.url.trim()) return;
    const payload = {
      talentName: form.talentName,
      campaignId: form.campaignId ? parseInt(form.campaignId) : undefined,
      channelId: form.channelId || undefined,
      url: form.url,
      shortCode: form.shortCode || undefined,
      commissionType: form.commissionType as any,
      commissionRate: form.commissionRate || "0",
      notes: form.notes || undefined,
    };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Affiliate Links</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{links.length} link{links.length !== 1 ? "s" : ""} tracked</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Link
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />)}</div>
      ) : links.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Link2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No affiliate links yet. Add your first link.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Talent</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">URL</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Commission</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campaign</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {links.map((link: any, i: number) => {
                const campaign = campaigns.find((r: any) => r.campaign?.id === link.campaignId);
                return (
                  <tr key={link.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{link.talentName}</p>
                      {link.shortCode && <p className="text-xs text-muted-foreground font-mono">{link.shortCode}</p>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground truncate max-w-[180px]">{link.url}</span>
                        <button onClick={() => { navigator.clipboard.writeText(link.url); toast.success("Copied!"); }} className="text-muted-foreground hover:text-foreground transition-colors">
                          <Copy className="h-3 w-3" />
                        </button>
                        <a href={link.url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground transition-colors">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">
                      {link.commissionRate && parseFloat(link.commissionRate) > 0 ? `${link.commissionRate} (${link.commissionType})` : link.commissionType}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{campaign?.campaign?.name ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${link.isActive ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                        {link.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(link)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deactivateLink(link.id)} className="text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" />Deactivate</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Conversion Funnel Summary */}
      {links.length > 0 && (() => {
        const activeLinks = links.filter((l: any) => l.isActive);
        const totalClicks = links.reduce((s: number, l: any) => s + (l.totalClicks ?? 0), 0);
        const totalConversions = links.reduce((s: number, l: any) => s + (l.totalConversions ?? 0), 0);
        const totalRevenue = links.reduce((s: number, l: any) => s + parseFloat(l.totalRevenue ?? "0"), 0);
        const convRate = totalClicks > 0 ? ((totalConversions / totalClicks) * 100).toFixed(1) : "0.0";
        const revenuePerClick = totalClicks > 0 ? (totalRevenue / totalClicks).toFixed(2) : "0.00";
        // Per-talent funnel rows
        const byTalent = links.reduce((acc: Record<string, any>, l: any) => {
          const name = l.talentName || "Unknown";
          if (!acc[name]) acc[name] = { clicks: 0, conversions: 0, revenue: 0, links: 0 };
          acc[name].clicks += l.totalClicks ?? 0;
          acc[name].conversions += l.totalConversions ?? 0;
          acc[name].revenue += parseFloat(l.totalRevenue ?? "0");
          acc[name].links += 1;
          return acc;
        }, {});
        const talentRows = Object.entries(byTalent)
          .map(([name, s]: [string, any]) => ({ name, ...s, convRate: s.clicks > 0 ? ((s.conversions / s.clicks) * 100).toFixed(1) : "0.0" }))
          .sort((a, b) => b.clicks - a.clicks);
        return (
          <div className="rounded-xl border bg-card p-5 space-y-5">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Conversion Funnel</h3>
            {/* Funnel KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {[
                { label: "Active Links", value: activeLinks.length.toString() },
                { label: "Total Clicks", value: totalClicks.toLocaleString() },
                { label: "Conversions", value: totalConversions.toLocaleString() },
                { label: "Conv. Rate", value: `${convRate}%` },
                { label: "Revenue / Click", value: `$${revenuePerClick}` },
              ].map(({ label, value }) => (
                <div key={label} className="space-y-1">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-lg font-bold">{value}</p>
                </div>
              ))}
            </div>
            {/* Visual funnel bars */}
            <div className="space-y-2">
              {[
                { label: "Clicks", value: totalClicks, max: totalClicks, color: "bg-sky-500" },
                { label: "Conversions", value: totalConversions, max: totalClicks, color: "bg-amber-400" },
              ].map(({ label, value, max, color }) => (
                <div key={label} className="space-y-1">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{label}</span>
                    <span className="font-medium text-foreground">{value.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-muted/30 rounded-full h-2.5 overflow-hidden">
                    <div
                      className={`h-2.5 rounded-full ${color} transition-all duration-700`}
                      style={{ width: max > 0 ? `${(value / max) * 100}%` : "0%" }}
                    />
                  </div>
                </div>
              ))}
            </div>
            {/* Per-talent breakdown */}
            {talentRows.length > 0 && (
              <div className="rounded-lg border overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b bg-muted/20">
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Talent</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Links</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Clicks</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Conversions</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Conv. Rate</th>
                      <th className="text-right px-3 py-2 font-medium text-muted-foreground">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {talentRows.map((row: any, i: number) => (
                      <tr key={row.name} className={`border-b last:border-0 ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                        <td className="px-3 py-2 font-medium">{row.name}</td>
                        <td className="px-3 py-2 text-right text-muted-foreground">{row.links}</td>
                        <td className="px-3 py-2 text-right">{row.clicks.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">{row.conversions.toLocaleString()}</td>
                        <td className="px-3 py-2 text-right">
                          <span className={`font-medium ${parseFloat(row.convRate) >= 5 ? "text-emerald-400" : parseFloat(row.convRate) >= 2 ? "text-amber-400" : "text-muted-foreground"}`}>
                            {row.convRate}%
                          </span>
                        </td>
                        <td className="px-3 py-2 text-right">{row.revenue > 0 ? `$${row.revenue.toLocaleString()}` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })()}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Edit Link" : "Add Affiliate Link"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Talent Name *</Label>
              <Input value={form.talentName} onChange={(e) => setForm(f => ({ ...f, talentName: e.target.value }))} placeholder="Conor Kenny" />
            </div>
            <div className="space-y-1.5">
              <Label>URL *</Label>
              <Input value={form.url} onChange={(e) => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://example.com/ref/talent" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Short Code</Label>
                <Input value={form.shortCode} onChange={(e) => setForm(f => ({ ...f, shortCode: e.target.value }))} placeholder="TALENT20" />
              </div>
              <div className="space-y-1.5">
                <Label>Campaign</Label>
                <Select value={form.campaignId} onValueChange={(v) => setForm(f => ({ ...f, campaignId: v === "__none__" ? "" : v }))}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {campaigns.map((r: any) => (
                      <SelectItem key={r.campaign.id} value={r.campaign.id.toString()}>{r.campaign.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Commission Type</Label>
                <Select value={form.commissionType} onValueChange={(v) => setForm(f => ({ ...f, commissionType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["flat", "cpc", "cpa", "revenue_share"].map(t => (
                      <SelectItem key={t} value={t} className="uppercase">{t.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Commission Rate</Label>
                <Input type="number" value={form.commissionRate} onChange={(e) => setForm(f => ({ ...f, commissionRate: e.target.value }))} placeholder="0.10" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Internal notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.talentName.trim() || !form.url.trim() || createMutation.isPending || updateMutation.isPending}>
              {editingId !== null ? "Save Changes" : "Add Link"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
