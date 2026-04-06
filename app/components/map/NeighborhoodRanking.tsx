"use client";

import { useEffect, useState, useMemo } from "react";
import { X, ArrowUpDown, Search } from "lucide-react";
import type { ColorMode } from "@/app/lib/constants";

interface Neighborhood {
  ntaCode: string;
  ntaName: string;
  borough: string;
  totalBlocks: number;
  avgDemand: number | null;
  avgGap: number | null;
  avgComposite: number | null;
  totalCompetitors: number;
  centroid: [number, number] | null;
}

type SortKey = "avgDemand" | "avgGap" | "avgComposite" | "totalCompetitors";

interface NeighborhoodRankingProps {
  timeWindow: string;
  colorMode: ColorMode;
  onFlyTo: (center: [number, number], zoom: number) => void;
  onClose: () => void;
}

const SORT_FOR_MODE: Record<ColorMode, SortKey> = {
  demand: "avgDemand",
  gap: "avgGap",
  competitors: "totalCompetitors",
  transit: "avgDemand",
};

export function NeighborhoodRanking({ timeWindow, colorMode, onFlyTo, onClose }: NeighborhoodRankingProps) {
  const [neighborhoods, setNeighborhoods] = useState<Neighborhood[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortKey, setSortKey] = useState<SortKey>(SORT_FOR_MODE[colorMode]);
  const [search, setSearch] = useState("");

  useEffect(() => {
    setSortKey(SORT_FOR_MODE[colorMode]);
  }, [colorMode]);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/map/neighborhoods?timeWindow=${timeWindow}`)
      .then((r) => r.json())
      .then((d) => {
        setNeighborhoods(d.neighborhoods ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [timeWindow]);

  const sorted = useMemo(() => {
    let filtered = neighborhoods;
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (n) => n.ntaName.toLowerCase().includes(q) || n.borough.toLowerCase().includes(q)
      );
    }
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? 0;
      const bv = b[sortKey] ?? 0;
      return sortKey === "totalCompetitors" ? (av as number) - (bv as number) : (bv as number) - (av as number);
    });
  }, [neighborhoods, sortKey, search]);

  function cycleSort() {
    const keys: SortKey[] = ["avgDemand", "avgGap", "avgComposite", "totalCompetitors"];
    const idx = keys.indexOf(sortKey);
    setSortKey(keys[(idx + 1) % keys.length]);
  }

  const sortLabels: Record<SortKey, string> = {
    avgDemand: "Demand",
    avgGap: "Gap",
    avgComposite: "Composite",
    totalCompetitors: "Competitors",
  };

  return (
    <div className="w-[320px] bg-zinc-900/95 backdrop-blur border-l border-zinc-800 flex flex-col shrink-0 h-full">
      {/* Header */}
      <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
        <h2 className="text-xs font-bold">Neighborhood Ranking</h2>
        <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white cursor-pointer">
          <X size={14} />
        </button>
      </div>

      {/* Search + sort */}
      <div className="p-3 border-b border-zinc-800 space-y-2">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-600" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search neighborhoods..."
            className="w-full pl-7 pr-3 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-[11px] text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
        </div>
        <button
          onClick={cycleSort}
          className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-teal-400 cursor-pointer transition-colors"
        >
          <ArrowUpDown size={10} />
          Sort by: <span className="text-zinc-300">{sortLabels[sortKey]}</span>
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : sorted.length === 0 ? (
          <p className="text-center text-zinc-600 text-xs py-8">No neighborhoods found</p>
        ) : (
          <div className="divide-y divide-zinc-800/50">
            {sorted.map((n, i) => (
              <button
                key={n.ntaCode}
                onClick={() => n.centroid && onFlyTo(n.centroid, 14)}
                className="w-full px-3 py-2.5 text-left hover:bg-zinc-800/50 transition-colors cursor-pointer flex items-center gap-2"
              >
                <span className="text-[10px] text-zinc-600 w-5 text-right shrink-0">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-medium truncate">{n.ntaName}</p>
                  <p className="text-[9px] text-zinc-600">{n.borough} · {n.totalBlocks} blocks</p>
                </div>
                <div className="text-right shrink-0 space-y-0.5">
                  {n.avgDemand != null && (
                    <p className={`text-[10px] font-mono ${sortKey === "avgDemand" ? "text-teal-400" : "text-zinc-500"}`}>
                      {n.avgDemand}
                    </p>
                  )}
                  {n.avgGap != null && (
                    <p className={`text-[10px] font-mono ${sortKey === "avgGap" ? "text-purple-400" : "text-zinc-600"}`}>
                      {n.avgGap}
                    </p>
                  )}
                  {n.avgComposite != null && (
                    <p className={`text-[10px] font-mono ${sortKey === "avgComposite" ? "text-blue-400" : "text-zinc-600"}`}>
                      {n.avgComposite}
                    </p>
                  )}
                  <p className={`text-[10px] font-mono ${sortKey === "totalCompetitors" ? "text-amber-400" : "text-zinc-600"}`}>
                    {n.totalCompetitors}c
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
