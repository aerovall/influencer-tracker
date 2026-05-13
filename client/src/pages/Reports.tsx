import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText, RefreshCw, Calendar, TrendingUp, Eye, AlertTriangle } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { formatNumber } from "@/components/Badges";

function ReportTypeBadge({ type }: { type: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${
      type === "daily"
        ? "bg-sky-500/15 text-sky-400 border border-sky-500/25"
        : "bg-violet-500/15 text-violet-400 border border-violet-500/25"
    }`}>
      {type === "daily" ? "Daily" : "Weekly"}
    </span>
  );
}

export default function Reports() {
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  const utils = trpc.useUtils();

  const { data: reports, isLoading } = trpc.reports.list.useQuery();
  const { data: reportDetail } = trpc.reports.getById.useQuery(
    { id: selectedReport! },
    { enabled: selectedReport !== null }
  );

  const generateDaily = trpc.reports.generateDaily.useMutation({
    onSuccess: () => {
      toast.success("Daily report generated");
      utils.reports.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  const generateWeekly = trpc.reports.generateWeekly.useMutation({
    onSuccess: () => {
      toast.success("Weekly report generated");
      utils.reports.list.invalidate();
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 p-2">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Automated daily and weekly performance summaries
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={generateDaily.isPending}
            onClick={() => generateDaily.mutate()}
          >
            <RefreshCw className={`h-4 w-4 ${generateDaily.isPending ? "animate-spin" : ""}`} />
            Generate Daily
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            disabled={generateWeekly.isPending}
            onClick={() => generateWeekly.mutate()}
          >
            <Calendar className="h-4 w-4" />
            Generate Weekly
          </Button>
        </div>
      </div>

      {/* Reports List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
        </div>
      ) : (reports?.length ?? 0) === 0 ? (
        <Card className="border-border/50 bg-card/80">
          <CardContent className="py-16 text-center">
            <FileText className="h-10 w-10 text-muted-foreground mx-auto mb-4 opacity-40" />
            <p className="text-muted-foreground text-sm">No reports generated yet.</p>
            <p className="text-xs text-muted-foreground mt-1">Reports are generated automatically daily, or you can generate one manually above.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {reports?.map((report) => (
            <Card
              key={report.id}
              className="border-border/50 bg-card/80 hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => setSelectedReport(report.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0 mt-0.5">
                      <FileText className="h-4 w-4" style={{ color: "oklch(0.78 0.15 80)" }} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-sm">{report.title}</h3>
                        <ReportTypeBadge type={report.type} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        Period: {report.periodStart} → {report.periodEnd}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 shrink-0 text-right">
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <Eye className="h-3.5 w-3.5" />
                        <span>{formatNumber(report.totalViews ?? 0)} views</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-1">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span>{Number(report.avgEngagementRate ?? 0).toFixed(2)}% eng</span>
                      </div>
                    </div>
                    <div className="hidden sm:block">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        <span>{report.alertsTriggered ?? 0} alerts</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {new Date(report.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" className="text-xs">
                      View
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Report Detail Dialog */}
      <Dialog open={selectedReport !== null} onOpenChange={(open) => !open && setSelectedReport(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" style={{ color: "oklch(0.78 0.15 80)" }} />
              {reportDetail?.title}
            </DialogTitle>
          </DialogHeader>
          {reportDetail ? (
            <div className="space-y-4">
              <div className="flex gap-4 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Eye className="h-4 w-4" />
                  <span>{formatNumber(reportDetail.totalViews ?? 0)} total views</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <TrendingUp className="h-4 w-4" />
                  <span>{Number(reportDetail.avgEngagementRate ?? 0).toFixed(2)}% avg engagement</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <AlertTriangle className="h-4 w-4 text-amber-400" />
                  <span>{reportDetail.alertsTriggered ?? 0} alerts triggered</span>
                </div>
              </div>
              <div className="bg-muted/20 rounded-lg p-4 border border-border/50">
                <pre className="text-sm text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                  {reportDetail.content}
                </pre>
              </div>
            </div>
          ) : (
            <Skeleton className="h-64 w-full" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
