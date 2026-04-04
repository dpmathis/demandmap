"use client";

import { X, GripVertical } from "lucide-react";
import { TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

export interface RouteStopData {
  id: string;
  sortOrder: number;
  censusBlockGeoid: string;
  timeWindow: string;
  notes?: string | null;
  lat?: number | null;
  lng?: number | null;
  censusBlock?: {
    ntaName?: string | null;
    borough?: string | null;
  } | null;
  demandScore?: number | null;
}

interface StopCardProps {
  stop: RouteStopData;
  index: number;
  onDelete: (stopId: string) => void;
}

export function StopCard({ stop, index, onDelete }: StopCardProps) {
  const name = stop.censusBlock?.ntaName ?? stop.censusBlockGeoid;
  const borough = stop.censusBlock?.borough;
  const timeLabel = TIME_WINDOW_LABELS[stop.timeWindow as TimeWindow] ?? stop.timeWindow;

  return (
    <div className="flex items-start gap-2 group">
      {/* Timeline indicator */}
      <div className="flex flex-col items-center shrink-0 mt-1">
        <div className="w-5 h-5 rounded-full bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-[9px] font-bold text-teal-400">
          {index + 1}
        </div>
        <div className="w-px flex-1 bg-zinc-800 mt-1" style={{ minHeight: 16 }} />
      </div>

      {/* Content */}
      <div className="flex-1 pb-3">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-2.5 group-hover:border-zinc-700 transition-colors">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{name}</p>
              {borough && <p className="text-[10px] text-zinc-500 mt-0.5">{borough}</p>}
            </div>
            <button
              onClick={() => onDelete(stop.id)}
              className="shrink-0 text-zinc-600 hover:text-red-400 transition-colors mt-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          </div>
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">{timeLabel}</span>
            {stop.demandScore != null && (
              <span className="text-[9px] text-amber-400 font-mono">{Math.round(stop.demandScore)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
