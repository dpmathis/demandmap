"use client";

import { useEffect, useState } from "react";
import { VERTICALS, TIME_WINDOWS, TIME_WINDOW_LABELS, COLOR_MODES, COLOR_MODE_LABELS, type TimeWindow, type ColorMode } from "@/app/lib/constants";
import { getProfile } from "@/app/lib/profiles";
import type { MapFilters } from "@/app/(dashboard)/map/page";
import { SavedViewSelector, type SavedViewConfig } from "@/app/components/map/SavedViewSelector";
import { Compass, Clock, Layers, SlidersHorizontal, Palette, MapPin, Store, Sparkles } from "lucide-react";

const BOROUGHS = ["Manhattan", "Brooklyn", "Queens", "Bronx", "Staten Island"];
const TIERS = [
  { key: "specialty", label: "Specialty", color: "bg-amber-400" },
  { key: "premium", label: "Premium", color: "bg-blue-400" },
  { key: "mainstream", label: "Mainstream", color: "bg-zinc-400" },
];

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
  onSaveView?: (name: string) => Promise<SavedViewConfig | null>;
  onLoadView?: (config: SavedViewConfig) => void;
}

export function MapSidebar({ filters, onFiltersChange, onSaveView, onLoadView }: MapSidebarProps) {
  const profile = getProfile(filters.vertical);

  const [weatherRisk, setWeatherRisk] = useState<Record<string, string>>({});
  useEffect(() => {
    fetch("/api/map/weather-risk")
      .then((r) => r.json())
      .then((d) => setWeatherRisk(d.risks ?? {}))
      .catch(() => {});
  }, []);

  function toggleOverlay(key: string) {
    const next = new Set(filters.overlays);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onFiltersChange({ overlays: next });
  }

  function toggleBorough(b: string) {
    const next = new Set(filters.boroughs);
    if (next.has(b)) next.delete(b);
    else next.add(b);
    onFiltersChange({ boroughs: next });
  }

  function toggleTier(t: string) {
    const next = new Set(filters.competitorTiers);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    onFiltersChange({ competitorTiers: next });
  }

  return (
    <aside className="w-[280px] bg-zinc-900/60 backdrop-blur border-r border-zinc-800 flex flex-col shrink-0 overflow-y-auto">
      {/* Saved views */}
      {onSaveView && onLoadView && (
        <div className="p-3 border-b border-zinc-800">
          <SavedViewSelector onSave={onSaveView} onLoad={onLoadView} />
        </div>
      )}

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

      {/* Color mode */}
      <div className="p-4 border-b border-zinc-800">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <Palette size={12} /> Color by
        </label>
        <div className="grid grid-cols-2 gap-1">
          {COLOR_MODES.map((mode) => (
            <button
              key={mode}
              onClick={() => onFiltersChange({ colorMode: mode })}
              className={`px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                filters.colorMode === mode
                  ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                  : "text-zinc-500 hover:text-white hover:bg-zinc-800 border border-transparent"
              }`}
            >
              {COLOR_MODE_LABELS[mode]}
            </button>
          ))}
        </div>
        {/* Weight sliders for Opportunity Gap mode */}
        {filters.colorMode === "gap" && (
          <div className="mt-3 space-y-2">
            {(["supply", "demand", "transit"] as const).map((key) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-[10px] text-zinc-500 capitalize">{key} weight</span>
                  <span className="text-[10px] font-mono text-zinc-400">{filters.weights[key]}</span>
                </div>
                <input
                  type="range"
                  min={0} max={100} step={5}
                  value={filters.weights[key]}
                  onChange={(e) => {
                    const val = parseInt(e.target.value);
                    onFiltersChange({ weights: { ...filters.weights, [key]: val } });
                  }}
                  className="w-full accent-teal-500"
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Time window */}
      <div className="p-4 border-b border-zinc-800">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <Clock size={12} /> Time of day
        </label>
        <div className="grid grid-cols-4 gap-1">
          {TIME_WINDOWS.map((tw) => {
            const risk = weatherRisk[tw];
            const riskColor = risk === "high" ? "bg-red-400" : risk === "moderate" ? "bg-amber-400" : "";
            return (
              <button
                key={tw}
                onClick={() => onFiltersChange({ timeWindow: tw as TimeWindow })}
                className={`relative px-1.5 py-1.5 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                  filters.timeWindow === tw
                    ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                    : "text-zinc-500 hover:text-white hover:bg-zinc-800 border border-transparent"
                }`}
              >
                {TIME_WINDOW_LABELS[tw].replace(" AM", "a").replace(" PM", "p").replace("11 a – 1 p", "11a-1p")}
                {riskColor && (
                  <span className={`absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full ${riskColor}`} />
                )}
              </button>
            );
          })}
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

      {/* Borough filter */}
      <div className="p-4 border-b border-zinc-800">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <MapPin size={12} /> Boroughs
        </label>
        <div className="flex flex-wrap gap-1">
          {BOROUGHS.map((b) => (
            <button
              key={b}
              onClick={() => toggleBorough(b)}
              className={`px-2 py-1 rounded-lg text-[10px] font-medium transition-all cursor-pointer ${
                filters.boroughs.size === 0 || filters.boroughs.has(b)
                  ? "bg-teal-500/20 text-teal-400 border border-teal-500/30"
                  : "text-zinc-600 hover:text-zinc-400 hover:bg-zinc-800 border border-transparent"
              }`}
            >
              {b}
            </button>
          ))}
          {filters.boroughs.size > 0 && (
            <button
              onClick={() => onFiltersChange({ boroughs: new Set() })}
              className="px-2 py-1 rounded-lg text-[10px] text-zinc-600 hover:text-zinc-400 cursor-pointer"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Competitor filters */}
      <div className="p-4 border-b border-zinc-800">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <Store size={12} /> Competitors
        </label>
        {/* Tier checkboxes */}
        <div className="space-y-1 mb-3">
          {TIERS.map((t) => (
            <label
              key={t.key}
              className="flex items-center gap-2.5 px-2 py-1 rounded-lg cursor-pointer hover:bg-zinc-800/50 transition-colors"
            >
              <input
                type="checkbox"
                checked={filters.competitorTiers.has(t.key)}
                onChange={() => toggleTier(t.key)}
                className="w-3.5 h-3.5 rounded accent-teal-500"
              />
              <span className={`w-1.5 h-1.5 rounded-full ${t.color}`} />
              <span className="text-xs text-zinc-300">{t.label}</span>
            </label>
          ))}
        </div>
        {/* Chain filter */}
        <div className="flex gap-0.5 bg-zinc-950 rounded-lg p-0.5 mb-3">
          {(["all", "chain", "independent"] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => onFiltersChange({ chainFilter: opt })}
              className={`flex-1 px-2 py-1 rounded-md text-[10px] font-medium transition-all cursor-pointer capitalize ${
                filters.chainFilter === opt
                  ? "bg-teal-500/20 text-teal-400"
                  : "text-zinc-500 hover:text-zinc-300"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
        {/* Max competitors slider */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-zinc-500">Max nearby competitors</span>
            <span className="text-[10px] font-mono text-zinc-400">{filters.maxCompetitors}</span>
          </div>
          <input
            type="range"
            min={0} max={50} step={5}
            value={Math.min(filters.maxCompetitors, 50)}
            onChange={(e) => onFiltersChange({ maxCompetitors: parseInt(e.target.value) })}
            className="w-full accent-teal-500"
          />
        </div>
      </div>

      {/* AI insights toggle */}
      <div className="p-4 border-b border-zinc-800">
        <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg cursor-pointer hover:bg-zinc-800/50 transition-colors">
          <input
            type="checkbox"
            checked={filters.aiInsights}
            onChange={(e) => onFiltersChange({ aiInsights: e.target.checked })}
            className="w-3.5 h-3.5 rounded accent-purple-500"
          />
          <Sparkles size={12} className="text-purple-400" />
          <span className="text-xs text-zinc-300">AI hover insights</span>
        </label>
        <p className="text-[9px] text-zinc-600 mt-1 px-2">Off by default — each hover calls the AI model</p>
      </div>

      {/* Demand filter */}
      <div className="p-4">
        <label className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">
          <SlidersHorizontal size={12} /> Demand
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
