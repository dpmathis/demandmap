"use client";

import { useEffect, useState } from "react";
import { X, MapPin, Train, Building2, Plus, Pin, PinOff } from "lucide-react";
import { TIME_WINDOWS, TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

export interface InspectedBlock {
  geoid: string;
  ntaName: string | null;
  borough: string | null;
  demandScore: number | null;
  compositeScore: number | null;
  gapScore: number | null;
  supplyScore: number | null;
  totalJobs: number | null;
  totalOfficeSqft: number | null;
  totalResUnits: number | null;
  nearestSubwayMeters: number | null;
  subwayLines: string | null;
  primaryLandUse: string | null;
  specialtyCount500m: number | null;
  premiumCount500m: number | null;
  mainstreamCount500m: number | null;
  lat: number;
  lng: number;
}

interface BlockInspectorProps {
  block: InspectedBlock;
  currentTimeWindow: TimeWindow;
  isPinned?: boolean;
  canPin?: boolean;
  onClose: () => void;
  onAddToRoute?: () => void;
  onTogglePin?: () => void;
  embedded?: boolean;
}

export function BlockInspector({ block, currentTimeWindow, isPinned, canPin, onClose, onAddToRoute, onTogglePin, embedded }: BlockInspectorProps) {
  const [demandByWindow, setDemandByWindow] = useState<Record<string, number | null> | null>(null);

  useEffect(() => {
    setDemandByWindow(null);
    fetch(`/api/map/blocks/${block.geoid}/demand`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (data) setDemandByWindow(data.windows); })
      .catch(() => {});
  }, [block.geoid]);

  const maxDemand = demandByWindow
    ? Math.max(...Object.values(demandByWindow).map((v) => v ?? 0), 1)
    : 100;

  const specialty = block.specialtyCount500m ?? 0;
  const premium = block.premiumCount500m ?? 0;
  const mainstream = block.mainstreamCount500m ?? 0;
  const totalComp = specialty + premium + mainstream;

  return (
    <div className={embedded ? "flex flex-col" : "absolute right-0 top-0 bottom-0 z-20 w-[300px] bg-zinc-900/95 backdrop-blur border-l border-zinc-800 flex flex-col overflow-y-auto"}>
      {/* Header */}
      <div className="p-4 border-b border-zinc-800">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-sm font-bold text-white">{block.ntaName || block.geoid}</h3>
            {block.borough && <p className="text-[10px] text-zinc-500 mt-0.5">{block.borough}</p>}
          </div>
          <div className="flex items-center gap-1">
            {onTogglePin && (
              <button
                onClick={onTogglePin}
                disabled={!isPinned && !canPin}
                title={isPinned ? "Unpin from compare" : canPin ? "Pin to compare" : "Pin 3 blocks max"}
                className={`p-1 transition-colors cursor-pointer disabled:cursor-not-allowed ${
                  isPinned ? "text-teal-400 hover:text-teal-300" : "text-zinc-500 hover:text-white disabled:text-zinc-700 disabled:hover:text-zinc-700"
                }`}
              >
                {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              </button>
            )}
            <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white cursor-pointer">
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Score badges */}
        <div className="flex gap-3 mt-3">
          <div className="flex-1 bg-zinc-800/50 rounded-lg px-3 py-2 text-center">
            <p className="text-[9px] text-zinc-500 uppercase">Demand</p>
            <p className="text-lg font-bold text-amber-400">{block.demandScore != null ? Math.round(block.demandScore) : "—"}</p>
          </div>
          <div className="flex-1 bg-zinc-800/50 rounded-lg px-3 py-2 text-center">
            <p className="text-[9px] text-zinc-500 uppercase">Opportunity</p>
            <p className="text-lg font-bold text-green-400">{block.compositeScore != null ? Math.round(block.compositeScore) : "—"}</p>
          </div>
          <div className="flex-1 bg-zinc-800/50 rounded-lg px-3 py-2 text-center">
            <p className="text-[9px] text-zinc-500 uppercase">Gap</p>
            <p className="text-lg font-bold text-purple-400">{block.gapScore != null ? Math.round(block.gapScore) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Demand sparkline */}
      <div className="p-4 border-b border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Demand by Time</p>
        {demandByWindow ? (
          (() => {
            const values = TIME_WINDOWS.map((tw) => demandByWindow[tw] ?? 0);
            const allZero = values.every((v) => v === 0);
            if (allZero) {
              return <p className="text-[10px] text-zinc-500">No demand recorded for this block.</p>;
            }
            return (
              <div className="flex items-end gap-1 h-16">
                {TIME_WINDOWS.map((tw) => {
                  const val = demandByWindow[tw] ?? null;
                  const height = val != null ? Math.max((val / maxDemand) * 100, 4) : 4;
                  const isActive = tw === currentTimeWindow;
                  return (
                    <div key={tw} className="flex-1 flex flex-col items-center gap-0.5">
                      <div
                        className={`w-full rounded-sm transition-all ${
                          isActive ? "bg-teal-500" : val != null ? "bg-zinc-600" : "bg-zinc-800"
                        }`}
                        style={{ height: `${height}%` }}
                        title={`${TIME_WINDOW_LABELS[tw]}: ${val != null ? Math.round(val) : "N/A"}`}
                      />
                      <span className="text-[7px] text-zinc-600">{tw.split("-")[0]}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()
        ) : (
          <p className="text-[9px] text-zinc-600">Loading…</p>
        )}
      </div>

      {/* Competitor breakdown */}
      <div className="p-4 border-b border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <MapPin size={10} className="inline mr-1" />
          Competitors within 500m ({totalComp})
        </p>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#E85D26]" />
            <span className="text-[10px] text-zinc-400">{specialty} specialty</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#028090]" />
            <span className="text-[10px] text-zinc-400">{premium} premium</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-[#94A3B8]" />
            <span className="text-[10px] text-zinc-400">{mainstream} mainstream</span>
          </div>
        </div>
      </div>

      {/* Transit */}
      <div className="p-4 border-b border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <Train size={10} className="inline mr-1" />
          Transit
        </p>
        <p className="text-xs text-zinc-300">
          {block.subwayLines
            ? block.subwayLines.split(",").map((l) => l.trim()).join(" · ")
            : "No nearby lines"}
        </p>
        <p className="text-[10px] text-zinc-500 mt-0.5">
          {block.nearestSubwayMeters != null
            ? `${Math.round(block.nearestSubwayMeters)}m to nearest station`
            : "Distance unknown"}
        </p>
      </div>

      {/* Land use & jobs */}
      <div className="p-4 border-b border-zinc-800">
        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <Building2 size={10} className="inline mr-1" />
          Area Details
        </p>
        <div className="grid grid-cols-2 gap-y-1.5 text-[10px]">
          <span className="text-zinc-500">Land Use</span>
          <span className="text-zinc-300 text-right">{block.primaryLandUse || "—"}</span>
          <span className="text-zinc-500">Total Jobs</span>
          <span className="text-zinc-300 text-right">{block.totalJobs?.toLocaleString() ?? "—"}</span>
          <span className="text-zinc-500">Office Sqft</span>
          <span className="text-zinc-300 text-right">{block.totalOfficeSqft ? Math.round(block.totalOfficeSqft).toLocaleString() : "—"}</span>
          <span className="text-zinc-500">Residential Units</span>
          <span className="text-zinc-300 text-right">{block.totalResUnits?.toLocaleString() ?? "—"}</span>
        </div>
      </div>

      {/* Add to route */}
      {onAddToRoute && (
        <div className="p-4">
          <button
            onClick={onAddToRoute}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
          >
            <Plus size={13} /> Add to Route
          </button>
        </div>
      )}
    </div>
  );
}
