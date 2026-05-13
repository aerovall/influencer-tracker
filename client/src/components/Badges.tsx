import { cn } from "@/lib/utils";

type Platform = "YouTube" | "Instagram" | "TikTok";
type InfluencerName = "Levi" | "NoBs" | "Danielle";

export function PlatformBadge({ platform, className }: { platform: Platform; className?: string }) {
  const styles: Record<Platform, string> = {
    YouTube: "bg-red-500/15 text-red-400 border border-red-500/25",
    Instagram: "bg-purple-500/15 text-purple-400 border border-purple-500/25",
    TikTok: "bg-cyan-500/15 text-cyan-400 border border-cyan-500/25",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", styles[platform], className)}>
      {platform}
    </span>
  );
}

export function InfluencerBadge({ name, className }: { name: string; className?: string }) {
  const styles: Record<string, string> = {
    Levi: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
    NoBs: "bg-sky-500/15 text-sky-400 border border-sky-500/25",
    Danielle: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/25",
  };
  const style = styles[name] ?? "bg-slate-500/15 text-slate-400 border border-slate-500/25";
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", style, className)}>
      {name}
    </span>
  );
}

export function AlertTypeBadge({ type }: { type: string }) {
  const styles: Record<string, string> = {
    viral: "bg-amber-500/15 text-amber-400 border border-amber-500/25",
    underperforming: "bg-red-500/15 text-red-400 border border-red-500/25",
    custom: "bg-slate-500/15 text-slate-400 border border-slate-500/25",
  };
  const style = styles[type] ?? styles.custom;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium", style)}>
      {type}
    </span>
  );
}

export function formatNumber(n: number | string | null | undefined): string {
  const num = Number(n ?? 0);
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  return num.toLocaleString();
}

export function formatEngagement(n: number | string | null | undefined): string {
  return `${Number(n ?? 0).toFixed(2)}%`;
}
