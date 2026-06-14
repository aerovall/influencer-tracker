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
import { Plus, MoreVertical, FileText, Pencil, Trash2, CheckCircle, Send } from "lucide-react";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  sent: "bg-blue-500/15 text-blue-600",
  paid: "bg-emerald-500/15 text-emerald-600",
  overdue: "bg-red-500/15 text-red-600",
  cancelled: "bg-muted text-muted-foreground",
};

const emptyForm = {
  clientId: "",
  campaignId: "",
  invoiceNumber: "",
  currency: "USD",
  subtotal: "",
  taxRate: "0",
  issuedDate: "",
  dueDate: "",
  notes: "",
};

export default function InvoicesPage() {
  const utils = trpc.useUtils();
  const { data: rows = [], isLoading } = trpc.invoices.list.useQuery();
  const { data: clients = [] } = trpc.clients.list.useQuery();
  const { data: campaigns = [] } = trpc.campaigns.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState(emptyForm);

  const createMutation = trpc.invoices.create.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); setDialogOpen(false); setForm(emptyForm); toast.success("Invoice created"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateStatusMutation = trpc.invoices.updateStatus.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); toast.success("Status updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = trpc.invoices.delete.useMutation({
    onSuccess: () => { utils.invoices.list.invalidate(); toast.success("Invoice deleted"); },
  });

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, invoiceNumber: `INV-${new Date().getFullYear()}-${String(rows.length + 1).padStart(3, "0")}` });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.clientId || !form.subtotal) return;
    createMutation.mutate({
      clientId: parseInt(form.clientId),
      campaignId: form.campaignId ? parseInt(form.campaignId) : undefined,
      currency: form.currency,
      taxRate: form.taxRate || "0",
      issuedDate: form.issuedDate || undefined,
      dueDate: form.dueDate || undefined,
      notes: form.notes || undefined,
      lineItems: [{ description: "Services", quantity: "1", unitPrice: form.subtotal }],
    });
  }

  const totalPaid = rows.filter((r: any) => r.invoice.status === "paid").reduce((acc: number, r: any) => acc + parseFloat(r.invoice.total ?? "0"), 0);
  const totalOutstanding = rows.filter((r: any) => ["sent", "overdue"].includes(r.invoice.status)).reduce((acc: number, r: any) => acc + parseFloat(r.invoice.total ?? "0"), 0);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{rows.length} invoice{rows.length !== 1 ? "s" : ""}</p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Invoices", value: rows.length.toString() },
          { label: "Paid", value: rows.filter((r: any) => r.invoice.status === "paid").length.toString(), color: "text-emerald-600" },
          { label: "Outstanding", value: `$${totalOutstanding.toLocaleString()}`, color: "text-amber-600" },
          { label: "Collected", value: `$${totalPaid.toLocaleString()}`, color: "text-emerald-600" },
        ].map(({ label, value, color }) => (
          <div key={label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <p className={`text-xl font-semibold ${color ?? ""}`}>{value}</p>
          </div>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />)}</div>
      ) : rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No invoices yet. Create your first invoice.</p>
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30">
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Invoice #</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Total</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Issued</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Due</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row: any, i: number) => {
                const inv = row.invoice;
                return (
                  <tr key={inv.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3 text-muted-foreground">{row.client?.companyName ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_COLORS[inv.status] ?? "bg-muted text-muted-foreground"}`}>
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-medium">{inv.currency} {parseFloat(inv.total ?? "0").toLocaleString()}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{inv.issuedDate ?? "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">{inv.dueDate ?? "—"}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {inv.status === "draft" && (
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: inv.id, status: "sent" })}>
                              <Send className="h-3.5 w-3.5 mr-2" />Mark as Sent
                            </DropdownMenuItem>
                          )}
                          {["sent", "overdue"].includes(inv.status) && (
                            <DropdownMenuItem onClick={() => updateStatusMutation.mutate({ id: inv.id, status: "paid", paidDate: new Date().toISOString().slice(0, 10) })}>
                              <CheckCircle className="h-3.5 w-3.5 mr-2" />Mark as Paid
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => deleteMutation.mutate({ id: inv.id })} className="text-destructive focus:text-destructive">
                            <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                          </DropdownMenuItem>
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>New Invoice</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 max-h-[60vh] overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Invoice Number *</Label>
                <Input value={form.invoiceNumber} onChange={(e) => setForm(f => ({ ...f, invoiceNumber: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Client *</Label>
              <Select value={form.clientId} onValueChange={(v) => setForm(f => ({ ...f, clientId: v }))}>
                <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c: any) => <SelectItem key={c.id} value={c.id.toString()}>{c.companyName}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Campaign (optional)</Label>
              <Select value={form.campaignId} onValueChange={(v) => setForm(f => ({ ...f, campaignId: v === "__none__" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {campaigns.map((r: any) => <SelectItem key={r.campaign.id} value={r.campaign.id.toString()}>{r.campaign.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Subtotal *</Label>
                <Input type="number" value={form.subtotal} onChange={(e) => setForm(f => ({ ...f, subtotal: e.target.value }))} placeholder="5000" />
              </div>
              <div className="space-y-1.5">
                <Label>Tax Rate (%)</Label>
                <Input type="number" value={form.taxRate} onChange={(e) => setForm(f => ({ ...f, taxRate: e.target.value }))} placeholder="0" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Issued Date</Label>
                <Input type="date" value={form.issuedDate} onChange={(e) => setForm(f => ({ ...f, issuedDate: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label>Due Date</Label>
                <Input type="date" value={form.dueDate} onChange={(e) => setForm(f => ({ ...f, dueDate: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder="Payment terms, bank details..." />
            </div>
            {form.subtotal && (
              <div className="rounded-lg bg-muted/30 p-3 text-sm space-y-1">
                <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{form.currency} {parseFloat(form.subtotal || "0").toLocaleString()}</span></div>
                <div className="flex justify-between text-muted-foreground"><span>Tax ({form.taxRate}%)</span><span>{form.currency} {((parseFloat(form.subtotal || "0") * parseFloat(form.taxRate || "0")) / 100).toLocaleString()}</span></div>
                <div className="flex justify-between font-semibold border-t pt-1 mt-1"><span>Total</span><span>{form.currency} {(parseFloat(form.subtotal || "0") * (1 + parseFloat(form.taxRate || "0") / 100)).toLocaleString()}</span></div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.clientId || !form.invoiceNumber || !form.subtotal || createMutation.isPending}>
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
