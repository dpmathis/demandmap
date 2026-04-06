"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

interface WeekNavProps {
  weekStart: Date;
  onChange: (d: Date) => void;
}

function isoWeekNumber(date: Date): number {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

export function WeekNav({ weekStart, onChange }: WeekNavProps) {
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);

  function shift(days: number) {
    const next = new Date(weekStart);
    next.setDate(weekStart.getDate() + days);
    onChange(next);
  }

  function toThisWeek() {
    const now = new Date();
    const day = now.getDay();
    const diff = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diff);
    monday.setHours(0, 0, 0, 0);
    onChange(monday);
  }

  const week = isoWeekNumber(weekStart);
  const range = `${weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} — ${weekEnd.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`.toUpperCase();
  const year = weekStart.getFullYear();
  const q = Math.ceil((weekStart.getMonth() + 1) / 3);

  return (
    <div className="flex items-center bg-zinc-900 rounded-md border border-zinc-800 p-0.5">
      <button
        onClick={() => shift(-7)}
        className="p-1.5 text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer"
        aria-label="Previous week"
      >
        <ChevronLeft size={14} />
      </button>
      <button
        onClick={toThisWeek}
        className="px-4 py-1 border-x border-zinc-800 flex flex-col items-center justify-center hover:bg-zinc-800/40 transition-colors cursor-pointer"
        title="Jump to current week"
      >
        <span className="font-mono text-xs font-bold text-zinc-100 tabular-nums">
          WK {String(week).padStart(2, "0")} · {range}
        </span>
        <span className="font-mono text-[9px] text-zinc-500 tabular-nums">
          {year}_Q{q}
        </span>
      </button>
      <button
        onClick={() => shift(7)}
        className="p-1.5 text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer"
        aria-label="Next week"
      >
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
