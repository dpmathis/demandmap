"use client";

import { Sparkles, AlertTriangle, MapPin, Loader2 } from "lucide-react";
import { TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

export interface SuggestionData {
  geoid: string;
  ntaName: string;
  borough: string;
  timeWindow: string;
  demandScore: number;
  reasoning: string;
  warnings: string[];
}

interface AISuggestionProps {
  suggestion: SuggestionData | null;
  loading: boolean;
  error: string | null;
  onFetch: () => void;
  onAccept: (suggestion: SuggestionData) => void;
}

export function AISuggestion({ suggestion, loading, error, onFetch, onAccept }: AISuggestionProps) {
  return (
    <div className="border-t border-zinc-800 pt-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Sparkles size={11} className="text-purple-400" />
        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">AI Suggestion</span>
      </div>

      {!suggestion && !loading && (
        <button
          onClick={onFetch}
          disabled={loading}
          className="w-full py-2 px-3 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 hover:border-purple-500/30 rounded-xl text-xs text-purple-300 font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Sparkles size={12} />
          Suggest next stop
        </button>
      )}

      {loading && (
        <div className="flex items-center gap-2 py-2 px-3 bg-zinc-900 rounded-xl border border-zinc-800">
          <Loader2 size={13} className="text-purple-400 animate-spin" />
          <span className="text-xs text-zinc-500">Analyzing demand...</span>
        </div>
      )}

      {error && !loading && (
        <div className="text-[10px] text-red-400 px-1 mb-2">{error}</div>
      )}

      {suggestion && !loading && (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-3 space-y-2">
          <div className="flex items-start gap-1.5">
            <MapPin size={11} className="text-purple-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white">{suggestion.ntaName}</p>
              <p className="text-[10px] text-zinc-500">{suggestion.borough} · {TIME_WINDOW_LABELS[suggestion.timeWindow as TimeWindow] ?? suggestion.timeWindow}</p>
            </div>
            <span className="ml-auto text-xs font-mono text-amber-400 shrink-0">{suggestion.demandScore}</span>
          </div>

          <p className="text-[10px] text-zinc-400 leading-relaxed">{suggestion.reasoning}</p>

          {suggestion.warnings.length > 0 && (
            <div className="space-y-1">
              {suggestion.warnings.map((w, i) => (
                <div key={i} className="flex items-center gap-1 text-[10px] text-amber-400">
                  <AlertTriangle size={9} />
                  {w}
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onAccept(suggestion)}
              className="flex-1 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-[11px] font-semibold rounded-lg transition-colors cursor-pointer"
            >
              Add to route
            </button>
            <button
              onClick={onFetch}
              className="px-2 py-1.5 text-zinc-500 hover:text-zinc-300 text-[11px] rounded-lg hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
