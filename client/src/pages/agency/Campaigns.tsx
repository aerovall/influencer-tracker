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
import { Plus, MoreVertical, Megaphone, Pencil, Trash2, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

type CampaignRow = {
  campaign: {
    id: number;
    clientId: number;
    name: string;
    objective: string | null;
    budget: string | null;
    currency: string;
    startDate: string | null;
    endDate: string | null;
    status: "draft" | "active" | "paused" | "completed" | "cancelled";
    notes: string | null;
    createdAt: Date;
    updatedAt: Date;
  };
  client: { companyName: string; contactEmail: string | null } | null;
};

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-600",
  paused: "bg-amber-500/15 text-amber-600",
  completed: "bg-blue-500/15 text-blue-600",
  cancelled: "bg-red-500/15 text-red-600",
};

const emptyForm = {
  clientId: "",
  name: "",
  objective: "",
  status: "draft",
  budget: "",
  currency: "USD",
  startDate: "",
  endDate: "",
  notes: "",
};

export default function CampaignsPage() {
  const utils = trpc.useUtils();
  const [, setLocation] = useLocation();

  const { data: rows = [], isLoading } = trpc.campaigns.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [statusFilter, setStatusFilter] = useState("all");

  const createMutation = trpc.campaigns.create.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); setDialogOpen(false); setForm(emptyForm); toast.success("Campaign created"); },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.campaigns.update.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); setDialogOpen(false); setEditingId(null); toast.success("Campaign updated"); },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.campaigns.delete.useMutation({
    onSuccess: () => { utils.campaigns.list.invalidate(); toast.success("Campaign deleted"); },
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(row: CampaignRow) {
    const c = row.campaign;
    setEditingId(c.id);
    setForm({
      clientId: c.clientId?.toString() ?? "",
      name: c.name,
      objective: c.objective ?? "",
      status: c.status,
      budget: c.budget ?? "",
      currency: c.currency,
      startDate: c.startDate ?? "",
      endDate: c.endDate ?? "",
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.name.trim() || !form.clientId) return;
    const payload = {
      clientId: parseInt(form.clientId),
      name: form.name,
      objective: form.objective || undefined,
      status: form.status as "draft" | "active" | "paused" | "completed" | "cancelled",
      budget: form.budget || "0",
      currency: form.currency,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
      notes: form.notes || undefined,
    };
    if (editingId !== null) {
      updateMutation.mutate({ id: editingId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const filtered = statusFilter === "all" ? rows : rows.filter(r => r.campaign.status === statusFilter);
  const statuses = ["all", "draft", "active", "paused", "completed", "cancelled"];

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Campaigns</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rows.length} total campaign{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Campaign
        </Button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {statuses.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${statusFilter === s ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}
          >
            {s === "all" ? `All (${rows.length})` : `${s} (${rows.filter(r => r.campaign.status === s).length})`}
          </button>
        ))}
      </div>

      {/* Campaign table */}
      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Megaphone className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No campaigns yet. Create your first campaign.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campaign</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Budget</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Dates</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row, i) => {
                const c = row.campaign;
                return (
                  <tr key={c.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors cursor-pointer ${i % 2 === 0 ? "" : "bg-muted/10"}`} onClick={() => setLocation(`/agency/campaigns/${c.id}`)}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{c.name}</p>
                      {c.objective && <p className="text-xs text-muted-foreground truncate max-w-xs">{c.objective}</p>}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{row.client?.companyName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[c.status] ?? "bg-muted text-muted-foreground"}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {c.budget && parseFloat(c.budget) > 0 ? `${c.currency} ${parseFloat(c.budget).toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {c.startDate && c.endDate ? `${c.startDate} → ${c.endDate}` : c.startDate ?? "—"}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setLocation(`/agency/campaigns/${c.id}`)}><ChevronRight className="h-3.5 w-3.5 mr-2" />View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEdit(row)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteMutation.mutate({ id: c.id })} className="text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
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

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId !== null ? "Edit Campaign" : "New Campaign"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="space-y-1.5">
              <Label>Campaign Name *</Label>
              <Input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="BTC Summer Push" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Client *</Label>
                <Select value={form.clientId} onValueChange={(v) => setForm(f => ({ ...f, clientId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.companyName}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm(f => ({ ...f, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["draft", "active", "paused", "completed", "cancelled"].map(s => (
                      <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Budget</Label>
                <Input type="number" value={form.budget} onChange={(e) => setForm(f => ({ ...f, budget: e.target.value }))} placeholder="5000" />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="USD" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Start Date</Label>
                <Input type="date" value={form.startDate} onChange={(e) => setForm(f => ({ ...f, startDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>End Date</Label>
                <Input type="date" value={form.endDate} onChange={(e) => setForm(f => ({ ...f, endDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Objective</Label>
              <Textarea value={form.objective} onChange={(e) => setForm(f => ({ ...f, objective: e.target.value }))} placeholder="Campaign objective and goals..." rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.name.trim() || !form.clientId || createMutation.isPending || updateMutation.isPending}>
              {editingId !== null ? "Save Changes" : "Create Campaign"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
