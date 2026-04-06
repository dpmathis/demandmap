"use client";

import { TIME_WINDOWS, type TimeWindow } from "@/app/lib/constants";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

/**
 * Per-window DOW multipliers derived from MTA subway ridership (Oct 2024).
 * Each row is [Mon, Tue, Wed, Thu, Fri, Sat, Sun] normalized to Wed=1.0.
 *
 * Key patterns:
 * - AM peak (07-09): weekends collapse (no commuters)
 * - Lunch (11-13): nearly flat including weekends
 * - PM peak (17-19): weekends drop, commuter-driven
 * - Evening (19-21): Thu/Fri peak (nightlife/dining)
 */
const DOW_MULTIPLIERS: Record<string, number[]> = {
  "07-09": [0.85, 1.01, 1.00, 0.90, 0.71, 0.22, 0.16],
  "09-11": [0.84, 1.00, 1.00, 0.97, 0.82, 0.57, 0.48],
  "11-13": [0.92, 0.97, 1.00, 1.00, 1.01, 0.99, 0.84],
  "13-15": [0.91, 0.97, 1.00, 0.98, 1.01, 0.88, 0.75],
  "15-17": [0.90, 1.00, 1.00, 0.97, 0.94, 0.64, 0.53],
  "17-19": [0.85, 1.01, 1.00, 0.96, 0.81, 0.53, 0.43],
  "19-21": [0.86, 0.98, 1.00, 1.06, 1.00, 0.85, 0.61],
};
// Flat fallback for unknown windows
const DEFAULT_DOW = [0.90, 1.00, 1.00, 0.98, 0.90, 0.63, 0.50];

interface WeeklyRhythmProps {
  /** single-day demand per time window (0-100) to project across the week */
  windows: Record<string, number | null>;
}

function demandColor(score: number): string {
  if (score < 20) return "bg-zinc-800";
  if (score < 40) return "bg-blue-900/70";
  if (score < 60) return "bg-blue-600/70";
  if (score < 75) return "bg-amber-500/80";
  if (score < 90) return "bg-orange-500/90";
  return "bg-rose-500";
}

export function WeeklyRhythm({ windows }: WeeklyRhythmProps) {
  const today = new Date().getDay(); // 0=Sun..6=Sat
  const todayIdx = today === 0 ? 6 : today - 1; // convert to 0=Mon..6=Sun

  return (
    <div>
      <div className="grid grid-cols-[40px_repeat(7,minmax(0,1fr))] gap-1">
        {/* Header row */}
        <div />
        {DAYS.map((d, i) => (
          <div key={d} className="text-center">
            <span
              className={`text-[9px] font-mono tracking-wider ${
                i === todayIdx ? "text-teal-400 font-bold" : "text-zinc-500"
              }`}
            >
              {d}
            </span>
          </div>
        ))}

        {/* Time-window rows */}
        {TIME_WINDOWS.map((tw) => {
          const base = windows[tw];
          return (
            <div key={tw} className="contents">
              <div className="flex items-center justify-end pr-1">
                <span className="text-[9px] font-mono text-zinc-600 tabular-nums">
                  {tw.split("-")[0]}
                </span>
              </div>
              {(DOW_MULTIPLIERS[tw] ?? DEFAULT_DOW).map((mult, dayIdx) => {
                const score = base != null ? Math.min(100, base * mult) : null;
                const isToday = dayIdx === todayIdx;
                return (
                  <div
                    key={`${tw}-${dayIdx}`}
                    className={`h-6 rounded-sm ${
                      score == null ? "bg-zinc-900 border border-zinc-800" : demandColor(score)
                    } ${isToday ? "ring-1 ring-teal-400/40" : ""} transition-colors group relative cursor-pointer hover:brightness-125`}
                    title={score != null ? `${DAYS[dayIdx]} ${tw} · ${Math.round(score)}` : "No data"}
                  >
                    {isToday && (
                      <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-teal-400" />
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-between border-t border-zinc-900 pt-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-zinc-500">DEMAND</span>
          <div className="flex gap-0.5">
            <div className="w-4 h-2 bg-zinc-800 rounded-sm" />
            <div className="w-4 h-2 bg-blue-900/70 rounded-sm" />
            <div className="w-4 h-2 bg-blue-600/70 rounded-sm" />
            <div className="w-4 h-2 bg-amber-500/80 rounded-sm" />
            <div className="w-4 h-2 bg-orange-500/90 rounded-sm" />
            <div className="w-4 h-2 bg-rose-500 rounded-sm" />
          </div>
        </div>
        <span className="text-[9px] font-mono text-zinc-600 uppercase tracking-widest">
          Weekly Rhythm · MTA Calibrated
        </span>
      </div>
    </div>
  );
}
