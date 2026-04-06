"use client";

import { useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import { LayoutDashboard, Map, Route, Calendar, Users, Settings, LogOut, ChevronLeft, ChevronRight, Plus, Menu, BarChart3, Film, TrendingUp, MapPin } from "lucide-react";
import { MapSidebar } from "@/app/components/map/MapSidebar";
import { MapCanvas, type MapActions } from "@/app/components/map/MapCanvas";
import { RoutePanel } from "@/app/components/route/RoutePanel";
import { BlockInspector, type InspectedBlock } from "@/app/components/map/BlockInspector";
import { NeighborhoodRanking } from "@/app/components/map/NeighborhoodRanking";
import { TimeLapse } from "@/app/components/map/TimeLapse";
import { BlockComparison } from "@/app/components/map/BlockComparison";
import { MapSearch } from "@/app/components/map/MapSearch";
import { AnnotationLayer } from "@/app/components/map/AnnotationLayer";
import { BottomSheet } from "@/app/components/ui/BottomSheet";
import type { SavedViewConfig } from "@/app/components/map/SavedViewSelector";
import { useMobile } from "@/app/lib/hooks/useMobile";
import { DEFAULT_TIME_WINDOW, DEFAULT_WEIGHTS, type TimeWindow, type OpportunityWeights, type ColorMode } from "@/app/lib/constants";
import type { BlockClickData } from "@/app/components/map/MapCanvas";
import type { RouteStopData } from "@/app/components/route/StopCard";
import type { SuggestionData } from "@/app/components/route/AISuggestion";

export interface MapFilters {
  vertical: string;
  timeWindow: TimeWindow;
  overlays: Set<string>;
  minDemand: number;
  weights: OpportunityWeights;
  colorMode: ColorMode;
  boroughs: Set<string>;
  competitorTiers: Set<string>;
  chainFilter: "all" | "chain" | "independent";
  maxCompetitors: number;
  aiInsights: boolean;
}

export default function MapPage() {
  const router = useRouter();
  const supabase = createClient();
  const isMobile = useMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [filters, setFilters] = useState<MapFilters>(() => {
    let savedColorMode: ColorMode = "demand";
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("dm_colorMode");
      if (stored === "demand" || stored === "gap" || stored === "competitors" || stored === "transit") {
        savedColorMode = stored;
      }
    }
    return {
      vertical: "coffee",
      timeWindow: DEFAULT_TIME_WINDOW,
      overlays: new Set(["competitors"]),
      minDemand: 0,
      weights: DEFAULT_WEIGHTS,
      colorMode: savedColorMode,
      boroughs: new Set<string>(),
      competitorTiers: new Set(["specialty", "premium", "mainstream"]),
      chainFilter: "all" as const,
      maxCompetitors: 100,
      aiInsights: false,
    };
  });

  // ── Block inspector state ──
  const [inspectedBlock, setInspectedBlock] = useState<InspectedBlock | null>(null);
  const [pinnedBlocks, setPinnedBlocks] = useState<InspectedBlock[]>([]);

  // ── Neighborhood ranking state ──
  const [rankingOpen, setRankingOpen] = useState(false);
  const mapActionsRef = useRef<MapActions | null>(null);
  const [mapActionsReady, setMapActionsReady] = useState(0);

  // ── Time lapse state ──
  const [timeLapseActive, setTimeLapseActive] = useState(false);

  // ── Annotations state ──
  const [annotationsOpen, setAnnotationsOpen] = useState(false);

  // ── Route builder state ──
  const [routeOpen, setRouteOpen] = useState(false);
  const [routeId, setRouteId] = useState<string | null>(null);
  const [routeName, setRouteName] = useState("");
  const [stops, setStops] = useState<RouteStopData[]>([]);
  const creatingRouteRef = useRef(false);

  const updateFilters = useCallback((partial: Partial<MapFilters>) => {
    if (partial.colorMode) {
      localStorage.setItem("dm_colorMode", partial.colorMode);
    }
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
      lat: suggestion.centroidLat ?? 0,
      lng: suggestion.centroidLng ?? 0,
      timeWindow: suggestion.timeWindow,
    });
  }, [handleAddStop]);

  const handleSaveView = useCallback(async (_name: string): Promise<SavedViewConfig | null> => {
    const cam = mapActionsRef.current?.getCamera();
    if (!cam) return null;
    return {
      filters: {
        vertical: filters.vertical,
        timeWindow: filters.timeWindow,
        overlays: Array.from(filters.overlays),
        minDemand: filters.minDemand,
        weights: filters.weights,
        colorMode: filters.colorMode,
        boroughs: Array.from(filters.boroughs),
        competitorTiers: Array.from(filters.competitorTiers),
        chainFilter: filters.chainFilter,
        maxCompetitors: filters.maxCompetitors,
        aiInsights: filters.aiInsights,
      },
      center: cam.center,
      zoom: cam.zoom,
    };
  }, [filters]);

  const handleLoadView = useCallback((config: SavedViewConfig) => {
    const f = config.filters;
    setFilters((prev) => ({
      ...prev,
      vertical: f.vertical,
      timeWindow: f.timeWindow as TimeWindow,
      overlays: new Set(f.overlays),
      minDemand: f.minDemand,
      weights: f.weights,
      colorMode: f.colorMode as ColorMode,
      boroughs: new Set(f.boroughs),
      competitorTiers: new Set(f.competitorTiers),
      chainFilter: f.chainFilter as "all" | "chain" | "independent",
      maxCompetitors: f.maxCompetitors,
      aiInsights: f.aiInsights,
    }));
    mapActionsRef.current?.flyTo(config.center, config.zoom);
  }, []);

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
          <span className="flex items-baseline gap-1.5">
            <span className="text-base font-semibold tracking-tight text-zinc-100">DemandMap</span>
            <span className="font-mono text-[10px] text-zinc-500">NYC</span>
          </span>
          {!isMobile && (
            <div className="flex items-center gap-0.5 ml-3">
              <button onClick={() => router.push("/")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                <LayoutDashboard size={13} /> Dashboard
              </button>
              <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-500/15 text-teal-400">
                <Map size={13} /> Explorer
              </button>
              <button onClick={() => router.push("/forecast")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                <TrendingUp size={13} /> Forecast
              </button>
              <button onClick={() => router.push("/routes")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                <Route size={13} /> Routes
              </button>
              <button onClick={() => router.push("/planner")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                <Calendar size={13} /> Planner
              </button>
              <button onClick={() => router.push("/team")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                <Users size={13} /> Team
              </button>
              <button onClick={() => router.push("/settings")}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
                <Settings size={13} /> Settings
              </button>
            </div>
          )}
        </div>
        <div className="flex items-center gap-2">
          {!isMobile && (
            <div className="w-52">
              <MapSearch onFlyTo={(center, zoom) => mapActionsRef.current?.flyTo(center, zoom)} />
            </div>
          )}
          <button
            onClick={() => setAnnotationsOpen(!annotationsOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              annotationsOpen ? "bg-amber-500/20 text-amber-400" : "text-zinc-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <MapPin size={13} />
            {!isMobile && "Pins"}
          </button>
          <button
            onClick={() => setTimeLapseActive(!timeLapseActive)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              timeLapseActive ? "bg-teal-500/20 text-teal-400" : "text-zinc-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <Film size={13} />
            {!isMobile && "Time Lapse"}
          </button>
          <button
            onClick={() => setRankingOpen(!rankingOpen)}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
              rankingOpen ? "bg-purple-500/20 text-purple-400" : "text-zinc-500 hover:text-white hover:bg-white/5"
            }`}
          >
            <BarChart3 size={13} />
            {!isMobile && "Ranking"}
          </button>
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
              <MapSidebar filters={filters} onFiltersChange={(p) => { updateFilters(p); setSidebarOpen(false); }} onSaveView={handleSaveView} onLoadView={handleLoadView} />
            </div>
          </>
        )}

        {/* Desktop sidebar */}
        {showSidebarDesktop && (
          <MapSidebar filters={filters} onFiltersChange={updateFilters} onSaveView={handleSaveView} onLoadView={handleLoadView} />
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
            pinnedGeoids={pinnedBlocks.map((b) => b.geoid)}
            onAddStop={routeOpen ? handleAddStop : undefined}
            onBlockInspect={useCallback((block: InspectedBlock) => {
              setInspectedBlock(block);
            }, [])}
            onMapReady={useCallback((actions: MapActions) => {
              mapActionsRef.current = actions;
              setMapActionsReady((n) => n + 1);
            }, [])}
            routeMode={routeOpen}
          />

          {/* Block Inspector */}
          {inspectedBlock && !routeOpen && (
            isMobile ? (
              <BottomSheet
                open={true}
                onClose={() => setInspectedBlock(null)}
                snapPoints={[35, 65]}
                title={inspectedBlock.ntaName ?? "Block Details"}
              >
                <BlockInspector
                  block={inspectedBlock}
                  currentTimeWindow={filters.timeWindow}
                  isPinned={pinnedBlocks.some((b) => b.geoid === inspectedBlock.geoid)}
                  canPin={pinnedBlocks.length < 3}
                  onClose={() => setInspectedBlock(null)}
                  onTogglePin={() => {
                    setPinnedBlocks((prev) => {
                      const exists = prev.find((b) => b.geoid === inspectedBlock.geoid);
                      if (exists) return prev.filter((b) => b.geoid !== inspectedBlock.geoid);
                      if (prev.length >= 3) return prev;
                      return [...prev, inspectedBlock];
                    });
                  }}
                  onAddToRoute={undefined}
                  embedded
                />
              </BottomSheet>
            ) : (
              <BlockInspector
                block={inspectedBlock}
                currentTimeWindow={filters.timeWindow}
                isPinned={pinnedBlocks.some((b) => b.geoid === inspectedBlock.geoid)}
                canPin={pinnedBlocks.length < 3}
                onClose={() => setInspectedBlock(null)}
                onTogglePin={() => {
                  setPinnedBlocks((prev) => {
                    const exists = prev.find((b) => b.geoid === inspectedBlock.geoid);
                    if (exists) return prev.filter((b) => b.geoid !== inspectedBlock.geoid);
                    if (prev.length >= 3) return prev;
                    return [...prev, inspectedBlock];
                  });
                }}
                onAddToRoute={routeOpen ? () => {
                  handleAddStop({
                    geoid: inspectedBlock.geoid,
                    ntaName: inspectedBlock.ntaName,
                    borough: inspectedBlock.borough,
                    demandScore: inspectedBlock.demandScore,
                    compositeScore: inspectedBlock.compositeScore,
                    lat: inspectedBlock.lat,
                    lng: inspectedBlock.lng,
                    timeWindow: filters.timeWindow,
                  });
                  setInspectedBlock(null);
                } : undefined}
              />
            )
          )}

          {/* Block Comparison */}
          {pinnedBlocks.length > 0 && !routeOpen && !timeLapseActive && (
            <BlockComparison
              blocks={pinnedBlocks}
              currentTimeWindow={filters.timeWindow}
              onUnpin={(geoid) => setPinnedBlocks((prev) => prev.filter((b) => b.geoid !== geoid))}
              onClose={() => setPinnedBlocks([])}
            />
          )}

          {/* Annotations layer */}
          <AnnotationLayer
            map={mapActionsRef.current?.getMap() ?? null}
            active={annotationsOpen}
            onClose={() => setAnnotationsOpen(false)}
          />

          {/* Time Lapse bar */}
          {timeLapseActive && (
            <TimeLapse
              key={mapActionsReady}
              mapActions={mapActionsRef.current}
              onClose={() => setTimeLapseActive(false)}
              onTimeWindowChange={(tw) => updateFilters({ timeWindow: tw })}
            />
          )}
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

        {/* Neighborhood Ranking panel */}
        {rankingOpen && !routeOpen && (
          <NeighborhoodRanking
            timeWindow={filters.timeWindow}
            colorMode={filters.colorMode}
            onFlyTo={(center, zoom) => mapActionsRef.current?.flyTo(center, zoom)}
            onClose={() => setRankingOpen(false)}
          />
        )}
      </div>
    </div>
  );
}
