import { trpc } from "@/lib/trpc";
import { ExportExcelDialog } from "@/components/ExportExcelDialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { InfluencerBadge, PlatformBadge } from "@/components/Badges";
import { Plus, Trash2, RefreshCw, Key, Bell, Users, Activity, Download, CheckCircle2, Youtube, Twitter, Instagram, CheckCircle, XCircle, Loader2, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const PLATFORMS = ["YouTube", "Instagram", "TikTok"] as const;
const METRICS = ["view_count", "view_growth_rate", "engagement_rate", "likes", "comments", "shares"] as const;
const OPERATORS = ["gt", "gte", "lt", "lte"] as const;
const ALERT_TYPES = ["viral", "underperforming", "custom"] as const;

// ─── Credentials Section ──────────────────────────────────────────────────────
function CredentialsSection() {
  const utils = trpc.useUtils();
  const { data: creds, isLoading } = trpc.admin.listCredentials.useQuery();
  const [form, setForm] = useState({ platform: "YouTube" as typeof PLATFORMS[number], label: "", credentialKey: "", credentialValue: "" });
  const [open, setOpen] = useState(false);

  const upsert = trpc.admin.upsertCredential.useMutation({
    onSuccess: () => { toast.success("Credential saved"); setOpen(false); utils.admin.listCredentials.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const del = trpc.admin.deleteCredential.useMutation({
    onSuccess: () => { toast.success("Credential removed"); utils.admin.listCredentials.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">API Credentials</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Manage platform API keys for automated data pulls</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> Add Credential</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Add API Credential</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={form.platform} onValueChange={(v) => setForm((f) => ({ ...f, platform: v as typeof PLATFORMS[number] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Label</Label>
                <Input placeholder="e.g. YouTube Data API Key" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Credential Key</Label>
                <Select value={form.credentialKey} onValueChange={(v) => setForm((f) => ({ ...f, credentialKey: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select key type..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="instagram_access_token">instagram_access_token</SelectItem>
                    <SelectItem value="tiktok_access_token">tiktok_access_token</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Credential Value</Label>
                <Input type="password" placeholder="Paste your API key or token..." value={form.credentialValue} onChange={(e) => setForm((f) => ({ ...f, credentialValue: e.target.value }))} />
              </div>
              <Button className="w-full" disabled={upsert.isPending || !form.label || !form.credentialKey || !form.credentialValue} onClick={() => upsert.mutate(form)}>
                {upsert.isPending ? "Saving..." : "Save Credential"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* YouTube keyless notice */}
      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 text-xs text-green-400 flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>YouTube tracking requires no API key.</strong> Views, likes, and comments are fetched automatically via YouTube's internal InnerTube API — just paste a video URL and the system handles the rest.
        </div>
      </div>
      <div className="bg-amber-500/5 border border-amber-500/20 rounded-lg p-3 text-xs text-amber-400">
        <strong>Instagram &amp; TikTok credentials required</strong> for automated daily syncs on those platforms. Credentials are stored encrypted in the database.
      </div>

      {isLoading ? <Skeleton className="h-24 w-full" /> : (creds?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No credentials configured.</p>
      ) : (
        <div className="space-y-2">
          {creds?.map((cred) => (
            <div key={cred.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/10">
              <div className="flex items-center gap-3">
                <Key className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{cred.label}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <PlatformBadge platform={cred.platform as "YouTube" | "Instagram" | "TikTok"} />
                    <code className="text-xs text-muted-foreground">{cred.credentialKey}</code>
                  </div>
                </div>
              </div>
              <button onClick={() => del.mutate({ id: cred.id })} className="text-muted-foreground hover:text-destructive transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Influencer Accounts Section ──────────────────────────────────────────────
function InfluencerAccountsSection() {
  const utils = trpc.useUtils();
  const { data: influencers, isLoading } = trpc.influencers.list.useQuery();
  const [selectedInfluencer, setSelectedInfluencer] = useState<number | null>(null);
  const [accountForm, setAccountForm] = useState({
    platform: "YouTube" as typeof PLATFORMS[number],
    channelId: "",
    username: "",
    channelUrl: "",
  });
  const [accountOpen, setAccountOpen] = useState(false);

  const upsertAccount = trpc.influencers.upsertPlatformAccount.useMutation({
    onSuccess: () => { toast.success("Platform account saved"); setAccountOpen(false); utils.influencers.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const { data: accounts } = trpc.influencers.getPlatformAccounts.useQuery(
    { influencerId: selectedInfluencer! },
    { enabled: selectedInfluencer !== null }
  );

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Influencer Platform Accounts</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Configure channel IDs and usernames for each influencer per platform</p>
      </div>

      {isLoading ? <Skeleton className="h-24 w-full" /> : (
        <div className="space-y-3">
          {(influencers ?? []).map((inf) => (
            <Card key={inf.id} className="border-border/50 bg-card/80">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <InfluencerBadge name={inf.name} />
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 text-xs"
                    onClick={() => { setSelectedInfluencer(inf.id); setAccountOpen(true); }}
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Account
                  </Button>
                </div>
                <div className="space-y-2">
                  {inf.id === selectedInfluencer && accounts?.map((acc) => (
                    <div key={acc.id} className="flex items-center gap-3 text-xs p-2 rounded bg-muted/20">
                      <PlatformBadge platform={acc.platform as "YouTube" | "Instagram" | "TikTok"} />
                      <span className="text-muted-foreground">{acc.channelId ?? acc.username ?? "—"}</span>
                      <span className="text-muted-foreground ml-auto">{acc.isActive ? "Active" : "Inactive"}</span>
                    </div>
                  ))}
                  {inf.id !== selectedInfluencer && (
                    <button
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                      onClick={() => setSelectedInfluencer(inf.id)}
                    >
                      Click to view accounts →
                    </button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={accountOpen} onOpenChange={setAccountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add Platform Account</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Platform</Label>
              <Select value={accountForm.platform} onValueChange={(v) => setAccountForm((f) => ({ ...f, platform: v as typeof PLATFORMS[number] }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Channel ID (YouTube) / User ID (Instagram)</Label>
              <Input placeholder="e.g. UCxxxxxx" value={accountForm.channelId} onChange={(e) => setAccountForm((f) => ({ ...f, channelId: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Username (TikTok)</Label>
              <Input placeholder="@username" value={accountForm.username} onChange={(e) => setAccountForm((f) => ({ ...f, username: e.target.value }))} />
            </div>
            <div className="space-y-2">
              <Label>Channel URL (optional)</Label>
              <Input placeholder="https://..." value={accountForm.channelUrl} onChange={(e) => setAccountForm((f) => ({ ...f, channelUrl: e.target.value }))} />
            </div>
            <Button
              className="w-full"
              disabled={upsertAccount.isPending || !selectedInfluencer}
              onClick={() => upsertAccount.mutate({ influencerId: selectedInfluencer!, ...accountForm })}
            >
              {upsertAccount.isPending ? "Saving..." : "Save Account"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Alert Thresholds Section ─────────────────────────────────────────────────
function AlertThresholdsSection() {
  const utils = trpc.useUtils();
  const { data: thresholds, isLoading } = trpc.admin.listThresholds.useQuery();
  const { data: channelList } = trpc.channels.list.useQuery();
  const channelNames = Array.from(new Set((channelList ?? []).map((c: any) => c.channelName))).sort() as string[];
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    metric: "view_growth_rate" as typeof METRICS[number],
    operator: "gt" as typeof OPERATORS[number],
    thresholdValue: 100,
    alertType: "viral" as typeof ALERT_TYPES[number],
    influencerName: "",
    platform: "" as typeof PLATFORMS[number] | "",
  });

  const create = trpc.admin.createThreshold.useMutation({
    onSuccess: () => { toast.success("Alert threshold created"); setOpen(false); utils.admin.listThresholds.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const toggle = trpc.admin.updateThreshold.useMutation({
    onSuccess: () => utils.admin.listThresholds.invalidate(),
  });
  const del = trpc.admin.deleteThreshold.useMutation({
    onSuccess: () => { toast.success("Threshold deleted"); utils.admin.listThresholds.invalidate(); },
  });

  const OPERATOR_LABELS: Record<string, string> = { gt: ">", gte: "≥", lt: "<", lte: "≤" };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">Alert Thresholds</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Define conditions that trigger viral or underperforming alerts</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="gap-2"><Plus className="h-4 w-4" /> New Threshold</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Alert Threshold</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input placeholder="e.g. Viral Detection" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Metric</Label>
                  <Select value={form.metric} onValueChange={(v) => setForm((f) => ({ ...f, metric: v as typeof METRICS[number] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{METRICS.map((m) => <SelectItem key={m} value={m}>{m.replace(/_/g, " ")}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Alert Type</Label>
                  <Select value={form.alertType} onValueChange={(v) => setForm((f) => ({ ...f, alertType: v as typeof ALERT_TYPES[number] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{ALERT_TYPES.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Operator</Label>
                  <Select value={form.operator} onValueChange={(v) => setForm((f) => ({ ...f, operator: v as typeof OPERATORS[number] }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{OPERATORS.map((o) => <SelectItem key={o} value={o}>{OPERATOR_LABELS[o]} ({o})</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Threshold Value</Label>
                  <Input type="number" value={form.thresholdValue} onChange={(e) => setForm((f) => ({ ...f, thresholdValue: Number(e.target.value) }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Influencer (optional)</Label>
                  <Select value={form.influencerName || "all"} onValueChange={(v) => setForm((f) => ({ ...f, influencerName: v === "all" ? "" : v }))}>
                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {channelNames.map((n) => <SelectItem key={n} value={n}>{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Platform (optional)</Label>
                  <Select value={form.platform || "all"} onValueChange={(v) => setForm((f) => ({ ...f, platform: v === "all" ? "" : v as typeof PLATFORMS[number] }))}>
                    <SelectTrigger><SelectValue placeholder="All" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {PLATFORMS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                className="w-full"
                disabled={create.isPending || !form.name}
                onClick={() => create.mutate({ ...form, platform: form.platform || undefined, influencerName: form.influencerName || undefined })}
              >
                {create.isPending ? "Creating..." : "Create Threshold"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? <Skeleton className="h-24 w-full" /> : (thresholds?.length ?? 0) === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">No thresholds configured.</p>
      ) : (
        <div className="space-y-2">
          {thresholds?.map((t) => (
            <div key={t.id} className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-muted/10">
              <div className="flex items-center gap-3 min-w-0">
                <Bell className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{t.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {t.metric.replace(/_/g, " ")} {OPERATOR_LABELS[t.operator]} {t.thresholdValue}
                    {t.influencerName ? ` · ${t.influencerName}` : ""}
                    {t.platform ? ` · ${t.platform}` : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <Switch
                  checked={t.isActive ?? true}
                  onCheckedChange={(checked) => toggle.mutate({ id: t.id, isActive: checked })}
                />
                <button onClick={() => del.mutate({ id: t.id })} className="text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sync Controls Section ────────────────────────────────────────────────────
function SyncControlsSection() {
  const utils = trpc.useUtils();
  const { data: syncLogs, isLoading } = trpc.admin.recentSyncLogs.useQuery();

  const syncNow = trpc.admin.syncNow.useMutation({
    onSuccess: (data) => {
      toast.success(`Sync complete: ${data.snapshot.appended} new rows, ${data.alerts} alerts fired`);
      utils.admin.recentSyncLogs.invalidate();
    },
    onError: (e) => toast.error(`Sync failed: ${e.message}`),
  });

  const syncVideos = trpc.admin.syncVideosOnly.useMutation({
    onSuccess: (data) => { toast.success(`Video discovery: ${data.processed} processed`); utils.admin.recentSyncLogs.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  const syncCounts = trpc.admin.syncViewCountsOnly.useMutation({
    onSuccess: (data) => { toast.success(`View counts: ${data.appended} appended, ${data.skipped} skipped`); utils.admin.recentSyncLogs.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Manual Sync Controls</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Trigger data pulls manually in addition to the daily scheduled sync</p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Button
          className="gap-2"
          disabled={syncNow.isPending}
          onClick={() => syncNow.mutate()}
        >
          <RefreshCw className={`h-4 w-4 ${syncNow.isPending ? "animate-spin" : ""}`} />
          {syncNow.isPending ? "Syncing..." : "Full Sync Now"}
        </Button>
        <Button variant="outline" className="gap-2" disabled={syncVideos.isPending} onClick={() => syncVideos.mutate()}>
          <Activity className="h-4 w-4" />
          Discover Videos
        </Button>
        <Button variant="outline" className="gap-2" disabled={syncCounts.isPending} onClick={() => syncCounts.mutate()}>
          <Activity className="h-4 w-4" />
          Snapshot View Counts
        </Button>
      </div>

      <div>
        <h4 className="text-sm font-medium mb-2">Recent Sync Logs</h4>
        {isLoading ? <Skeleton className="h-32 w-full" /> : (syncLogs?.length ?? 0) === 0 ? (
          <p className="text-sm text-muted-foreground">No sync history yet.</p>
        ) : (
          <div className="space-y-1.5 max-h-64 overflow-y-auto">
            {syncLogs?.map((log) => (
              <div key={log.id} className="flex items-center gap-3 text-xs p-2.5 rounded-lg border border-border/30 bg-muted/10">
                <span className={`w-2 h-2 rounded-full shrink-0 ${
                  log.status === "success" ? "bg-emerald-400" :
                  log.status === "failed" ? "bg-red-400" : "bg-amber-400"
                }`} />
                <span className="text-muted-foreground">{log.jobType.replace(/_/g, " ")}</span>
                {log.platform && <PlatformBadge platform={log.platform as "YouTube" | "Instagram" | "TikTok"} />}
                <span className="text-muted-foreground ml-auto">{log.recordsProcessed ?? 0} records</span>
                <span className="text-muted-foreground">{new Date(log.startedAt).toLocaleString()}</span>
                {log.errorMessage && <span className="text-red-400 truncate max-w-[200px]">{log.errorMessage}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Excel Export Section ─────────────────────────────────────────────────────
function ExcelExportSection() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Excel Export</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Download a fully formatted Excel workbook with colour-coded tables, visual bar charts,
          and per-channel breakdowns. Includes Summary, Top Videos, All Videos, View Counts,
          Sponsorships, Channels, and Daily Reports sheets.
        </p>
      </div>
      <div className="bg-muted/20 border border-border/50 rounded-lg p-4 space-y-3">
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="font-medium">Sheets included</p>
            <p className="text-xs text-muted-foreground mt-0.5">Summary · Top Videos · All Videos · View Counts · Sponsorships · Channels · Daily Reports</p>
          </div>
          <div>
            <p className="font-medium">Visual features</p>
            <p className="text-xs text-muted-foreground mt-0.5">Heat-map colours · Unicode bar charts · Channel accent colours · Gold ★ BEST rows</p>
          </div>
          <div>
            <p className="font-medium">Date range filter</p>
            <p className="text-xs text-muted-foreground mt-0.5">Last 7d / 14d / 30d / 90d or custom calendar range</p>
          </div>
        </div>
        <ExportExcelDialog
          trigger={
            <Button className="gap-2">
              <Download className="h-4 w-4" />
              Download .xlsx
            </Button>
          }
        />
      </div>
    </div>
  );
}

// ─── API Keys Section ────────────────────────────────────────────────────────
const API_KEY_CONFIGS = [
  {
    service: "youtube" as const,
    label: "YouTube Data API v3",
    description: "Enables per-video like counts and comment counts. Free quota: 10,000 units/day.",
    placeholder: "AIza...",
    helpUrl: "https://console.cloud.google.com/apis/library/youtube.googleapis.com",
    helpText: "Get key at Google Cloud Console",
    icon: Youtube,
    iconColor: "text-red-400",
  },
  {
    service: "instagram" as const,
    label: "Instagram Graph API",
    description: "Enables Instagram follower counts, post reach, and engagement data.",
    placeholder: "IGQV...",
    helpUrl: "https://developers.facebook.com/docs/instagram-api",
    helpText: "Get token at Facebook Developer Portal",
    icon: Instagram,
    iconColor: "text-pink-400",
  },
  {
    service: "twitter" as const,
    label: "Twitter / X API v2",
    description: "Enables X follower counts, tweet impressions, and engagement data.",
    placeholder: "AAAA...",
    helpUrl: "https://developer.x.com/en/portal/dashboard",
    helpText: "Get Bearer Token at X Developer Portal",
    icon: Twitter,
    iconColor: "text-sky-400",
  },
] as const;

function ApiKeyCard({ config, status, onRefresh }: {
  config: typeof API_KEY_CONFIGS[number];
  status?: { configured: boolean; source: string };
  onRefresh: () => void;
}) {
  const [value, setValue] = useState("");
  const [showValue, setShowValue] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  const save = trpc.admin.saveApiKey.useMutation({
    onSuccess: () => { toast.success(`${config.label} key saved`); setValue(""); setTestResult(null); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  const remove = trpc.admin.removeApiKey.useMutation({
    onSuccess: () => { toast.success(`${config.label} key removed`); setTestResult(null); onRefresh(); },
    onError: (e) => toast.error(e.message),
  });
  const test = trpc.admin.testApiKey.useMutation({
    onSuccess: (data) => setTestResult(data),
    onError: (e) => setTestResult({ success: false, message: e.message }),
  });

  const Icon = config.icon;
  const isConfigured = status?.configured ?? false;

  return (
    <div className="border border-border/50 rounded-xl bg-card/60 p-5 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg bg-muted/20 ${config.iconColor}`}>
            <Icon className="h-5 w-5" />
          </div>
          <div>
            <p className="font-semibold text-sm">{config.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{config.description}</p>
          </div>
        </div>
        <div className="shrink-0">
          {isConfigured ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2.5 py-1">
              <CheckCircle className="h-3 w-3" /> Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground bg-muted/20 border border-border/40 rounded-full px-2.5 py-1">
              <XCircle className="h-3 w-3" /> Not configured
            </span>
          )}
        </div>
      </div>

      {/* Input row */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Input
            type={showValue ? "text" : "password"}
            placeholder={isConfigured ? "Enter new key to replace..." : config.placeholder}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="pr-9 font-mono text-xs"
          />
          <button
            type="button"
            onClick={() => setShowValue((v) => !v)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showValue ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </button>
        </div>
        <Button
          size="sm"
          disabled={!value.trim() || save.isPending}
          onClick={() => save.mutate({ service: config.service, value: value.trim() })}
        >
          {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}
        </Button>
      </div>

      {/* Actions row */}
      <div className="flex items-center gap-2">
        {isConfigured && (
          <>
            <Button
              size="sm" variant="outline"
              disabled={test.isPending}
              onClick={() => test.mutate({ service: config.service })}
              className="text-xs gap-1.5"
            >
              {test.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Test Connection
            </Button>
            <Button
              size="sm" variant="outline"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ service: config.service })}
              className="text-xs gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/5"
            >
              {remove.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
              Remove
            </Button>
          </>
        )}
        <a
          href={config.helpUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 ml-auto"
        >
          {config.helpText} ↗
        </a>
      </div>

      {/* Test result */}
      {testResult && (
        <div className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${
          testResult.success
            ? "bg-green-500/10 border border-green-500/20 text-green-400"
            : "bg-red-500/10 border border-red-500/20 text-red-400"
        }`}>
          {testResult.success ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <XCircle className="h-3.5 w-3.5 shrink-0" />}
          {testResult.message}
        </div>
      )}

      {/* Source badge */}
      {isConfigured && status?.source === "env" && (
        <p className="text-xs text-muted-foreground">
          <span className="font-mono bg-muted/30 px-1.5 py-0.5 rounded text-[10px]">ENV</span> Key is set via environment variable — remove from env to manage here.
        </p>
      )}
    </div>
  );
}

function ApiKeysSection() {
  const { data: status, refetch } = trpc.admin.getApiKeyStatus.useQuery();
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-semibold">Platform API Keys</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Optional API keys to unlock additional data. YouTube views and duration work without any key.
        </p>
      </div>
      <div className="bg-green-500/5 border border-green-500/20 rounded-lg p-3 text-xs text-green-400 flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
        <div>
          <strong>YouTube views, duration &amp; subscriber count require no API key.</strong> They are fetched automatically via YouTube's channel listing. Likes and comments are hidden by YouTube's policy since November 2021 — a YouTube Data API v3 key unlocks them.
        </div>
      </div>
      <div className="space-y-3">
        {API_KEY_CONFIGS.map((cfg) => (
          <ApiKeyCard
            key={cfg.service}
            config={cfg}
            status={status?.[cfg.service]}
            onRefresh={() => refetch()}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Main Admin Panel ─────────────────────────────────────────────────────────
export default function AdminPanel() {
  return (
    <div className="space-y-6 p-2">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground text-sm mt-1">Manage credentials, alert thresholds, sync controls, and exports</p>
      </div>

      <Tabs defaultValue="apikeys">
        <TabsList className="grid grid-cols-5 w-full max-w-2xl">
          <TabsTrigger value="apikeys" className="gap-1.5 text-xs"><Key className="h-3.5 w-3.5" /> API Keys</TabsTrigger>
          <TabsTrigger value="credentials" className="gap-1.5 text-xs"><Key className="h-3.5 w-3.5" /> Credentials</TabsTrigger>
          <TabsTrigger value="accounts" className="gap-1.5 text-xs"><Users className="h-3.5 w-3.5" /> Accounts</TabsTrigger>
          <TabsTrigger value="alerts" className="gap-1.5 text-xs"><Bell className="h-3.5 w-3.5" /> Alerts</TabsTrigger>
          <TabsTrigger value="sync" className="gap-1.5 text-xs"><Activity className="h-3.5 w-3.5" /> Sync</TabsTrigger>
        </TabsList>

        <TabsContent value="apikeys" className="mt-6">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <ApiKeysSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="credentials" className="mt-6">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <CredentialsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="mt-6">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <InfluencerAccountsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alerts" className="mt-6">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <AlertThresholdsSection />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sync" className="mt-6 space-y-6">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <SyncControlsSection />
            </CardContent>
          </Card>
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-6">
              <ExcelExportSection />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
