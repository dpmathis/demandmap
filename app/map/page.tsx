"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/app/lib/supabase/client";
import { Map, Route, Users, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
import { MapSidebar } from "@/app/components/map/MapSidebar";
import { DEFAULT_TIME_WINDOW, DEFAULT_WEIGHTS, type TimeWindow, type OpportunityWeights } from "@/app/lib/constants";

const MapCanvas = dynamic(
  () => import("@/app/components/map/MapCanvas").then((m) => m.MapCanvas),
  {
    ssr: false,
    loading: () => (
      <div className="absolute inset-0 flex items-center justify-center bg-zinc-950">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-zinc-500">Loading map...</p>
        </div>
      </div>
    ),
  }
);

export interface MapFilters {
  vertical: string;
  timeWindow: TimeWindow;
  overlays: Set<string>;
  minDemand: number;
  weights: OpportunityWeights;
}

export default function MapPage() {
  const router = useRouter();
  const supabase = createClient();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [filters, setFilters] = useState<MapFilters>({
    vertical: "coffee",
    timeWindow: DEFAULT_TIME_WINDOW,
    overlays: new Set(["competitors"]),
    minDemand: 0,
    weights: DEFAULT_WEIGHTS,
  });

  const updateFilters = useCallback((partial: Partial<MapFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      {/* Top nav */}
      <nav className="flex items-center justify-between px-4 h-11 bg-zinc-900/80 backdrop-blur border-b border-zinc-800 shrink-0 z-20">
        <div className="flex items-center gap-5">
          <span className="text-base font-black tracking-tight">DemandMap</span>
          <div className="flex items-center gap-0.5">
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-500/15 text-teal-400">
              <Map size={13} /> Explorer
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
              <Route size={13} /> Routes
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
              <Users size={13} /> Team
            </button>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <LogOut size={13} />
        </button>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Sidebar */}
        {sidebarOpen && (
          <MapSidebar filters={filters} onFiltersChange={updateFilters} />
        )}

        {/* Sidebar toggle */}
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="absolute top-3 z-10 bg-zinc-900/90 border border-zinc-800 rounded-r-lg p-1.5 hover:bg-zinc-800 transition-colors cursor-pointer"
          style={{ left: sidebarOpen ? 280 : 0 }}
        >
          {sidebarOpen ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>

        {/* Map */}
        <div className="flex-1 relative">
          <MapCanvas filters={filters} />
        </div>
      </div>
    </div>
  );
}
