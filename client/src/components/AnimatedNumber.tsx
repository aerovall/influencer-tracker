import { useCountUp } from "@/hooks/useCountUp";

/**
 * Parses a formatted number string (e.g. "2.2M", "83K", "1,234", "$5.0K")
 * into a raw numeric value, animates it with useCountUp, then re-formats
 * the animated value using the same suffix/prefix as the original string.
 *
 * Supports:
 *   - Plain integers:  "240"  → counts 0..240
 *   - K suffix:        "83K"  → counts 0..83000, displays as "83.0K"
 *   - M suffix:        "2.2M" → counts 0..2200000, displays as "2.2M"
 *   - B suffix:        "1.5B" → counts 0..1500000000
 *   - Currency prefix: "USD 5.0K" → keeps prefix, animates number
 *   - Percentage:      "4.2%" → animates, keeps %
 *   - Non-numeric:     "—", "N/A" → rendered as-is (no animation)
 */

type Props = {
  value: string;
  duration?: number;
  className?: string;
};

function parseValue(raw: string): { numeric: number; format: (n: number) => string } | null {
  const s = raw.trim();

  // Non-numeric passthrough
  if (!s || s === "—" || s === "N/A" || s === "n/a") return null;

  // Currency prefix like "USD 5.0K" or "USD 1.2M"
  const currencyMatch = s.match(/^([A-Z]{2,3})\s+([\d,.]+)([KMBkmb]?)$/);
  if (currencyMatch) {
    const prefix = currencyMatch[1];
    const num = parseFloat(currencyMatch[2].replace(/,/g, ""));
    const suffix = currencyMatch[3].toUpperCase();
    const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : suffix === "B" ? 1_000_000_000 : 1;
    const raw = num * multiplier;
    return {
      numeric: raw,
      format: (n) => {
        if (n >= 1_000_000_000) return `${prefix} ${(n / 1_000_000_000).toFixed(1)}B`;
        if (n >= 1_000_000) return `${prefix} ${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${prefix} ${(n / 1_000).toFixed(1)}K`;
        return `${prefix} ${n.toLocaleString()}`;
      },
    };
  }

  // Percentage like "4.2%"
  const pctMatch = s.match(/^([\d.]+)%$/);
  if (pctMatch) {
    const num = parseFloat(pctMatch[1]);
    return {
      numeric: Math.round(num * 100), // store as integer cents to animate smoothly
      format: (n) => `${(n / 100).toFixed(2)}%`,
    };
  }

  // K/M/B suffix like "83K", "2.2M", "1.5B"
  const suffixMatch = s.match(/^([\d,.]+)([KMBkmb])$/);
  if (suffixMatch) {
    const num = parseFloat(suffixMatch[1].replace(/,/g, ""));
    const suffix = suffixMatch[2].toUpperCase();
    const multiplier = suffix === "K" ? 1_000 : suffix === "M" ? 1_000_000 : 1_000_000_000;
    const raw = num * multiplier;
    return {
      numeric: raw,
      format: (n) => {
        if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
        if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
        if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
        return n.toLocaleString();
      },
    };
  }

  // Plain integer or decimal like "240", "1,234"
  const plainMatch = s.match(/^[\d,]+(\.\d+)?$/);
  if (plainMatch) {
    const num = parseFloat(s.replace(/,/g, ""));
    return {
      numeric: num,
      format: (n) => Math.round(n).toLocaleString(),
    };
  }

  return null;
}

export function AnimatedNumber({ value, duration = 900, className }: Props) {
  const parsed = parseValue(value);

  // Always call hook — pass 0 and disabled=true when not animatable
  const animated = useCountUp(parsed?.numeric ?? 0, duration, !!parsed);

  if (!parsed) {
    return <span className={className}>{value}</span>;
  }

  return <span className={className}>{parsed.format(animated)}</span>;
}
