"use client";

import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import type { SlotData } from "./SlotCard";

interface TeamMember {
  id: string;
  email: string;
  name: string | null;
}

interface TeamSwimlaneProps {
  slots: SlotData[];
}

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TeamSwimlane({ slots }: TeamSwimlaneProps) {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/team")
      .then((r) => r.json())
      .then((d) => {
        setMembers(d.members ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  // Unassigned row is always shown first
  const rows: Array<{ id: string | null; label: string }> = [
    { id: null, label: "Unassigned" },
    ...members.map((m) => ({ id: m.id, label: m.name || m.email })),
  ];

  // Overlap detection: for each member+day, check if any two slots share the same timeWindow
  function hasOverlap(memberId: string | null, dayOfWeek: number): boolean {
    const cells = slots.filter(
      (s) => (s.assignedTo ?? null) === memberId && s.dayOfWeek === dayOfWeek
    );
    const seen = new Set<string>();
    for (const s of cells) {
      if (seen.has(s.timeWindow)) return true;
      seen.add(s.timeWindow);
    }
    return false;
  }

  function slotsFor(memberId: string | null, dayOfWeek: number): SlotData[] {
    return slots
      .filter((s) => (s.assignedTo ?? null) === memberId && s.dayOfWeek === dayOfWeek)
      .sort((a, b) => a.timeWindow.localeCompare(b.timeWindow));
  }

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <div
        className="grid gap-px bg-zinc-800"
        style={{ gridTemplateColumns: "160px repeat(7, 1fr)" }}
      >
        {/* Header */}
        <div className="bg-zinc-900/60 p-2 flex items-center gap-1.5">
          <Users size={11} className="text-zinc-500" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Team</span>
        </div>
        {DAYS.map((d) => (
          <div key={d} className="bg-zinc-900/60 p-2 text-center">
            <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{d}</span>
          </div>
        ))}

        {/* Rows */}
        {rows.map((row) => (
          <div key={row.id ?? "unassigned"} className="contents">
            <div className="bg-zinc-900/40 p-2 flex items-center">
              <span className="text-xs text-zinc-300 truncate">{row.label}</span>
            </div>
            {DAYS.map((_, dayIdx) => {
              const cellSlots = slotsFor(row.id, dayIdx);
              const overlap = hasOverlap(row.id, dayIdx);
              return (
                <div
                  key={dayIdx}
                  className={`bg-zinc-950/40 p-1 min-h-[44px] space-y-0.5 ${
                    overlap ? "ring-1 ring-inset ring-red-500/50" : ""
                  }`}
                >
                  {cellSlots.map((s) => (
                    <div
                      key={s.id}
                      className="px-1.5 py-0.5 bg-teal-500/15 border border-teal-500/30 rounded text-[9px] text-teal-300 truncate"
                      title={`${s.route?.name ?? "Route"} @ ${s.timeWindow}`}
                    >
                      {s.timeWindow.split("-")[0]}a · {s.route?.name ?? "Route"}
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-3 px-3 py-2 bg-zinc-900/40 border-t border-zinc-800">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-teal-400" />
          <span className="text-[9px] text-zinc-500">Scheduled slot</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 border border-red-500/50 rounded" />
          <span className="text-[9px] text-zinc-500">Overlap</span>
        </div>
      </div>
    </div>
  );
}
