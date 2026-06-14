import { useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Link } from "wouter";
import {
  Briefcase, FileText, Users, TrendingUp, DollarSign,
  ChevronRight, AlertCircle, CheckCircle2, Clock, Star,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtNum(n: number | null | undefined) {
  if (!n) return "0";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtCurrency(n: number, currency = "USD") {
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(1)}K`;
  return `${currency} ${n.toLocaleString()}`;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  active:    { bg: "bg-emerald-500/15", text: "text-emerald-500", icon: <CheckCircle2 className="h-3 w-3" /> },
  planning:  { bg: "bg-blue-500/15",    text: "text-blue-500",    icon: <Clock className="h-3 w-3" /> },
  completed: { bg: "bg-muted",          text: "text-muted-foreground", icon: <CheckCircle2 className="h-3 w-3" /> },
  paused:    { bg: "bg-amber-500/15",   text: "text-amber-500",   icon: <AlertCircle className="h-3 w-3" /> },
  cancelled: { bg: "bg-red-500/15",     text: "text-red-500",     icon: <AlertCircle className="h-3 w-3" /> },
};

const INV_STATUS_COLORS: Record<string, string> = {
  draft:     "bg-muted text-muted-foreground",
  sent:      "bg-blue-500/15 text-blue-500",
  paid:      "bg-emerald-500/15 text-emerald-500",
  overdue:   "bg-red-500/15 text-red-500",
  cancelled: "bg-muted text-muted-foreground",
};

// ─── Skeleton ────────────────────────────────────────────────────────────────

function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-muted/40 ${className}`} />;
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function AgencyDashboard() {
  const { data: campaigns = [], isLoading: loadingCampaigns } = trpc.campaigns.list.useQuery();
  const { data: invoices = [], isLoading: loadingInvoices } = trpc.invoices.list.useQuery();
  const { data: talents = [], isLoading: loadingTalents } = trpc.affiliate.talentStats.useQuery();

  // ── Derived stats ──────────────────────────────────────────────────────────
  const activeCampaigns = useMemo(
    () => campaigns.filter((r: any) => r.campaign.status === "active"),
    [campaigns]
  );

  const outstandingInvoices = useMemo(
    () => invoices.filter((r: any) => ["sent", "overdue"].includes(r.invoice.status)),
    [invoices]
  );

  const outstandingTotal = useMemo(
    () => outstandingInvoices.reduce((sum: number, r: any) => sum + parseFloat(r.invoice.total ?? "0"), 0),
    [outstandingInvoices]
  );

  const overdueInvoices = useMemo(
    () => invoices.filter((r: any) => r.invoice.status === "overdue"),
    [invoices]
  );

  const paidThisMonth = useMemo(() => {
    const now = new Date();
    const monthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    return invoices
      .filter((r: any) => r.invoice.status === "paid" && r.invoice.paidDate?.startsWith(monthStr))
      .reduce((sum: number, r: any) => sum + parseFloat(r.invoice.total ?? "0"), 0);
  }, [invoices]);

  const topTalents = useMemo(
    () => [...talents].sort((a: any, b: any) => b.totalViews - a.totalViews).slice(0, 5),
    [talents]
  );

  const totalCampaignBudget = useMemo(
    () => activeCampaigns.reduce((sum: number, r: any) => sum + parseFloat(r.campaign.budget ?? "0"), 0),
    [activeCampaigns]
  );

  const isLoading = loadingCampaigns || loadingInvoices || loadingTalents;

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* ── Header ── */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Agency Overview</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          {new Date().toLocaleDateString("en-GB", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
        </p>
      </div>

      {/* ── KPI Cards ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <KpiCard
              icon={<Briefcase className="h-5 w-5 text-emerald-500" />}
              label="Active Campaigns"
              value={activeCampaigns.length.toString()}
              sub={`${campaigns.length} total`}
              accent="emerald"
            />
            <KpiCard
              icon={<DollarSign className="h-5 w-5 text-amber-500" />}
              label="Outstanding"
              value={fmtCurrency(outstandingTotal)}
              sub={`${outstandingInvoices.length} invoice${outstandingInvoices.length !== 1 ? "s" : ""}`}
              accent={overdueInvoices.length > 0 ? "red" : "amber"}
            />
            <KpiCard
              icon={<CheckCircle2 className="h-5 w-5 text-blue-500" />}
              label="Collected This Month"
              value={fmtCurrency(paidThisMonth)}
              sub="Paid invoices"
              accent="blue"
            />
            <KpiCard
              icon={<Users className="h-5 w-5 text-violet-500" />}
              label="Active Talents"
              value={talents.length.toString()}
              sub={`${activeCampaigns.reduce((s: number, r: any) => s + (r.campaign.talentCount ?? 0), 0) || "—"} assigned`}
              accent="violet"
            />
          </>
        )}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Active Campaigns — 2/3 width */}
        <section className="lg:col-span-2 space-y-3">
          <SectionHeader title="Active Campaigns" href="/agency/campaigns" count={activeCampaigns.length} />
          {loadingCampaigns ? (
            <div className="space-y-2">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
          ) : activeCampaigns.length === 0 ? (
            <EmptyState icon={<Briefcase className="h-8 w-8" />} message="No active campaigns" action={{ label: "Create Campaign", href: "/agency/campaigns" }} />
          ) : (
            <div className="space-y-2">
              {activeCampaigns.slice(0, 6).map((row: any) => {
                const c = row.campaign;
                const statusStyle = STATUS_COLORS[c.status] ?? STATUS_COLORS.active;
                const budget = parseFloat(c.budget ?? "0");
                const daysLeft = c.endDate
                  ? Math.max(0, Math.ceil((new Date(c.endDate).getTime() - Date.now()) / 86400000))
                  : null;
                return (
                  <Link key={c.id} href={`/agency/campaigns/${c.id}`}>
                    <div className="flex items-center gap-4 rounded-xl border bg-card px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer group">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium ${statusStyle.bg} ${statusStyle.text}`}>
                            {statusStyle.icon}
                            {c.status}
                          </span>
                          <p className="font-medium text-sm truncate">{c.name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{row.client?.companyName ?? "No client"}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {budget > 0 && <p className="text-sm font-semibold">{fmtCurrency(budget)}</p>}
                        {daysLeft !== null && (
                          <p className={`text-xs ${daysLeft <= 7 ? "text-red-500" : "text-muted-foreground"}`}>
                            {daysLeft === 0 ? "Due today" : `${daysLeft}d left`}
                          </p>
                        )}
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors shrink-0" />
                    </div>
                  </Link>
                );
              })}
              {activeCampaigns.length > 6 && (
                <Link href="/agency/campaigns">
                  <p className="text-xs text-center text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer">
                    +{activeCampaigns.length - 6} more campaigns
                  </p>
                </Link>
              )}
            </div>
          )}
        </section>

        {/* Outstanding Invoices — 1/3 width */}
        <section className="space-y-3">
          <SectionHeader title="Outstanding Invoices" href="/agency/invoices" count={outstandingInvoices.length} />
          {loadingInvoices ? (
            <div className="space-y-2">{[...Array(4)].map((_, i) => <Skeleton key={i} className="h-16" />)}</div>
          ) : outstandingInvoices.length === 0 ? (
            <EmptyState icon={<FileText className="h-8 w-8" />} message="All invoices settled" />
          ) : (
            <div className="space-y-2">
              {outstandingInvoices.slice(0, 6).map((row: any) => {
                const inv = row.invoice;
                const isOverdue = inv.status === "overdue";
                return (
                  <div key={inv.id} className="rounded-xl border bg-card px-4 py-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{row.client?.companyName ?? "Unknown"}</p>
                        <p className="text-xs text-muted-foreground font-mono">{inv.invoiceNumber}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-sm font-semibold ${isOverdue ? "text-red-500" : ""}`}>
                          {inv.currency} {parseFloat(inv.total ?? "0").toLocaleString()}
                        </p>
                        <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${INV_STATUS_COLORS[inv.status]}`}>
                          {inv.status}
                        </span>
                      </div>
                    </div>
                    {inv.dueDate && (
                      <p className={`text-xs mt-1 ${isOverdue ? "text-red-500" : "text-muted-foreground"}`}>
                        Due {inv.dueDate}
                      </p>
                    )}
                  </div>
                );
              })}
              {outstandingInvoices.length > 6 && (
                <Link href="/agency/invoices">
                  <p className="text-xs text-center text-muted-foreground hover:text-foreground transition-colors py-1 cursor-pointer">
                    +{outstandingInvoices.length - 6} more
                  </p>
                </Link>
              )}
            </div>
          )}
        </section>
      </div>

      {/* ── Top Talents ── */}
      <section className="space-y-3">
        <SectionHeader title="Top Performing Talents" href="/agency/talents" count={topTalents.length} />
        {loadingTalents ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : topTalents.length === 0 ? (
          <EmptyState icon={<Star className="h-8 w-8" />} message="No talent data yet" action={{ label: "View Talents", href: "/agency/talents" }} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
            {topTalents.map((t: any, i: number) => (
              <div key={t.channelId} className="rounded-xl border bg-card p-4 flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  {t.thumbnailUrl ? (
                    <img src={t.thumbnailUrl} alt={t.channelName} className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Users className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{t.channelName}</p>
                    {i === 0 && (
                      <span className="inline-flex items-center gap-0.5 text-xs text-amber-500 font-medium">
                        <Star className="h-2.5 w-2.5 fill-amber-500" /> #1
                      </span>
                    )}
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1"><TrendingUp className="h-3 w-3" /> Views</span>
                    <span className="font-medium">{fmtNum(t.totalViews)}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground flex items-center gap-1"><Briefcase className="h-3 w-3" /> Campaigns</span>
                    <span className="font-medium">{t.campaignCount}</span>
                  </div>
                  {t.affiliateRevenue > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground flex items-center gap-1"><DollarSign className="h-3 w-3" /> Revenue</span>
                      <span className="font-medium text-emerald-500">{fmtCurrency(t.affiliateRevenue)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Budget Overview ── */}
      {!loadingCampaigns && activeCampaigns.length > 0 && (
        <section className="space-y-3">
          <SectionHeader title="Active Campaign Budgets" href="/agency/campaigns" />
          <div className="rounded-xl border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Campaign</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Client</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Budget</th>
                  <th className="text-left px-4 py-3 font-medium text-muted-foreground">Timeline</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {activeCampaigns.map((row: any, i: number) => {
                  const c = row.campaign;
                  const budget = parseFloat(c.budget ?? "0");
                  const pct = totalCampaignBudget > 0 ? (budget / totalCampaignBudget) * 100 : 0;
                  return (
                    <tr key={c.id} className={`border-b last:border-0 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}>
                      <td className="px-4 py-3 font-medium">{c.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{row.client?.companyName ?? "—"}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="font-medium w-20 shrink-0">{budget > 0 ? fmtCurrency(budget) : "—"}</span>
                          {budget > 0 && (
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden min-w-[60px]">
                              <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {c.startDate && c.endDate ? `${c.startDate} → ${c.endDate}` : c.startDate ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <Link href={`/agency/campaigns/${c.id}`}>
                          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                            View <ChevronRight className="h-3 w-3" />
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t bg-muted/20">
                  <td colSpan={2} className="px-4 py-2 text-xs text-muted-foreground font-medium">Total Active Budget</td>
                  <td className="px-4 py-2 text-sm font-semibold">{fmtCurrency(totalCampaignBudget)}</td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({ icon, label, value, sub, accent }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{label}</p>
        <div className="h-8 w-8 rounded-lg bg-muted/50 flex items-center justify-center">{icon}</div>
      </div>
      <div>
        <p className="text-2xl font-bold tracking-tight">{value}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function SectionHeader({ title, href, count }: { title: string; href?: string; count?: number }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">{title}</h2>
        {count !== undefined && count > 0 && (
          <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-primary/15 text-primary text-xs font-medium">
            {count}
          </span>
        )}
      </div>
      {href && (
        <Link href={href}>
          <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-muted-foreground hover:text-foreground">
            View all <ChevronRight className="h-3 w-3" />
          </Button>
        </Link>
      )}
    </div>
  );
}

function EmptyState({ icon, message, action }: {
  icon: React.ReactNode;
  message: string;
  action?: { label: string; href: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center rounded-xl border border-dashed bg-muted/10">
      <div className="text-muted-foreground/30 mb-2">{icon}</div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {action && (
        <Link href={action.href}>
          <Button variant="outline" size="sm" className="mt-3 h-7 text-xs">{action.label}</Button>
        </Link>
      )}
    </div>
  );
}
