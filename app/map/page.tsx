"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { createClient } from "@/app/lib/supabase/client";
import { Map, Route, Users, LogOut, ChevronLeft, ChevronRight, Plus, Menu } from "lucide-react";
import { MapSidebar } from "@/app/components/map/MapSidebar";
import { RoutePanel } from "@/app/components/route/RoutePanel";
import { useMobile } from "@/app/lib/hooks/useMobile";
import { DEFAULT_TIME_WINDOW, DEFAULT_WEIGHTS, type TimeWindow, type OpportunityWeights } from "@/app/lib/constants";
import type { BlockClickData } from "@/app/components/map/MapCanvas";
import type { RouteStopData } from "@/app/components/route/StopCard";
import type { SuggestionData } from "@/app/components/route/AISuggestion";

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
  const isMobile = useMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [filters, setFilters] = useState<MapFilters>({
    vertical: "coffee",
    timeWindow: DEFAULT_TIME_WINDOW,
    overlays: new Set(["competitors"]),
    minDemand: 0,
    weights: DEFAULT_WEIGHTS,
  });

  // ── Route builder state ──
  const [routeOpen, setRouteOpen] = useState(false);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");
  const [stops, setStops] = useState<RouteStopData[]>([]);
  const creatingRouteRef = useRef(false);

  const updateFilters = useCallback((partial: Partial<MapFilters>) => {
    setFilters((prev) => ({ ...prev, ...partial }));
  }, []);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  function openRoute() {
    const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
    setRouteName(`Route – ${today}`);
    setStops([]);
    setRouteId(null);
    setRouteOpen(true);
    if (isMobile) setSidebarOpen(false);
  }

  const handleAddStop = useCallback(async (block: BlockClickData) => {
    if (creatingRouteRef.current) return;

    let rid = routeId;

    if (!rid) {
      creatingRouteRef.current = true;
      try {
        const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const name = `Route – ${today}`;
        const res = await fetch("/api/routes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, vertical: filters.vertical }),
        });
        if (!res.ok) return;
        const data = await res.json();
        rid = data.route.id;
        setRouteId(rid);
        setRouteName(name);
      } finally {
        creatingRouteRef.current = false;
      }
    }

    const res = await fetch(`/api/routes/${rid}/stops`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        censusBlockGeoid: block.geoid,
        timeWindow: block.timeWindow,
        lat: block.lat,
        lng: block.lng,
      }),
    });
    if (!res.ok) return;
    const data = await res.json();
    const stop: RouteStopData = {
      ...data.stop,
      censusBlock: data.stop.censusBlock ?? { ntaName: block.ntaName, borough: block.borough },
      demandScore: block.demandScore,
    };
    setStops((prev) => [...prev, stop]);
    if (!routeOpen) setRouteOpen(true);
  }, [routeId, filters.vertical, routeOpen]);

  const handleStopDelete = useCallback(async (stopId: string) => {
    if (!routeId) return;
    await fetch(`/api/routes/${routeId}/stops/${stopId}`, { method: "DELETE" });
    setStops((prev) => prev.filter((s) => s.id !== stopId));
  }, [routeId]);

  const handleSuggestionAccept = useCallback(async (suggestion: SuggestionData) => {
    await handleAddStop({
      geoid: suggestion.geoid,
      ntaName: suggestion.ntaName,
      borough: suggestion.borough,
      demandScore: suggestion.demandScore,
      compositeScore: null,
      lat: 0,
      lng: 0,
      timeWindow: suggestion.timeWindow,
    });
  }, [handleAddStop]);

  const handleRename = useCallback(async (name: string) => {
    setRouteName(name);
    if (routeId) {
      await fetch(`/api/routes/${routeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
    }
  }, [routeId]);

  // Sidebar: on desktop default open, on mobile overlay
  const showSidebarDesktop = !isMobile && sidebarOpen;
  const showSidebarMobileOverlay = isMobile && sidebarOpen;

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      {/* Top nav */}
      <nav className="flex items-center justify-between px-3 h-11 bg-zinc-900/80 backdrop-blur border-b border-zinc-800 shrink-0 z-20">
        <div className="flex items-center gap-2">
          {isMobile ? (
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 text-zinc-400 cursor-pointer">
              <Menu size={16} />
            </button>
          ) : null}
          <span className="text-base font-black tracking-tight">DemandMap</span>
          {!isMobile && (
            <div className="flex items-center gap-0.5 ml-3">
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-500/15 text-teal-400">
                <Map size={13} /> Explorer
              </button>
              <button onClick={() => router.push("/routes")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                <Route size={13} /> Routes
              </button>
              <button onClick={() => router.push("/team")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                <Users size={13} /> Team
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={routeOpen ? () => setRouteOpen(false) : openRoute}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold transition-all cursor-pointer ${
              routeOpen ? "bg-teal-600 text-white" : "bg-teal-500/15 text-teal-400 hover:bg-teal-500/25"
            }`}
          >
            <Plus size={13} />
            {isMobile ? "" : (routeOpen ? "Building" : "Route")}
          </button>
          <button onClick={handleLogout}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
            <LogOut size={13} />
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex min-h-0 relative">
        {/* Mobile sidebar overlay */}
        {showSidebarMobileOverlay && (
          <>
            <div className="absolute inset-0 bg-black/50 z-30" onClick={() => setSidebarOpen(false)} />
            <div className="absolute left-0 top-0 bottom-0 z-40 w-[280px]">
              <MapSidebar filters={filters} onFiltersChange={(p) => { updateFilters(p); setSidebarOpen(false); }} />
            </div>
          </>
        )}

        {/* Desktop sidebar */}
        {showSidebarDesktop && (
          <MapSidebar filters={filters} onFiltersChange={updateFilters} />
        )}

        {/* Desktop sidebar toggle */}
        {!isMobile && (
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="absolute top-3 z-10 bg-zinc-900/90 border border-zinc-800 rounded-r-lg p-1.5 hover:bg-zinc-800 transition-colors cursor-pointer"
            style={{ left: showSidebarDesktop ? 280 : 0 }}
          >
            {showSidebarDesktop ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
          </button>
        )}

        {/* Map */}
        <div className="flex-1 relative">
          <MapCanvas
            filters={filters}
            onAddStop={routeOpen ? handleAddStop : undefined}
            routeMode={routeOpen}
          />
        </div>

        {/* Route Panel — desktop right panel or mobile bottom sheet */}
        {routeOpen && (
          <RoutePanel
            routeId={routeId}
            routeName={routeName}
            stops={stops}
            vertical={filters.vertical}
            timeWindow={filters.timeWindow}
            isMobile={isMobile}
            onClose={() => setRouteOpen(false)}
            onStopDelete={handleStopDelete}
            onSuggestionAccept={handleSuggestionAccept}
            onRename={handleRename}
          />
        )}
      </div>
    </div>
  );
}
