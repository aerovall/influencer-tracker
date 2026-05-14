/**
 * ExportExcelDialog.tsx
 * A dialog that lets the user pick a date range (preset or custom) before
 * downloading the Excel export.
 */
import { useState, useCallback } from "react";
import { format, subDays, startOfDay, endOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Calendar as CalendarIcon, Download, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { trpc } from "@/lib/trpc";
import { downloadDashboardExcel } from "@/lib/exportExcel";
import { toast } from "sonner";

// ─── Preset definitions ───────────────────────────────────────────────────────

interface Preset {
  label: string;
  shortLabel: string;
  getDates: () => { dateFrom: string; dateTo: string } | null;
}

const PRESETS: Preset[] = [
  {
    label: "Last 7 days",
    shortLabel: "7d",
    getDates: () => ({
      dateFrom: format(subDays(new Date(), 6), "yyyy-MM-dd"),
      dateTo:   format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Last 14 days",
    shortLabel: "14d",
    getDates: () => ({
      dateFrom: format(subDays(new Date(), 13), "yyyy-MM-dd"),
      dateTo:   format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Last 30 days",
    shortLabel: "30d",
    getDates: () => ({
      dateFrom: format(subDays(new Date(), 29), "yyyy-MM-dd"),
      dateTo:   format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    label: "Last 90 days",
    shortLabel: "90d",
    getDates: () => ({
      dateFrom: format(subDays(new Date(), 89), "yyyy-MM-dd"),
      dateTo:   format(new Date(), "yyyy-MM-dd"),
    }),
  },
  {
    label: "All time",
    shortLabel: "All",
    getDates: () => null,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

interface ExportExcelDialogProps {
  /** Render the trigger button */
  trigger?: React.ReactNode;
}

export function ExportExcelDialog({ trigger }: ExportExcelDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<number>(4); // default: All time
  const [customRange, setCustomRange] = useState<DateRange | undefined>(undefined);
  const [calOpen, setCalOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const utils = trpc.useUtils();

  // Derive the effective date range from the current selection
  const getEffectiveDates = useCallback((): { dateFrom?: string; dateTo?: string } => {
    if (selectedPreset < PRESETS.length - 1) {
      // A preset (not "All time")
      const dates = PRESETS[selectedPreset].getDates();
      return dates ?? {};
    }
    if (selectedPreset === PRESETS.length - 1) {
      // "All time" preset
      return {};
    }
    // Custom range
    const from = customRange?.from;
    const to   = customRange?.to ?? customRange?.from;
    return {
      dateFrom: from ? format(from, "yyyy-MM-dd") : undefined,
      dateTo:   to   ? format(to,   "yyyy-MM-dd") : undefined,
    };
  }, [selectedPreset, customRange]);

  const rangeLabel = useCallback((): string => {
    if (selectedPreset >= 0 && selectedPreset < PRESETS.length) {
      if (selectedPreset === PRESETS.length - 1) return "All time";
      const dates = PRESETS[selectedPreset].getDates();
      if (!dates) return "All time";
      return `${format(new Date(dates.dateFrom), "dd MMM yyyy")} – ${format(new Date(dates.dateTo), "dd MMM yyyy")}`;
    }
    const from = customRange?.from;
    const to   = customRange?.to ?? customRange?.from;
    if (from && to) return `${format(from, "dd MMM yyyy")} – ${format(to, "dd MMM yyyy")}`;
    if (from)       return `From ${format(from, "dd MMM yyyy")}`;
    return "Pick a range";
  }, [selectedPreset, customRange]);

  const handleSelectPreset = (idx: number) => {
    setSelectedPreset(idx);
    setCustomRange(undefined);
  };

  const handleCustomSelect = (range: DateRange | undefined) => {
    setCustomRange(range);
    setSelectedPreset(-1); // -1 = custom
    if (range?.from && range?.to) setCalOpen(false);
  };

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const { dateFrom, dateTo } = getEffectiveDates();
      const data = await utils.analytics.exportStats.fetch(
        dateFrom || dateTo ? { dateFrom, dateTo } : undefined
      );
      downloadDashboardExcel(data);
      toast.success("Excel file downloaded!");
      setOpen(false);
    } catch (err: any) {
      toast.error(`Export failed: ${err?.message ?? "Unknown error"}`);
    } finally {
      setExporting(false);
    }
  }, [utils, getEffectiveDates]);

  const isCustom = selectedPreset === -1;
  const canExport = selectedPreset >= 0 || (isCustom && !!customRange?.from);

  return (
    <>
      {/* Trigger */}
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 gap-2 border-border/60 hover:bg-primary/10"
          >
            <Download className="h-4 w-4" />
            Export Excel
          </Button>
        )}
      </div>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download className="h-4 w-4 text-primary" />
              Export Excel
            </DialogTitle>
            <DialogDescription>
              Choose a date range to filter the exported data. The export includes
              videos, view counts, sponsorships, and channel stats.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Preset buttons */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Quick Select
              </p>
              <div className="flex flex-wrap gap-2">
                {PRESETS.map((preset, idx) => (
                  <button
                    key={preset.label}
                    onClick={() => handleSelectPreset(idx)}
                    className={cn(
                      "px-3 py-1.5 rounded-md text-sm font-medium border transition-all duration-150",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50",
                      selectedPreset === idx
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-transparent text-foreground border-border hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom date range picker */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                Custom Range
              </p>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <button
                    className={cn(
                      "w-full flex items-center gap-2 px-3 py-2 rounded-md border text-sm text-left transition-all duration-150",
                      "focus:outline-none focus:ring-2 focus:ring-primary/50",
                      isCustom
                        ? "border-primary bg-primary/5 text-foreground"
                        : "border-border bg-transparent text-muted-foreground hover:border-primary/50 hover:bg-primary/5"
                    )}
                  >
                    <CalendarIcon className="h-4 w-4 shrink-0" />
                    <span className="flex-1">
                      {isCustom && customRange?.from
                        ? customRange.to
                          ? `${format(customRange.from, "dd MMM yyyy")} – ${format(customRange.to, "dd MMM yyyy")}`
                          : `From ${format(customRange.from, "dd MMM yyyy")}`
                        : "Pick a custom date range…"}
                    </span>
                    <ChevronRight className="h-3 w-3 shrink-0 opacity-50" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="range"
                    selected={customRange}
                    onSelect={handleCustomSelect}
                    numberOfMonths={2}
                    disabled={{ after: new Date() }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Summary of selected range */}
            <div className="rounded-md bg-muted/40 border border-border/50 px-3 py-2 flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm text-muted-foreground">
                Selected range:{" "}
                <span className="font-medium text-foreground">{rangeLabel()}</span>
              </span>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleExport}
              disabled={exporting || !canExport}
              className="gap-2"
            >
              <Download className="h-4 w-4" />
              {exporting ? "Exporting…" : "Download Excel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
