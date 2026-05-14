import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  FileText, RefreshCw, Calendar, TrendingUp, Eye,
  AlertTriangle, BarChart2, Clock, ChevronRight, Zap,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatNumber } from "@/components/Badges";

function fmtDate(val: string | Date | null | undefined) {
  if (!val) return "—";
  return new Date(val).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtTime(val: string | Date | null | undefined) {
  if (!val) return "";
  return new Date(val).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function relativeTime(val: string | Date | null | undefined) {
  if (!val) return "";
  const diff = Date.now() - new Date(val).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function TypePill({ type }: { type: string }) {
  const isDaily = type === "daily";
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold tracking-wide ${
      isDaily ? "bg-sky-500/15 text-sky-400 border border-sky-500/30" : "bg-violet-500/15 text-violet-400 border border-violet-500/30"
    }`}>
      {isDaily ? <Clock className="h-3 w-3" /> : <Calendar className="h-3 w-3" />}
      {isDaily ? "Daily" : "Weekly"}
    </span>
  );
}

function StatChip({ icon, label, value, accent }: {
  icon: React.ReactNode; label: string; value: string | number; accent: string;
}) {
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${accent} min-w-0`}>
      <span className="shrink-0 opacity-70">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground leading-none mb-0.5">{label}</p>
        <p className="text-sm font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

function EmptyState({ onGenerate, isPending }: { onGenerate: () => void; isPending: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
        <FileText className="h-8 w-8" style={{ color: "oklch(0.78 0.15 80)" }} />
      </div>
      <h3 className="text-lg font-semibold mb-2">No reports yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm mb-6">
        Reports are generated automatically each day, or you can create one manually right now.
      </p>
      <Button onClick={onGenerate} disabled={isPending} className="gap-2"
        style={{ background: "oklch(0.78 0.15 80)", color: "#000" }}>
        <Zap className="h-4 w-4" />
        {isPending ? "Generating\u2026" : "Generate First Report"}
      </Button>
    </div>
  );
}

function ReportDetailDialog({ reportId, onClose }: { reportId: number | null; onClose: () => void }) {
  const { data: report, isLoading } = trpc.reports.getById.useQuery(
    { id: reportId! }, { enabled: reportId !== null }
  );
  return (
    <Dialog open={reportId !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/50 shrink-0">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-primary/10 shrink-0">
              <FileText className="h-5 w-5" style={{ color: "oklch(0.78 0.15 80)" }} />
            </div>
            <div className="min-w-0 flex-1">
              <DialogTitle className="text-base font-semibold leading-tight">
                {isLoading ? <Skeleton className="h-5 w-48" /> : report?.title}
              </DialogTitle>
              {report && (
                <p className="text-xs text-muted-foreground mt-1">
                  Period: {report.periodStart} \u2192 {report.periodEnd}
                  &nbsp;\u00b7&nbsp;Generated {fmtDate(report.createdAt)} at {fmtTime(report.createdAt)}
                </p>
              )}
            </div>
            {report && <TypePill type={report.type} />}
          </div>
        </DialogHeader>
        {report && (
          <div className="px-6 py-3 flex gap-3 flex-wrap border-b border-border/30 bg-muted/10 shrink-0">
            <StatChip
              icon={<Eye className="h-3.5 w-3.5 text-sky-400" />}
              label="Total Views" value={formatNumber(report.totalViews ?? 0)}
              accent="border-sky-500/20 bg-sky-500/5" />
            <StatChip
              icon={<TrendingUp className="h-3.5 w-3.5 text-emerald-400" />}
              label="Avg Engagement" value={`${Number(report.avgEngagementRate ?? 0).toFixed(2)}%`}
              accent="border-emerald-500/20 bg-emerald-500/5" />
            <StatChip
              icon={<AlertTriangle className="h-3.5 w-3.5 text-amber-400" />}
              label="Alerts Triggered" value={report.alertsTriggered ?? 0}
              accent="border-amber-500/20 bg-amber-500/5" />
          </div>
        )}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-4 w-full" />)}
            </div>
          ) : report ? (
            <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-7">
              {report.content}
            </pre>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ReportRow({ report, onClick }: { report: any; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full text-left group rounded-xl border border-border/40 bg-card/60
                 hover:border-primary/40 hover:bg-card/90 transition-all duration-150 p-4
                 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0
                        group-hover:bg-primary/20 transition-colors">
          <FileText className="h-5 w-5" style={{ color: "oklch(0.78 0.15 80)" }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <span className="font-semibold text-sm truncate">{report.title}</span>
            <TypePill type={report.type} />
          </div>
          <p className="text-xs text-muted-foreground">
            {report.periodStart} \u2192 {report.periodEnd}
          </p>
        </div>
        <div className="hidden md:flex items-center gap-6 shrink-0">
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end">
              <Eye className="h-3 w-3 text-sky-400" />
              <span className="font-medium text-foreground">{formatNumber(report.totalViews ?? 0)}</span>
              <span>views</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end mt-1">
              <TrendingUp className="h-3 w-3 text-emerald-400" />
              <span className="font-medium text-foreground">
                {Number(report.avgEngagementRate ?? 0).toFixed(2)}%
              </span>
              <span>eng</span>
            </div>
          </div>
          <div className="text-right">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground justify-end">
              <AlertTriangle className="h-3 w-3 text-amber-400" />
              <span className="font-medium text-foreground">{report.alertsTriggered ?? 0}</span>
              <span>alerts</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{relativeTime(report.createdAt)}</p>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
      </div>
    </button>
  );
}

function SummaryBar({ reports }: { reports: any[] }) {
  const totalViews  = reports.reduce((s, r) => s + Number(r.totalViews ?? 0), 0);
  const totalAlerts = reports.reduce((s, r) => s + Number(r.alertsTriggered ?? 0), 0);
  const dailyCount  = reports.filter((r) => r.type === "daily").length;
  const weeklyCount = reports.filter((r) => r.type === "weekly").length;
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
      {[
        { icon: <FileText className="h-4 w-4" />, label: "Total Reports",  value: reports.length,           color: "text-primary" },
        { icon: <Eye className="h-4 w-4" />,      label: "Views Tracked",  value: formatNumber(totalViews), color: "text-sky-400" },
        { icon: <AlertTriangle className="h-4 w-4" />, label: "Alerts Fired", value: totalAlerts,           color: "text-amber-400" },
        { icon: <BarChart2 className="h-4 w-4" />, label: "Daily / Weekly",
          value: `${dailyCount} / ${weeklyCount}`, color: "text-violet-400" },
      ].map(({ icon, label, value, color }) => (
        <div key={label} className="rounded-xl border border-border/40 bg-card/60 p-4">
          <div className={`mb-2 ${color}`}>{icon}</div>
          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
          <p className="text-xl font-bold">{value}</p>
        </div>
      ))}
    </div>
  );
}

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  const utils = trpc.useUtils();
  const { data: reports, isLoading } = trpc.reports.list.useQuery();

  const generateDaily = trpc.reports.generateDaily.useMutation({
    onSuccess: () => { toast.success("Daily report generated"); utils.reports.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });
  const generateWeekly = trpc.reports.generateWeekly.useMutation({
    onSuccess: () => { toast.success("Weekly report generated"); utils.reports.list.invalidate(); },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-0 p-2">
      {/* Page header */}
      <div className="flex items-start justify-between flex-wrap gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automated daily and weekly performance summaries
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm"
            className="gap-2 border-sky-500/30 text-sky-400 hover:bg-sky-500/10"
            disabled={generateDaily.isPending} onClick={() => generateDaily.mutate()}>
            <RefreshCw className={`h-4 w-4 ${generateDaily.isPending ? "animate-spin" : ""}`} />
            {generateDaily.isPending ? "Generating\u2026" : "Daily Report"}
          </Button>
          <Button variant="outline" size="sm"
            className="gap-2 border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
            disabled={generateWeekly.isPending} onClick={() => generateWeekly.mutate()}>
            <Calendar className={`h-4 w-4 ${generateWeekly.isPending ? "animate-spin" : ""}`} />
            {generateWeekly.isPending ? "Generating\u2026" : "Weekly Report"}
          </Button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="rounded-xl border border-border/40 p-4">
              <div className="flex items-center gap-4">
                <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-8 w-24 hidden md:block" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty */}
      {!isLoading && (!reports || reports.length === 0) && (
        <EmptyState onGenerate={() => generateDaily.mutate()} isPending={generateDaily.isPending} />
      )}

      {/* List */}
      {!isLoading && reports && reports.length > 0 && (
        <>
          <SummaryBar reports={reports} />
          {(["daily", "weekly"] as const).map((type) => {
            const group = reports.filter((r) => r.type === type);
            if (group.length === 0) return null;
            return (
              <div key={type} className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  {type === "daily"
                    ? <Clock className="h-4 w-4 text-sky-400" />
                    : <Calendar className="h-4 w-4 text-violet-400" />}
                  <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    {type === "daily" ? "Daily Reports" : "Weekly Reports"}
                  </h2>
                  <Badge variant="secondary" className="text-xs px-1.5 py-0">{group.length}</Badge>
                </div>
                <div className="space-y-2">
                  {group.map((report) => (
                    <ReportRow key={report.id} report={report} onClick={() => setSelectedReport(report.id)} />
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}

      <ReportDetailDialog reportId={selectedReport} onClose={() => setSelectedReport(null)} />
    </div>
  );
}
