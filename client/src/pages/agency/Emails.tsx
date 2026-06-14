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
import { Plus, MoreVertical, Mail, Pencil, Trash2, Send } from "lucide-react";

const LOG_STATUS_COLORS: Record<string, string> = {
  queued: "bg-muted text-muted-foreground",
  sent: "bg-emerald-500/15 text-emerald-600",
  failed: "bg-red-500/15 text-red-600",
  bounced: "bg-amber-500/15 text-amber-600",
};

const emptyTemplate = {
  name: "",
  type: "general",
  subject: "",
  bodyHtml: "",
};

const emptySend = {
  templateId: "",
  recipientEmail: "",
  recipientName: "",
  recipientType: "client",
  subject: "",
  bodyHtml: "",
};

export default function EmailsPage() {
  const utils = trpc.useUtils();
  const { data: templates = [], isLoading: loadingTemplates } = trpc.emails.listTemplates.useQuery();
  const { data: logs = [], isLoading: loadingLogs } = trpc.emails.listLogs.useQuery();

  const [tab, setTab] = useState<"templates" | "logs">("templates");
  const [templateDlgOpen, setTemplateDlgOpen] = useState(false);
  const [sendDlgOpen, setSendDlgOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<number | null>(null);
  const [templateForm, setTemplateForm] = useState(emptyTemplate);
  const [sendForm, setSendForm] = useState(emptySend);

  const createTemplate = trpc.emails.createTemplate.useMutation({
    onSuccess: () => { utils.emails.listTemplates.invalidate(); setTemplateDlgOpen(false); setTemplateForm(emptyTemplate); toast.success("Template created"); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateTemplate = trpc.emails.updateTemplate.useMutation({
    onSuccess: () => { utils.emails.listTemplates.invalidate(); setTemplateDlgOpen(false); toast.success("Template updated"); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteTemplate = trpc.emails.deleteTemplate.useMutation({
    onSuccess: () => { utils.emails.listTemplates.invalidate(); toast.success("Template deleted"); },
  });

  const logEmail = trpc.emails.sendEmail.useMutation({
    onSuccess: () => { utils.emails.listLogs.invalidate(); setSendDlgOpen(false); setSendForm(emptySend); toast.success("Email logged"); },
    onError: (e: any) => toast.error(e.message),
  });

  function openCreateTemplate() {
    setEditingTemplateId(null);
    setTemplateForm(emptyTemplate);
    setTemplateDlgOpen(true);
  }

  function openEditTemplate(t: any) {
    setEditingTemplateId(t.id);
    setTemplateForm({ name: t.name, type: t.type, subject: t.subject, bodyHtml: t.bodyHtml });
    setTemplateDlgOpen(true);
  }

  function handleTemplateSubmit() {
    if (!templateForm.name.trim() || !templateForm.subject.trim()) return;
    const payload = { name: templateForm.name, type: templateForm.type as any, subject: templateForm.subject, bodyHtml: templateForm.bodyHtml };
    if (editingTemplateId !== null) {
      updateTemplate.mutate({ id: editingTemplateId, ...payload });
    } else {
      createTemplate.mutate(payload);
    }
  }

  function openSendLog(t?: any) {
    setSendForm({
      templateId: t?.id?.toString() ?? "",
      recipientEmail: "",
      recipientName: "",
      recipientType: "client",
      subject: t?.subject ?? "",
      bodyHtml: t?.bodyHtml ?? "",
    });
    setSendDlgOpen(true);
  }

  function handleSendSubmit() {
    if (!sendForm.recipientEmail || !sendForm.subject) return;
    logEmail.mutate({
      templateId: sendForm.templateId ? parseInt(sendForm.templateId) : undefined,
      recipientEmail: sendForm.recipientEmail,
      recipientName: sendForm.recipientName || undefined,
      recipientType: sendForm.recipientType as any,
      subject: sendForm.subject,
      bodyHtml: sendForm.bodyHtml || "(no body)",
    });
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Emails</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{templates.length} template{templates.length !== 1 ? "s" : ""} · {logs.length} sent</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => openSendLog()} className="gap-2">
            <Send className="h-4 w-4" />
            Log Email
          </Button>
          <Button onClick={openCreateTemplate} className="gap-2">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1">
        {(["templates", "logs"] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors capitalize ${tab === t ? "bg-primary text-primary-foreground" : "bg-muted/50 text-muted-foreground hover:bg-muted"}`}>
            {t === "templates" ? `Templates (${templates.length})` : `Sent Log (${logs.length})`}
          </button>
        ))}
      </div>

      {tab === "templates" && (
        loadingTemplates ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />)}</div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Mail className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No email templates yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Template</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Type</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {templates.map((t: any, i: number) => (
                  <tr key={t.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-3 font-medium">{t.name}</td>
                    <td className="px-4 py-3 text-muted-foreground capitalize">{t.type.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{t.subject}</td>
                    <td className="px-4 py-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-7 w-7">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openSendLog(t)}><Send className="h-3.5 w-3.5 mr-2" />Use Template</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openEditTemplate(t)}><Pencil className="h-3.5 w-3.5 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => deleteTemplate.mutate({ id: t.id })} className="text-destructive focus:text-destructive"><Trash2 className="h-3.5 w-3.5 mr-2" />Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === "logs" && (
        loadingLogs ? (
          <div className="space-y-2">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />)}</div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Mail className="h-12 w-12 text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">No emails logged yet.</p>
          </div>
        ) : (
          <div className="rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Recipient</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Subject</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Date</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log: any, i: number) => (
                  <tr key={log.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                    <td className="px-4 py-3">
                      <p className="font-medium">{log.recipientName ?? log.recipientEmail}</p>
                      <p className="text-xs text-muted-foreground">{log.recipientEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground truncate max-w-xs">{log.subject}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${LOG_STATUS_COLORS[log.status] ?? "bg-muted text-muted-foreground"}`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground text-xs">
                      {new Date(log.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Template Dialog */}
      <Dialog open={templateDlgOpen} onOpenChange={setTemplateDlgOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingTemplateId !== null ? "Edit Template" : "New Email Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Template Name *</Label>
                <Input value={templateForm.name} onChange={(e) => setTemplateForm(f => ({ ...f, name: e.target.value }))} placeholder="Campaign Brief" />
              </div>
              <div className="space-y-1.5">
                <Label>Type</Label>
                <Select value={templateForm.type} onValueChange={(v) => setTemplateForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["brief", "invoice", "follow_up", "results", "general"].map(t => (
                      <SelectItem key={t} value={t} className="capitalize">{t.replace(/_/g, " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Input value={templateForm.subject} onChange={(e) => setTemplateForm(f => ({ ...f, subject: e.target.value }))} placeholder="Campaign Brief: {{campaign_name}}" />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea value={templateForm.bodyHtml} onChange={(e) => setTemplateForm(f => ({ ...f, bodyHtml: e.target.value }))} rows={6} placeholder="Hi {{talent_name}},&#10;&#10;Here is the brief for {{campaign_name}}..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTemplateDlgOpen(false)}>Cancel</Button>
            <Button onClick={handleTemplateSubmit} disabled={!templateForm.name.trim() || !templateForm.subject.trim() || createTemplate.isPending || updateTemplate.isPending}>
              {editingTemplateId !== null ? "Save Changes" : "Create Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Log Email Dialog */}
      <Dialog open={sendDlgOpen} onOpenChange={setSendDlgOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Email</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recipient Email *</Label>
                <Input value={sendForm.recipientEmail} onChange={(e) => setSendForm(f => ({ ...f, recipientEmail: e.target.value }))} placeholder="talent@example.com" />
              </div>
              <div className="space-y-1.5">
                <Label>Recipient Name</Label>
                <Input value={sendForm.recipientName} onChange={(e) => setSendForm(f => ({ ...f, recipientName: e.target.value }))} placeholder="Conor Kenny" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Recipient Type</Label>
                <Select value={sendForm.recipientType} onValueChange={(v) => setSendForm(f => ({ ...f, recipientType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["client", "talent", "internal"].map(t => <SelectItem key={t} value={t} className="capitalize">{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Template</Label>
                <Select value={sendForm.templateId} onValueChange={(v) => {
                  const t = templates.find((t: any) => t.id.toString() === v);
                  setSendForm(f => ({ ...f, templateId: v, subject: t?.subject ?? f.subject, bodyHtml: t?.bodyHtml ?? f.bodyHtml }));
                }}>
                  <SelectTrigger><SelectValue placeholder="None" /></SelectTrigger>
                  <SelectContent>
                    {templates.map((t: any) => <SelectItem key={t.id} value={t.id.toString()}>{t.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Subject *</Label>
              <Input value={sendForm.subject} onChange={(e) => setSendForm(f => ({ ...f, subject: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Body</Label>
              <Textarea value={sendForm.bodyHtml} onChange={(e) => setSendForm(f => ({ ...f, bodyHtml: e.target.value }))} rows={4} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSendDlgOpen(false)}>Cancel</Button>
            <Button onClick={handleSendSubmit} disabled={!sendForm.recipientEmail || !sendForm.subject || logEmail.isPending}>
              Log Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
