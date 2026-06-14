import { trpc } from "@/lib/trpc";
import { BarChart2, Eye, ThumbsUp, MessageCircle, Share2, Link2 } from "lucide-react";

function fmtNum(n: number | null | undefined) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function ResultsPage() {
  const { data: results = [], isLoading } = trpc.talentResults.listAll.useQuery();

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Talent Results</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{results.length} result report{results.length !== 1 ? "s" : ""}</p>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : results.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <BarChart2 className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">No talent results yet.</p>
          <p className="text-sm text-muted-foreground mt-1">Results are linked to campaign deliverables. Add deliverables to campaigns first.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {results.map((r: any) => (
            <div key={r.id} className="rounded-xl border bg-card p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="font-semibold">{r.deliverable?.talentName ?? `Deliverable #${r.deliverableId}`}</p>
                  <p className="text-xs text-muted-foreground">{r.deliverable?.contentType?.replace(/_/g, " ")} · {r.reportingWindowDays}d window</p>
                </div>
                {r.lockedAt && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-500/15 text-emerald-600">Final</span>
                )}
              </div>
              <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
                {[
                  { icon: Eye, label: "Views", value: r.views },
                  { icon: ThumbsUp, label: "Likes", value: r.likes },
                  { icon: MessageCircle, label: "Comments", value: r.comments },
                  { icon: Share2, label: "Shares", value: r.shares },
                  { icon: Link2, label: "Clicks", value: r.linkClicks },
                  { icon: BarChart2, label: "Eng. Rate", value: r.engagementRate ? `${parseFloat(r.engagementRate).toFixed(2)}%` : "—" },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="rounded-lg bg-muted/30 p-3 text-center">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-1" />
                    <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                    <p className="text-sm font-semibold">{typeof value === "string" ? value : fmtNum(value as number)}</p>
                  </div>
                ))}
              </div>
              {r.notes && <p className="text-xs text-muted-foreground mt-3">{r.notes}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
