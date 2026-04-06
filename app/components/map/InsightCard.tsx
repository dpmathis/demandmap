"use client";

import { Sparkles } from "lucide-react";

export interface InsightState {
  x: number;
  y: number;
  loading: boolean;
  text: string | null;
  ntaName: string | null;
}

interface InsightCardProps {
  state: InsightState | null;
}

export function InsightCard({ state }: InsightCardProps) {
  if (!state) return null;

  // Position near cursor, offset so it doesn't overlap
  const style: React.CSSProperties = {
    left: state.x + 16,
    top: state.y + 16,
  };

  return (
    <div
      className="absolute z-30 max-w-[260px] bg-zinc-900/95 border border-purple-500/30 rounded-lg px-3 py-2 shadow-xl backdrop-blur pointer-events-none"
      style={style}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <Sparkles size={10} className="text-purple-400" />
        <span className="text-[9px] font-bold uppercase tracking-widest text-purple-400">
          AI Insight
        </span>
        {state.ntaName && (
          <span className="text-[9px] text-zinc-500 truncate">· {state.ntaName}</span>
        )}
      </div>
      {state.loading ? (
        <div className="flex items-center gap-1.5 text-[11px] text-zinc-500">
          <div className="w-2 h-2 border border-purple-400 border-t-transparent rounded-full animate-spin" />
          Thinking...
        </div>
      ) : (
        <p className="text-[11px] text-zinc-200 leading-snug">{state.text}</p>
      )}
    </div>
  );
}
