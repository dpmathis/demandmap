"use client";

import { useEffect, useState } from "react";
import { X, Scale } from "lucide-react";
import { TIME_WINDOWS, type TimeWindow } from "@/app/lib/constants";
import type { InspectedBlock } from "./BlockInspector";

interface BlockComparisonProps {
  blocks: InspectedBlock[];
  currentTimeWindow: TimeWindow;
  onUnpin: (geoid: string) => void;
  onClose: () => void;
}

type DemandSeries = Record<string, number | null>;

export function BlockComparison({ blocks, currentTimeWindow, onUnpin, onClose }: BlockComparisonProps) {
  const [series, setSeries] = useState<Record<string, DemandSeries>>({});

  useEffect(() => {
    let cancelled = false;
    blocks.forEach((b) => {
      if (series[b.geoid]) return;
      fetch(`/api/map/blocks/${b.geoid}/demand`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (cancelled || !data) return;
          setSeries((prev) => ({ ...prev, [b.geoid]: data.windows }));
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, [blocks, series]);

  if (blocks.length === 0) return null;

  // Compute best-per-metric to highlight
  const metrics: Array<{
    key: keyof InspectedBlock;
    label: string;
    higherIsBetter: boolean;
  }> = [
    { key: "demandScore", label: "Demand", higherIsBetter: true },
    { key: "compositeScore", label: "Opportunity", higherIsBetter: true },
    { key: "gapScore", label: "Gap", higherIsBetter: true },
  ];

  const bestByMetric: Record<string, string | null> = {};
  for (const m of metrics) {
    let bestGeoid: string | null = null;
    let bestVal: number | null = null;
    for (const b of blocks) {
      const v = b[m.key] as number | null;
      if (v == null) continue;
      if (bestVal == null || (m.higherIsBetter ? v > bestVal : v < bestVal)) {
        bestVal = v;
        bestGeoid = b.geoid;
      }
    }
    bestByMetric[m.label] = bestGeoid;
  }

  const compTotal = (b: InspectedBlock) =>
    (b.specialtyCount500m ?? 0) + (b.premiumCount500m ?? 0) + (b.mainstreamCount500m ?? 0);

  // Best competitor total = lowest
  let bestCompGeoid: string | null = null;
  let bestCompVal: number | null = null;
  for (const b of blocks) {
    const v = compTotal(b);
    if (bestCompVal == null || v < bestCompVal) {
      bestCompVal = v;
      bestCompGeoid = b.geoid;
    }
  }

  // Best transit = lowest distance
  let bestTransitGeoid: string | null = null;
  let bestTransitVal: number | null = null;
  for (const b of blocks) {
    const v = b.nearestSubwayMeters;
    if (v == null) continue;
    if (bestTransitVal == null || v < bestTransitVal) {
      bestTransitVal = v;
      bestTransitGeoid = b.geoid;
    }
  }

  return (
    <div className="absolute left-1/2 bottom-4 -translate-x-1/2 z-20 bg-zinc-900/95 border border-zinc-800 rounded-xl backdrop-blur shadow-2xl max-w-[720px] w-[calc(100%-32px)]">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-800">
        <div className="flex items-center gap-1.5">
          <Scale size={12} className="text-teal-400" />
          <h3 className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
            Compare ({blocks.length}/3)
          </h3>
        </div>
        <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white cursor-pointer">
          <X size={13} />
        </button>
      </div>
      <div
        className="grid gap-px bg-zinc-800"
        style={{ gridTemplateColumns: `repeat(${blocks.length}, minmax(0, 1fr))` }}
      >
        {blocks.map((b) => {
          const data = series[b.geoid];
          const maxDemand = data ? Math.max(...Object.values(data).map((v) => v ?? 0), 1) : 100;
          const comp = compTotal(b);
          return (
            <div key={b.geoid} className="bg-zinc-900 p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-white truncate">{b.ntaName || b.geoid}</div>
                  {b.borough && <div className="text-[9px] text-zinc-500">{b.borough}</div>}
                </div>
                <button
                  onClick={() => onUnpin(b.geoid)}
                  className="p-0.5 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                  title="Unpin"
                >
                  <X size={11} />
                </button>
              </div>

              {/* Metric grid */}
              <div className="grid grid-cols-3 gap-1">
                {metrics.map((m) => {
                  const v = b[m.key] as number | null;
                  const isBest = bestByMetric[m.label] === b.geoid;
                  return (
                    <div
                      key={m.label}
                      className={`px-1.5 py-1 rounded text-center ${
                        isBest ? "bg-green-500/15 border border-green-500/30" : "bg-zinc-800/50"
                      }`}
                    >
                      <div className="text-[8px] uppercase text-zinc-500">{m.label}</div>
                      <div
                        className={`text-sm font-bold tabular-nums ${
                          isBest ? "text-green-400" : "text-zinc-200"
                        }`}
                      >
                        {v != null ? Math.round(v) : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Sparkline */}
              <div>
                <div className="text-[8px] uppercase text-zinc-500 mb-0.5">Demand by hour</div>
                <div className="flex items-end gap-0.5 h-8">
                  {TIME_WINDOWS.map((tw) => {
                    const v = data?.[tw] ?? null;
                    const height = v != null ? Math.max((v / maxDemand) * 100, 4) : 4;
                    const isActive = tw === currentTimeWindow;
                    return (
                      <div
                        key={tw}
                        className={`flex-1 rounded-sm ${
                          isActive ? "bg-teal-500" : v != null ? "bg-zinc-600" : "bg-zinc-800"
                        }`}
                        style={{ height: `${height}%` }}
                        title={tw}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Supporting stats */}
              <div className="grid grid-cols-2 gap-2 text-[9px]">
                <div
                  className={`px-1.5 py-1 rounded ${
                    bestCompGeoid === b.geoid ? "bg-green-500/10 border border-green-500/20" : "bg-zinc-800/30"
                  }`}
                >
                  <div className="text-zinc-500 uppercase">Competitors</div>
                  <div
                    className={`font-bold ${bestCompGeoid === b.geoid ? "text-green-400" : "text-zinc-300"}`}
                  >
                    {comp}
                  </div>
                </div>
                <div
                  className={`px-1.5 py-1 rounded ${
                    bestTransitGeoid === b.geoid ? "bg-green-500/10 border border-green-500/20" : "bg-zinc-800/30"
                  }`}
                >
                  <div className="text-zinc-500 uppercase">Transit</div>
                  <div
                    className={`font-bold ${bestTransitGeoid === b.geoid ? "text-green-400" : "text-zinc-300"}`}
                  >
                    {b.nearestSubwayMeters != null ? `${Math.round(b.nearestSubwayMeters)}m` : "—"}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
