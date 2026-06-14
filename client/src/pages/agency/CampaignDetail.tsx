import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import { ArrowLeft, Plus, MoreVertical, Pencil, Trash2, Star, Calendar, DollarSign } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-600",
  paused: "bg-amber-500/15 text-amber-600",
  completed: "bg-blue-500/15 text-blue-600",
  cancelled: "bg-red-500/15 text-red-600",
};

const DELIVERABLE_STATUS_COLORS: Record<string, string> = {
  brief_sent: "bg-blue-500/15 text-blue-600",
  script_review: "bg-purple-500/15 text-purple-600",
  filming: "bg-amber-500/15 text-amber-600",
  editing: "bg-orange-500/15 text-orange-600",
  review: "bg-yellow-500/15 text-yellow-600",
  published: "bg-emerald-500/15 text-emerald-600",
  cancelled: "bg-red-500/15 text-red-600",
};

const emptyDeliverableForm = {
  talentName: "",
  channelId: "",
  contentType: "dedicated_video",
  dueDate: "",
  agreedFee: "",
  currency: "USD",
  briefNotes: "",
};

export default function CampaignDetailPage() {
  const [, params] = useRoute("/agency/campaigns/:id");
  const [, setLocation] = useLocation();
  const utils = trpc.useUtils();
  const campaignId = params?.id ? parseInt(params.id) : 0;

  const { data, isLoading } = trpc.campaigns.get.useQuery({ id: campaignId }, { enabled: !!campaignId });
  const { data: deliverables = [] } = trpc.deliverables.listByCampaign.useQuery({ campaignId }, { enabled: !!campaignId });
  const { data: channels = [] } = trpc.channels.list.useQuery();

  const [dlgOpen, setDlgOpen] = useState(false);
  const [editingDeliverableId, setEditingDeliverableId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyDeliverableForm);

  const createDeliverable = trpc.deliverables.create.useMutation({
    onSuccess: () => { utils.deliverables.listByCampaign.invalidate({ campaignId }); setDlgOpen(false); setForm(emptyDeliverableForm); toast.success("Deliverable added"); },
    onError: (e) => toast.error(e.message),
  });

  const updateDeliverable = trpc.deliverables.update.useMutation({
    onSuccess: () => { utils.deliverables.listByCampaign.invalidate({ campaignId }); setDlgOpen(false); toast.success("Deliverable updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteDeliverable = trpc.deliverables.delete.useMutation({
    onSuccess: () => { utils.deliverables.listByCampaign.invalidate({ campaignId }); toast.success("Deliverable deleted"); },
  });

  function openAddDeliverable() {
    setEditingDeliverableId(null);
    setForm(emptyDeliverableForm);
    setDlgOpen(true);
  }

  function openEditDeliverable(d: typeof deliverables[0]) {
    setEditingDeliverableId(d.id);
    setForm({
      talentName: d.talentName,
      channelId: d.channelId ?? "",
      contentType: d.contentType,
      dueDate: d.dueDate ?? "",
      agreedFee: d.agreedFee ?? "",
      currency: d.currency,
      briefNotes: d.briefNotes ?? "",
    });
    setDlgOpen(true);
  }

  function handleDeliverableSubmit() {
    if (!form.talentName.trim()) return;
    const payload = {
      campaignId,
      talentName: form.talentName,
      channelId: form.channelId || undefined,
      contentType: form.contentType as any,
      dueDate: form.dueDate || undefined,
      agreedFee: form.agreedFee || "0",
      currency: form.currency,
      briefNotes: form.briefNotes || undefined,
    };
    if (editingDeliverableId !== null) {
      updateDeliverable.mutate({ id: editingDeliverableId, ...payload });
    } else {
      createDeliverable.mutate(payload);
    }
  }

  if (isLoading) {
    return <div className="max-w-5xl mx-auto space-y-4"><div className="h-8 w-48 bg-muted/40 rounded animate-pulse" /><div className="h-32 bg-muted/40 rounded-xl animate-pulse" /></div>;
  }

  if (!data) {
    return <div className="max-w-5xl mx-auto py-20 text-center text-muted-foreground">Campaign not found.</div>;
  }

  const { campaign, client } = data;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Back + header */}
      <div className="flex items-start gap-4">
        <Button variant="ghost" size="icon" onClick={() => setLocation("/agency/campaigns")} className="mt-0.5 shrink-0">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold tracking-tight">{campaign.name}</h1>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[campaign.status] ?? "bg-muted text-muted-foreground"}`}>
              {campaign.status}
            </span>
          </div>
          {client && <p className="text-sm text-muted-foreground mt-0.5">{client.companyName}</p>}
        </div>
      </div>

      {/* Campaign meta */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Budget", value: campaign.budget && parseFloat(campaign.budget) > 0 ? `${campaign.currency} ${parseFloat(campaign.budget).toLocaleString()}` : "—", icon: DollarSign },
          { label: "Start", value: campaign.startDate ?? "—", icon: Calendar },
          { label: "End", value: campaign.endDate ?? "—", icon: Calendar },
          { label: "Deliverables", value: deliverables.length.toString(), icon: Star },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Icon className="h-3.5 w-3.5" />
              <span className="text-xs font-medium">{label}</span>
            </div>
            <p className="text-lg font-semibold">{value}</p>
          </div>
        ))}
      </div>

      {/* Objective / Brief */}
      {(campaign.objective || campaign.notes) && (
        <div className="rounded-xl border bg-card p-5 space-y-3">
          {campaign.objective && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Objective</p>
              <p className="text-sm">{campaign.objective}</p>
            </div>
          )}
          {campaign.notes && (
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">Notes</p>
              <p className="text-sm text-muted-foreground">{campaign.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Deliverables */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Talent Deliverables</h2>
          <Button onClick={openAddDeliverable} size="sm" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add Deliverable
          </Button>
        </div>

        {deliverables.length === 0 ? (
          <div className="rounded-xl border border-dashed p-10 text-center text-muted-foreground text-sm">
            No deliverables yet. Add a talent deliverable to track content for this campaign.
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Talent</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Fee</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {deliverables.map((d, i) => (
                  <tr key={d.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{d.talentName}</p>
                      {d.channelId && <p className="text-xs text-muted-foreground">{d.channelId}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{d.contentType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${DELIVERABLE_STATUS_COLORS[d.status] ?? "bg-muted text-muted-foreground"}`}>
                        {d.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{d.dueDate ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {d.agreedFee && parseFloat(d.agreedFee) > 0 ? `${d.currency} ${parseFloat(d.agreedFee).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEditDeliverable(d)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteDeliverable.mutate({ id: d.id })} className="text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Deliverable Dialog */}
      <Dialog open={dlgOpen} onOpenChange={setDlgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDeliverableId !== null ? "Edit Deliverable" : "Add Deliverable"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Talent Name *</Label>
              <Input value={form.talentName} onChange={(e) => setForm(f => ({ ...f, talentName: e.target.value }))} placeholder="e.g. Conor Kenny" />
            </div>
            <div className="space-y-1.5">
              <Label>Channel (optional)</Label>
              <Select value={form.channelId} onValueChange={(v) => setForm(f => ({ ...f, channelId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="Link to tracked channel" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {channels.map((ch: any) => (
                    <SelectItem key={ch.channelId} value={ch.channelId}>{ch.channelName ?? ch.channelId}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Content Type</Label>
                <Select value={form.contentType} onValueChange={(v) => setForm(f => ({ ...f, contentType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["dedicated_video", "integration", "short", "story", "post", "other"].map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Agreed Fee</Label>
                <Input type="number" value={form.agreedFee} onChange={(e) => setForm(f => ({ ...f, agreedFee: e.target.value }))} placeholder="1500" />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="USD" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Brief Notes</Label>
              <Textarea value={form.briefNotes} onChange={(e) => setForm(f => ({ ...f, briefNotes: e.target.value }))} placeholder="Specific instructions for this talent..." rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDlgOpen(false)}>Cancel</Button>
            <Button onClick={handleDeliverableSubmit} disabled={!form.talentName.trim() || createDeliverable.isPending || updateDeliverable.isPending}>
              {editingDeliverableId !== null ? "Save Changes" : "Add Deliverable"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
