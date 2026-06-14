import { useState } from "react";
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
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { Plus, MoreVertical, Building2, Mail, User, Pencil, Archive, Trash2 } from "lucide-react";

type Client = {
  id: number;
  companyName: string;
  contactName: string | null;
  contactEmail: string | null;
  billingAddress: string | null;
  currency: string;
  notes: string | null;
  isActive: boolean;
  createdAt: Date;
};

const emptyForm = {
  companyName: "",
  contactName: "",
  contactEmail: "",
  billingAddress: "",
  currency: "USD",
  notes: "",
};

export default function ClientsPage() {
  const utils = trpc.useUtils();
  const { data: clients = [], isLoading } = trpc.clients.list.useQuery();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState(emptyForm);

  const createMutation = trpc.clients.create.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setDialogOpen(false);
      setForm(emptyForm);
      toast.success("Client created");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMutation = trpc.clients.update.useMutation({
    onSuccess: () => {
      utils.clients.list.invalidate();
      setDialogOpen(false);
      setEditingClient(null);
      toast.success("Client updated");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMutation = trpc.clients.delete.useMutation({
    onSuccess: () => { utils.clients.list.invalidate(); toast.success("Client deleted"); },
  });

  function openCreate() {
    setEditingClient(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(c: Client) {
    setEditingClient(c);
    setForm({
      companyName: c.companyName,
      contactName: c.contactName ?? "",
      contactEmail: c.contactEmail ?? "",
      billingAddress: c.billingAddress ?? "",
      currency: c.currency,
      notes: c.notes ?? "",
    });
    setDialogOpen(true);
  }

  function handleSubmit() {
    if (!form.companyName.trim()) return;
    if (editingClient) {
      updateMutation.mutate({ id: editingClient.id, ...form });
    } else {
      createMutation.mutate(form);
    }
  }

  const activeClients = clients.filter((c) => c.isActive);
  const archivedClients = clients.filter((c) => !c.isActive);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Clients</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {activeClients.length} active client{activeClients.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Client
        </Button>
      </div>

      {/* Client grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-36 rounded-xl bg-muted/40 animate-pulse" />
          ))}
        </div>
      ) : activeClients.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Building2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No clients yet. Add your first client to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeClients.map((c) => (
            <ClientCard key={c.id} client={c} onEdit={openEdit} onDelete={(id) => deleteMutation.mutate({ id })} onArchive={(id) => updateMutation.mutate({ id, isActive: false })} />
          ))}
        </div>
      )}

      {/* Archived */}
      {archivedClients.length > 0 && (
        <div>
          <h2 className="text-sm font-medium text-muted-foreground mb-3">Archived ({archivedClients.length})</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-60">
            {archivedClients.map((c) => (
              <ClientCard key={c.id} client={c} onEdit={openEdit} onDelete={(id) => deleteMutation.mutate({ id })} onArchive={(id) => updateMutation.mutate({ id, isActive: true })} archiveLabel="Restore" />
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingClient ? "Edit Client" : "New Client"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Company Name *</Label>
              <Input value={form.companyName} onChange={(e) => setForm(f => ({ ...f, companyName: e.target.value }))} placeholder="Acme Corp" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Contact Name</Label>
                <Input value={form.contactName} onChange={(e) => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="John Smith" />
              </div>
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Input value={form.currency} onChange={(e) => setForm(f => ({ ...f, currency: e.target.value }))} placeholder="USD" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Contact Email</Label>
              <Input type="email" value={form.contactEmail} onChange={(e) => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="john@acme.com" />
            </div>
            <div className="space-y-1.5">
              <Label>Billing Address</Label>
              <Textarea value={form.billingAddress} onChange={(e) => setForm(f => ({ ...f, billingAddress: e.target.value }))} placeholder="123 Main St, New York, NY 10001" rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes about this client..." rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={!form.companyName.trim() || createMutation.isPending || updateMutation.isPending}>
              {editingClient ? "Save Changes" : "Create Client"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClientCard({ client, onEdit, onDelete, onArchive, archiveLabel = "Archive" }: {
  client: Client;
  onEdit: (c: Client) => void;
  onDelete: (id: number) => void;
  onArchive: (id: number) => void;
  archiveLabel?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 space-y-3 hover:border-primary/30 transition-colors">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold truncate text-sm">{client.companyName}</p>
            <p className="text-xs text-muted-foreground">{client.currency}</p>
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
              <MoreVertical className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(client)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onArchive(client.id)}><Archive className="h-3.5 w-3.5 mr-2" />{archiveLabel}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onDelete(client.id)} className="text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {client.contactName && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <User className="h-3 w-3" />
          <span>{client.contactName}</span>
        </div>
      )}
      {client.contactEmail && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Mail className="h-3 w-3" />
          <span className="truncate">{client.contactEmail}</span>
        </div>
      )}
      {client.notes && (
        <p className="text-xs text-muted-foreground line-clamp-2 border-t pt-2">{client.notes}</p>
      )}
    </div>
  );
}
