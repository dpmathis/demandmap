"use client";

import { useDroppable } from "@dnd-kit/core";
import { TIME_WINDOWS } from "@/app/lib/constants";
import { SlotCard, type SlotData } from "./SlotCard";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

interface PlannerGridProps {
  slots: SlotData[];
  weekStart: Date;
  onRemoveSlot: (id: string) => void;
}

function Cell({
  dayOfWeek,
  timeWindow,
  slots,
  onRemoveSlot,
}: {
  dayOfWeek: number;
  timeWindow: string;
  slots: SlotData[];
  onRemoveSlot: (id: string) => void;
}) {
  const id = `cell:${dayOfWeek}:${timeWindow}`;
  const { setNodeRef, isOver } = useDroppable({ id, data: { dayOfWeek, timeWindow } });
  const hasSlots = slots.length > 0;

  return (
    <div
      ref={setNodeRef}
      className={`min-h-[72px] border-b border-r border-zinc-800/40 p-1 space-y-1 transition-colors ${
        isOver
          ? "bg-teal-500/10 border-teal-500/60"
          : hasSlots
          ? "bg-zinc-950"
          : "bg-zinc-950 terminal-grid hover:bg-zinc-900/20"
      }`}
    >
      {slots.map((s) => (
        <SlotCard key={s.id} slot={s} onRemove={onRemoveSlot} />
      ))}
    </div>
  );
}

function formatDayDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }).toUpperCase();
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function PlannerGrid({ slots, weekStart, onRemoveSlot }: PlannerGridProps) {
  const today = new Date();
  const dayDates: Date[] = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div
      className="grid text-zinc-400 min-w-fit"
      style={{ gridTemplateColumns: "72px repeat(7, minmax(140px, 1fr))" }}
    >
      {/* Corner */}
      <div className="sticky top-0 left-0 z-40 border-b border-r border-zinc-800 bg-zinc-950 flex items-end justify-end p-2">
        <span className="font-mono text-[9px] text-zinc-600 tracking-widest uppercase">
          Time / Day
        </span>
      </div>

      {/* Day headers */}
      {dayDates.map((d, i) => {
        const isToday = isSameDay(d, today);
        return (
          <div
            key={i}
            className={`sticky top-0 z-30 border-b border-r border-zinc-800/60 bg-zinc-900/90 backdrop-blur flex flex-col justify-center px-3 py-2 relative ${
              isToday ? "border-b-2 border-b-teal-500" : ""
            }`}
          >
            {isToday && (
              <div className="absolute top-1 right-1">
                <div className="w-1.5 h-1.5 bg-teal-500 rounded-full pulse-op" />
              </div>
            )}
            <span
              className={`font-mono text-xs font-bold ${
                isToday ? "text-teal-400" : "text-zinc-100"
              }`}
            >
              {DAYS[i]}
            </span>
            <span className={`font-mono text-[10px] ${isToday ? "text-zinc-300" : "text-zinc-500"}`}>
              {formatDayDate(d)}
            </span>
          </div>
        );
      })}

      {/* Time window rows */}
      {TIME_WINDOWS.map((tw) => {
        const [startHour] = tw.split("-");
        const start = `${startHour.padStart(2, "0")}00`;
        const endHour = tw.split("-")[1];
        const end = `${endHour.padStart(2, "0")}00`;
        return (
          <div key={tw} className="contents">
            <div className="sticky left-0 z-20 border-b border-r border-zinc-800 bg-zinc-900/90 backdrop-blur flex flex-col items-end justify-start pt-2 pr-2">
              <span className="font-mono text-[10px] font-bold text-zinc-300 tabular-nums">
                {start}
              </span>
              <span className="font-mono text-[9px] text-zinc-600 tabular-nums">-{end}</span>
            </div>
            {DAYS.map((_, dayIdx) => {
              const cellSlots = slots.filter(
                (s) => s.dayOfWeek === dayIdx && s.timeWindow === tw
              );
              return (
                <Cell
                  key={`${dayIdx}-${tw}`}
                  dayOfWeek={dayIdx}
                  timeWindow={tw}
                  slots={cellSlots}
                  onRemoveSlot={onRemoveSlot}
                />
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
