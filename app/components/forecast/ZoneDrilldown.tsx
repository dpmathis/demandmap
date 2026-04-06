"use client";

import { X, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

interface ZoneDrilldownProps {
  selected: {
    geoid: string;
    ntaName: string | null;
    borough: string | null;
  } | null;
  /** current demand score at active time window (0-100) */
  currentScore: number | null;
  /** baseline to compare against (same scale) */
  baselineScore: number | null;
  /** peak window for the selection */
  peakWindow: TimeWindow | null;
  peakScore: number | null;
  /** header label when no zone selected (e.g., "CITYWIDE") */
  cityAggregate: { avgDemand: number; zoneCount: number } | null;
  onClear: () => void;
}

function formatDelta(current: number | null, baseline: number | null): {
  pct: number;
  dir: "up" | "down" | "flat";
  colorClass: string;
} | null {
  if (current == null || baseline == null || baseline === 0) return null;
  const pct = ((current - baseline) / baseline) * 100;
  const rounded = Math.round(pct * 10) / 10;
  if (Math.abs(rounded) < 1) return { pct: 0, dir: "flat", colorClass: "text-zinc-400" };
  if (rounded > 0) return { pct: rounded, dir: "up", colorClass: "text-teal-400" };
  return { pct: rounded, dir: "down", colorClass: "text-rose-400" };
}

export function ZoneDrilldown({
  selected,
  currentScore,
  baselineScore,
  peakWindow,
  peakScore,
  cityAggregate,
  onClear,
}: ZoneDrilldownProps) {
  const delta = formatDelta(currentScore, baselineScore);

  return (
    <div className="bg-zinc-900 border-b border-zinc-800 p-5 sticky top-0 z-30">
      <div className="flex items-start justify-between mb-4">
        <div className="min-w-0">
          <h2 className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase mb-1">
            {selected ? `SELECTED ZONE · ${selected.geoid.slice(-8)}` : "CITYWIDE AGGREGATE"}
          </h2>
          <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2 truncate">
            {selected ? (
              <>
                <span className="truncate">{selected.ntaName ?? "Unknown Zone"}</span>
                {peakScore != null && peakScore > 60 && (
                  <div
                    className="w-2 h-2 rounded-full bg-rose-500 shrink-0"
                    style={{ boxShadow: "0 0 8px rgba(244,63,94,0.6)" }}
                  />
                )}
              </>
            ) : (
              <>NYC · All Visible Zones</>
            )}
          </h1>
          {selected?.borough && (
            <p className="text-[11px] text-zinc-500 mt-0.5 font-mono uppercase tracking-wide">
              {selected.borough}
            </p>
          )}
        </div>
        {selected && (
          <button
            onClick={onClear}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 cursor-pointer shrink-0"
            aria-label="Clear selection"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 gap-px bg-zinc-800 border border-zinc-800 rounded overflow-hidden">
        <div className="bg-zinc-950 p-4">
          <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase mb-2">
            Current Demand
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-4xl font-mono text-zinc-100 tabular-nums">
              {selected
                ? currentScore != null
                  ? Math.round(currentScore)
                  : "—"
                : cityAggregate
                ? Math.round(cityAggregate.avgDemand)
                : "—"}
            </span>
            <span className="text-zinc-500 font-mono text-xs">/ 100</span>
          </div>
          {delta && (
            <div className={`${delta.colorClass} text-xs font-mono mt-1 flex items-center gap-1`}>
              {delta.dir === "up" ? (
                <TrendingUp size={12} />
              ) : delta.dir === "down" ? (
                <TrendingDown size={12} />
              ) : (
                <Minus size={12} />
              )}
              {delta.dir === "flat" ? "ON PACE" : `${delta.pct > 0 ? "+" : ""}${delta.pct}% VS TYPICAL`}
            </div>
          )}
        </div>
        <div className="bg-zinc-950 p-4">
          <div className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase mb-2">
            {selected ? "Peak Window" : "Zones Visible"}
          </div>
          <div className="flex items-baseline gap-2">
            {selected ? (
              <>
                <span className="text-2xl font-mono text-zinc-100 tabular-nums">
                  {peakWindow ? TIME_WINDOW_LABELS[peakWindow].replace(" – ", "–") : "—"}
                </span>
              </>
            ) : (
              <>
                <span className="text-4xl font-mono text-zinc-100 tabular-nums">
                  {cityAggregate ? cityAggregate.zoneCount : "—"}
                </span>
                <span className="text-zinc-500 font-mono text-xs">BLOCKS</span>
              </>
            )}
          </div>
          {selected && peakScore != null && (
            <div className="text-rose-400 text-xs font-mono mt-1 flex items-center gap-1">
              <TrendingUp size={12} /> SCORE {Math.round(peakScore)}
            </div>
          )}
          {!selected && (
            <div className="text-zinc-500 text-xs font-mono mt-1">IN VIEWPORT</div>
          )}
        </div>
      </div>
    </div>
  );
}
