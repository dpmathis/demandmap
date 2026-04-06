"use client";

import { useMemo, useState } from "react";
import { TIME_WINDOWS, TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

interface HourlyChartProps {
  /** demand score per time window, 0-100; null = no data */
  windows: Record<string, number | null>;
  /** active time window (highlighted with NOW marker) */
  activeWindow: TimeWindow | null;
  /** optional historical baseline per window (for dashed overlay) */
  baseline?: Record<string, number | null>;
}

export function HourlyChart({ windows, activeWindow, baseline }: HourlyChartProps) {
  const [hoverWin, setHoverWin] = useState<TimeWindow | null>(null);

  const peakWin = useMemo(() => {
    let peak: TimeWindow | null = null;
    let peakScore = -1;
    for (const tw of TIME_WINDOWS) {
      const s = windows[tw];
      if (s != null && s > peakScore) {
        peakScore = s;
        peak = tw;
      }
    }
    return peak;
  }, [windows]);

  const maxScore = 100;

  return (
    <div>
      <div className="h-40 w-full relative">
        {/* Y-axis gridlines */}
        <div className="absolute inset-0 flex flex-col justify-between pointer-events-none z-0">
          <div className="border-t border-zinc-800/50 w-full h-0 relative">
            <span className="absolute -top-2 -left-2 bg-zinc-950 px-1 text-[9px] font-mono text-zinc-600">100</span>
          </div>
          <div className="border-t border-zinc-800/50 w-full h-0" />
          <div className="border-t border-zinc-800/50 w-full h-0 relative">
            <span className="absolute -top-2 -left-2 bg-zinc-950 px-1 text-[9px] font-mono text-zinc-600">50</span>
          </div>
          <div className="border-t border-zinc-800/50 w-full h-0" />
          <div className="border-t border-zinc-800 w-full h-0 relative">
            <span className="absolute -top-2 -left-2 bg-zinc-950 px-1 text-[9px] font-mono text-zinc-600">0</span>
          </div>
        </div>

        {/* Bars */}
        <div className="absolute inset-0 left-6 bottom-[1px] flex items-end justify-between gap-1 z-10 pt-2">
          {TIME_WINDOWS.map((tw, i) => {
            const score = windows[tw];
            const baselineScore = baseline?.[tw];
            const isPeak = tw === peakWin && score != null && score > 0;
            const isActive = tw === activeWindow;
            const isHover = tw === hoverWin;
            const heightPct = score != null ? (score / maxScore) * 100 : 0;
            const baselinePct = baselineScore != null ? (baselineScore / maxScore) * 100 : 0;

            return (
              <div
                key={tw}
                className="w-full flex flex-col justify-end h-full group relative cursor-pointer"
                onMouseEnter={() => setHoverWin(tw)}
                onMouseLeave={() => setHoverWin(null)}
              >
                {/* Historical baseline shadow */}
                {baselineScore != null && (
                  <div
                    className="absolute bottom-0 w-full bg-white/5 rounded-t-sm border-t border-dashed border-zinc-500"
                    style={{ height: `${baselinePct}%` }}
                  />
                )}
                {/* Bar */}
                <div
                  className={`w-full rounded-t-sm z-10 transition-colors ${
                    score == null
                      ? "bg-zinc-800"
                      : isPeak
                      ? "bg-rose-500 group-hover:bg-rose-400"
                      : isActive
                      ? "bg-teal-500 border border-teal-400 group-hover:bg-teal-400"
                      : "bg-teal-500/70 group-hover:bg-teal-400"
                  }`}
                  style={{
                    height: score == null ? "4px" : `${Math.max(heightPct, 2)}%`,
                    animation: `growUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) ${i * 40}ms both`,
                    transformOrigin: "bottom",
                  }}
                />
                {/* NOW marker on active bar */}
                {isActive && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-zinc-100 text-zinc-900 text-[9px] font-mono font-bold px-1 py-0.5 rounded z-20">
                    NOW
                  </div>
                )}
                {/* Tooltip */}
                {isHover && score != null && (
                  <div className="absolute -top-14 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-700 px-2 py-1 rounded shadow-xl whitespace-nowrap z-30">
                    <p className="text-[10px] font-mono text-zinc-400">{TIME_WINDOW_LABELS[tw]}</p>
                    <p className={`text-xs font-mono font-bold ${isPeak ? "text-rose-400" : "text-teal-400"}`}>
                      {Math.round(score)}
                      {isPeak && <span className="ml-1 text-[9px]">PEAK</span>}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* X-axis labels */}
      <div className="flex justify-between pl-6 mt-2 text-[10px] font-mono text-zinc-500 tabular-nums">
        {TIME_WINDOWS.map((tw) => {
          const [start] = tw.split("-");
          const isPeak = tw === peakWin;
          const isActive = tw === activeWindow;
          return (
            <span
              key={tw}
              className={`flex-1 text-center ${
                isActive ? "text-zinc-100 font-bold" : isPeak ? "text-rose-400 font-bold" : ""
              }`}
            >
              {start}
            </span>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex gap-4 border-t border-zinc-900 pt-3">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-teal-500" />
          <span className="text-[10px] font-mono text-zinc-400">FORECAST</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-sm bg-rose-500" />
          <span className="text-[10px] font-mono text-zinc-400">PEAK</span>
        </div>
        {baseline && (
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-px border-t border-dashed border-zinc-500" />
            <span className="text-[10px] font-mono text-zinc-400">HIST. NORM</span>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes growUp {
          from { transform: scaleY(0); }
          to { transform: scaleY(1); }
        }
      `}</style>
    </div>
  );
}
