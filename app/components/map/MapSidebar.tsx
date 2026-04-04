"use client";

import { VERTICALS, TIME_WINDOWS, TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";
import { getProfile } from "@/app/lib/profiles";
import type { MapFilters } from "@/app/map/page";
import { Compass, Clock, Layers, SlidersHorizontal } from "lucide-react";

const OVERLAYS = [
  { key: "competitors", label: "Competitors" },
  { key: "transit", label: "Transit Stations" },
  { key: "busyness", label: "Station Busyness (Live)" },
  { key: "events", label: "NYC Events (Today)" },
  { key: "closures", label: "Street Closures" },
];

interface MapSidebarProps {
  filters: MapFilters;
  onFiltersChange: (partial: Partial<MapFilters>) => void;
}

export function MapSidebar({ filters, onFiltersChange }: MapSidebarProps) {
  const profile = getProfile(filters.vertical);

  function toggleOverlay(key: string) {
    const next = new Set(filters.overlays);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onFiltersChange({ overlays: next });
  }

  return (
    <aside className="w-[280px] bg-zinc-900/60 backdrop-blur border-r border-zinc-800 flex flex-col shrink-0 overflow-y-auto">
      {/* Vertical selector */}
      <div className="p-4 border-b border-zinc-800">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <Compass size={12} /> Planning for
        </label>
        <select
          value={filters.vertical}
          onChange={(e) => onFiltersChange({ vertical: e.target.value })}
          className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
        >
          {VERTICALS.map((v) => (
            <option key={v.value} value={v.value}>{v.label}</option>
          ))}
        </select>
        <p className="text-[10px] text-zinc-600 mt-1.5">
          Using <strong className="text-zinc-400">{profile.name}</strong> demand model
        </p>
      </div>

      {/* Time window */}
      <div className="p-4 border-b border-zinc-800">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <Clock size={12} /> Time of day
        </label>
        <div className="grid grid-cols-4 gap-1">
          {TIME_WINDOWS.map((tw) => (
            <button
              key={tw}
              onClick={() => onFiltersChange({ timeWindow: tw as TimeWindow })}
              className={`px-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                filters.timeWindow === tw
                  ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                  : "text-zinc-500 hover:text-white hover:bg-zinc-800 border border-transparent"
              }`}
            >
              {TIME_WINDOW_LABELS[tw].replace(" AM", "a").replace(" PM", "p").replace("11 a – 1 p", "11a-1p")}
            </button>
          ))}
        </div>
      </div>

      {/* Overlays */}
      <div className="p-4 border-b border-zinc-800">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <Layers size={12} /> Overlays
        </label>
        <div className="space-y-1">
          {OVERLAYS.map((o) => (
            <label
              key={o.key}
              className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-800/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={filters.overlays.has(o.key)}
                onChange={() => toggleOverlay(o.key)}
                className="w-3.5 h-3.5 rounded accent-teal-500"
              />
              <span className="text-xs text-zinc-300">{o.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Demand filter */}
      <div className="p-4">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <SlidersHorizontal size={12} /> Filters
        </label>
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500">Min demand score</span>
            <span className="text-[10px] font-mono text-zinc-400">{filters.minDemand}</span>
          </div>
          <input
            type="range"
            min={0} max={80} step={5}
            value={filters.minDemand}
            onChange={(e) => onFiltersChange({ minDemand: parseInt(e.target.value) })}
            className="w-full accent-teal-500"
          />
        </div>
      </div>
    </aside>
  );
}
