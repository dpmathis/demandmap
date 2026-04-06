"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import { NYC_CENTER, NYC_DEFAULT_ZOOM, type ColorMode } from "@/app/lib/constants";
import type { MapFilters } from "@/app/(dashboard)/map/page";
import type { InspectedBlock } from "./BlockInspector";
import { WeatherWidget } from "./WeatherWidget";
import { MapLegend } from "./MapLegend";
import { InsightCard, type InsightState } from "./InsightCard";

function getBlockFillColor(mode: ColorMode): ML {
  switch (mode) {
    case "demand":
      return [
        "interpolate", ["linear"],
        ["to-number", ["coalesce", ["get", "demandScore"], 0], 0],
        0, "#1e293b", 20, "#1e3a5f", 40, "#2563eb", 60, "#fbbf24", 80, "#f97316", 100, "#dc2626",
      ];
    case "gap":
      return [
        "interpolate", ["linear"],
        ["to-number", ["coalesce", ["get", "gapScore"], 0], 0],
        0, "#1e293b", 20, "#065f46", 40, "#059669", 60, "#34d399", 80, "#a855f7", 100, "#7c3aed",
      ];
    case "competitors": {
      const total = ["+",
        ["to-number", ["coalesce", ["get", "specialtyCount500m"], 0], 0],
        ["to-number", ["coalesce", ["get", "premiumCount500m"], 0], 0],
        ["to-number", ["coalesce", ["get", "mainstreamCount500m"], 0], 0],
      ];
      return [
        "interpolate", ["linear"], total,
        0, "#22c55e", 3, "#86efac", 6, "#fbbf24", 10, "#3b82f6", 20, "#1e3a5f",
      ];
    }
    case "transit":
      return [
        "interpolate", ["linear"],
        ["to-number", ["coalesce", ["get", "nearestSubwayMeters"], 2000], 2000],
        0, "#dc2626", 200, "#f97316", 500, "#fbbf24", 1000, "#2563eb", 2000, "#1e293b",
      ];
  }
}

export interface BlockClickData {
  geoid: string;
  ntaName: string | null;
  borough: string | null;
  demandScore: number | null;
  compositeScore: number | null;
  lat: number;
  lng: number;
  timeWindow: string;
}

export interface MapActions {
  flyTo: (center: [number, number], zoom: number) => void;
  setBlocksData: (geojson: unknown) => void;
  getBbox: () => { west: number; south: number; east: number; north: number } | null;
  getCamera: () => { center: [number, number]; zoom: number } | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getMap: () => any;
}

interface MapCanvasProps {
  filters: MapFilters;
  pinnedGeoids?: string[];
  onAddStop?: (block: BlockClickData) => void;
  onBlockInspect?: (block: InspectedBlock) => void;
  onMapReady?: (map: MapActions) => void;
  routeMode?: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ML = any; // MapLibre types — the library is loaded dynamically

export function MapCanvas({ filters, pinnedGeoids, onAddStop, onBlockInspect, onMapReady, routeMode }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ML>(null);
  const mlRef = useRef<ML>(null); // the maplibregl module
  const filtersRef = useRef(filters);
  const onAddStopRef = useRef(onAddStop);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [overlayCounts, setOverlayCounts] = useState<Record<string, number>>({});
  const [insight, setInsight] = useState<InsightState | null>(null);
  const insightCacheRef = useRef<Map<string, string>>(new Map());
  const insightDwellRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const insightLastRequestRef = useRef<number>(0);

  const onBlockInspectRef = useRef(onBlockInspect);

  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { onAddStopRef.current = onAddStop; }, [onAddStop]);
  useEffect(() => { onBlockInspectRef.current = onBlockInspect; }, [onBlockInspect]);

  const getBboxParams = useCallback((map: ML) => {
    const bounds = map.getBounds();
    if (!bounds) return null;
    return new URLSearchParams({
      west: bounds.getWest().toString(),
      south: bounds.getSouth().toString(),
      east: bounds.getEast().toString(),
      north: bounds.getNorth().toString(),
    });
  }, []);

  const fetchBlocks = useCallback(async (map: ML) => {
    const params = getBboxParams(map);
    if (!params) return;
    const f = filtersRef.current;
    params.set("timeWindow", f.timeWindow);
    if (f.vertical && f.vertical !== "coffee") params.set("vertical", f.vertical);
    if (f.boroughs.size > 0) params.set("boroughs", [...f.boroughs].join(","));
    if (f.maxCompetitors < 100) params.set("maxCompetitors", String(f.maxCompetitors));
    try {
      const res = await fetch(`/api/map/blocks?${params}`);
      if (!res.ok) return;
      const geojson = await res.json();
      const source = map.getSource("blocks");
      if (source) source.setData(geojson);
    } catch { /* silent */ }
  }, [getBboxParams]);

  const fetchCompetitors = useCallback(async (map: ML) => {
    const params = getBboxParams(map);
    if (!params) return;
    const f = filtersRef.current;
    if (f.competitorTiers.size > 0 && f.competitorTiers.size < 3) {
      params.set("tiers", [...f.competitorTiers].join(","));
    }
    if (f.chainFilter !== "all") params.set("chainFilter", f.chainFilter);
    params.set("vertical", f.vertical);
    try {
      const res = await fetch(`/api/map/competitors?${params}`);
      if (!res.ok) { setOverlayCounts((p) => ({ ...p, competitors: -1 })); return; }
      const geojson = await res.json();
      const source = map.getSource("competitors");
      if (source) source.setData(geojson);
      setOverlayCounts((p) => ({ ...p, competitors: geojson.features?.length ?? 0 }));
    } catch { setOverlayCounts((p) => ({ ...p, competitors: -2 })); }
  }, [getBboxParams]);

  const fetchStations = useCallback(async (map: ML) => {
    const params = getBboxParams(map);
    if (!params) return;
    try {
      const res = await fetch(`/api/map/stations?${params}`);
      if (!res.ok) { setOverlayCounts((p) => ({ ...p, transit: -1 })); return; }
      const geojson = await res.json();
      const source = map.getSource("stations");
      if (source) source.setData(geojson);
      setOverlayCounts((p) => ({ ...p, transit: geojson.features?.length ?? 0 }));
    } catch { setOverlayCounts((p) => ({ ...p, transit: -2 })); }
  }, [getBboxParams]);

  const fetchBusyness = useCallback(async (map: ML) => {
    const params = getBboxParams(map);
    if (!params) return;
    try {
      const res = await fetch(`/api/map/busyness?${params}`);
      if (!res.ok) { setOverlayCounts((p) => ({ ...p, busyness: -1 })); return; }
      const geojson = await res.json();
      const source = map.getSource("busyness");
      if (source) source.setData(geojson);
      setOverlayCounts((p) => ({ ...p, busyness: geojson.features?.length ?? 0 }));
    } catch { setOverlayCounts((p) => ({ ...p, busyness: -2 })); }
  }, [getBboxParams]);

  const fetchEvents = useCallback(async (map: ML) => {
    try {
      const res = await fetch("/api/map/events");
      if (!res.ok) { setOverlayCounts((p) => ({ ...p, events: -1 })); return; }
      const geojson = await res.json();
      const source = map.getSource("events");
      if (source) source.setData(geojson);
      setOverlayCounts((p) => ({ ...p, events: geojson.features?.length ?? 0 }));
    } catch { setOverlayCounts((p) => ({ ...p, events: -2 })); }
  }, []);

  const fetchClosures = useCallback(async (map: ML) => {
    try {
      const res = await fetch("/api/map/closures");
      if (!res.ok) { setOverlayCounts((p) => ({ ...p, closures: -1 })); return; }
      const geojson = await res.json();
      const source = map.getSource("closures");
      if (source) source.setData(geojson);
      setOverlayCounts((p) => ({ ...p, closures: geojson.features?.length ?? 0 }));
    } catch { setOverlayCounts((p) => ({ ...p, closures: -2 })); }
  }, []);

  const fetchAll = useCallback(async (map: ML) => {
    setLoading(true);
    const f = filtersRef.current;
    const fetches = [fetchBlocks(map)];
    if (f.overlays.has("competitors")) fetches.push(fetchCompetitors(map));
    if (f.overlays.has("transit")) fetches.push(fetchStations(map));
    if (f.overlays.has("busyness")) fetches.push(fetchBusyness(map));
    if (f.overlays.has("events")) fetches.push(fetchEvents(map));
    if (f.overlays.has("closures")) fetches.push(fetchClosures(map));
    await Promise.all(fetches);
    setLoading(false);
  }, [fetchBlocks, fetchCompetitors, fetchStations, fetchBusyness, fetchEvents, fetchClosures]);

  const debouncedFetch = useCallback((map: ML) => {
    clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => fetchAll(map), 300);
  }, [fetchAll]);

  // Initialize map — dynamic import to avoid Turbopack SSR/bundling issues
  useEffect(() => {
    if (!containerRef.current) return;
    let removed = false;
    let map: ML = null;

    const el = containerRef.current;

    // Dynamic CSS import (required for Turbopack compatibility)
    import("maplibre-gl/dist/maplibre-gl.css").catch(() => {});

    import("maplibre-gl").then((mod) => {
      if (removed) return;
      const maplibregl = mod.default ?? mod;
      mlRef.current = maplibregl;

      map = new (maplibregl as ML).Map({
        container: el,
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        center: NYC_CENTER,
        zoom: NYC_DEFAULT_ZOOM,
        minZoom: 9,
        maxZoom: 18,
      });

      map.on("error", (e: ML) => {
        console.error("MapLibre error:", e.error?.message ?? e);
      });

      map.addControl(new maplibregl.NavigationControl({}), "top-right");

      map.on("load", () => {
        // ── Blocks ──
        map.addSource("blocks", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "blocks-fill",
          type: "fill",
          source: "blocks",
          paint: {
            "fill-color": getBlockFillColor(filtersRef.current.colorMode),
            "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.5, 14, 0.6, 16, 0.4],
          },
        });

        map.addLayer({
          id: "blocks-outline",
          type: "line",
          source: "blocks",
          paint: {
            "line-color": "#334155",
            "line-width": ["interpolate", ["linear"], ["zoom"], 11, 0.2, 14, 0.5],
            "line-opacity": 0.5,
          },
        });

        map.addLayer({
          id: "blocks-pinned",
          type: "line",
          source: "blocks",
          paint: {
            "line-color": "#14b8a6",
            "line-width": 2.5,
            "line-opacity": 1,
          },
          filter: ["==", ["get", "geoid"], "__none__"],
        });

        // ── Competitors ──
        map.addSource("competitors", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "competitors-circle",
          type: "circle",
          source: "competitors",
          minzoom: 11,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 2, 14, 4, 16, 7],
            "circle-color": [
              "match", ["get", "qualityTier"],
              "specialty", "#E85D26",
              "premium", "#028090",
              "mainstream", "#94A3B8",
              "#94A3B8",
            ],
            "circle-stroke-color": "#0a0f1e",
            "circle-stroke-width": 1,
            "circle-opacity": 0.9,
          },
        });

        // ── Transit Stations ──
        map.addSource("stations", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "stations-circle",
          type: "circle",
          source: "stations",
          minzoom: 11,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 11, 3, 14, 5, 16, 8],
            "circle-color": "#38bdf8",
            "circle-stroke-color": "#0a0f1e",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.85,
          },
          layout: { visibility: "none" },
        });

        // ── Station Busyness ──
        map.addSource("busyness", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "busyness-circle",
          type: "circle",
          source: "busyness",
          minzoom: 11,
          paint: {
            "circle-radius": [
              "interpolate", ["linear"],
              ["to-number", ["coalesce", ["get", "busynessScore"], 0], 0],
              0, 3, 50, 8, 100, 16,
            ],
            "circle-color": [
              "interpolate", ["linear"],
              ["to-number", ["coalesce", ["get", "busynessScore"], 0], 0],
              0, "#334155", 30, "#38bdf8", 60, "#fbbf24", 90, "#dc2626",
            ],
            "circle-stroke-color": "#0a0f1e",
            "circle-stroke-width": 1,
            "circle-opacity": 0.8,
          },
          layout: { visibility: "none" },
        });

        // ── Events ──
        map.addSource("events", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "events-circle",
          type: "circle",
          source: "events",
          minzoom: 9,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 5, 12, 8, 14, 11, 16, 14],
            "circle-color": "#d946ef",
            "circle-stroke-color": "#ffffff",
            "circle-stroke-width": 2,
            "circle-opacity": 0.95,
          },
          layout: { visibility: "none" },
        });

        // ── Closures ──
        map.addSource("closures", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "closures-circle",
          type: "circle",
          source: "closures",
          minzoom: 10,
          paint: {
            "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 3, 14, 6, 16, 9],
            "circle-color": "#ef4444",
            "circle-stroke-color": "#0a0f1e",
            "circle-stroke-width": 1.5,
            "circle-opacity": 0.85,
          },
          layout: { visibility: "none" },
        });

        // ── Block click ──
        map.on("click", "blocks-fill", (e: ML) => {
          if (!e.features?.length) return;
          const p = e.features[0].properties!;
          const demand = p.demandScore != null ? Math.round(p.demandScore as number) : null;
          const opp = p.compositeScore != null ? Math.round(p.compositeScore as number) : null;
          const geoid = String(p.geoid ?? "");
          const ntaName = p.ntaName != null ? String(p.ntaName) : null;
          const borough = p.borough != null ? String(p.borough) : null;

          // Open block inspector panel
          const inspectCb = onBlockInspectRef.current;
          if (inspectCb) {
            inspectCb({
              geoid,
              ntaName,
              borough,
              demandScore: demand,
              compositeScore: opp,
              gapScore: p.gapScore != null ? Number(p.gapScore) : null,
              supplyScore: p.supplyScore != null ? Number(p.supplyScore) : null,
              totalJobs: p.totalJobs != null ? Number(p.totalJobs) : null,
              totalOfficeSqft: p.totalOfficeSqft != null ? Number(p.totalOfficeSqft) : null,
              totalResUnits: p.totalResUnits != null ? Number(p.totalResUnits) : null,
              nearestSubwayMeters: p.nearestSubwayMeters != null ? Number(p.nearestSubwayMeters) : null,
              subwayLines: p.subwayLines != null ? String(p.subwayLines) : null,
              primaryLandUse: p.primaryLandUse != null ? String(p.primaryLandUse) : null,
              specialtyCount500m: p.specialtyCount500m != null ? Number(p.specialtyCount500m) : null,
              premiumCount500m: p.premiumCount500m != null ? Number(p.premiumCount500m) : null,
              mainstreamCount500m: p.mainstreamCount500m != null ? Number(p.mainstreamCount500m) : null,
              lat: e.lngLat.lat,
              lng: e.lngLat.lng,
            });
            return;
          }

          // Fallback: add to route directly if in route mode
          const cb = onAddStopRef.current;
          if (cb) {
            cb({
              geoid, ntaName, borough,
              demandScore: demand, compositeScore: opp,
              lat: e.lngLat.lat, lng: e.lngLat.lng,
              timeWindow: filtersRef.current.timeWindow,
            });
          }
        });

        map.on("mouseenter", "blocks-fill", () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", "blocks-fill", () => {
          map.getCanvas().style.cursor = "";
          clearTimeout(insightDwellRef.current);
          setInsight(null);
        });

        // ── AI insight hover dwell ──
        map.on("mousemove", "blocks-fill", (e: ML) => {
          clearTimeout(insightDwellRef.current);
          if (!filtersRef.current.aiInsights) return;
          if (!e.features?.length) return;
          const p = e.features[0].properties!;
          const geoid = String(p.geoid ?? "");
          const timeWindow = filtersRef.current.timeWindow;
          const cacheKey = `${geoid}|${timeWindow}`;
          const cached = insightCacheRef.current.get(cacheKey);
          const ntaName = p.ntaName != null ? String(p.ntaName) : null;
          const borough = p.borough != null ? String(p.borough) : null;
          const demandScore = p.demandScore != null ? Number(p.demandScore) : null;
          const competitorCount =
            (p.specialtyCount500m != null ? Number(p.specialtyCount500m) : 0) +
            (p.premiumCount500m != null ? Number(p.premiumCount500m) : 0) +
            (p.mainstreamCount500m != null ? Number(p.mainstreamCount500m) : 0);

          // Cached — show immediately
          if (cached) {
            setInsight({ x: e.point.x, y: e.point.y, loading: false, text: cached, ntaName });
            return;
          }

          // Dwell 1s before firing request, rate-limited to 1/3s
          insightDwellRef.current = setTimeout(() => {
            const now = Date.now();
            if (now - insightLastRequestRef.current < 3000) return;
            insightLastRequestRef.current = now;

            setInsight({ x: e.point.x, y: e.point.y, loading: true, text: null, ntaName });

            fetch("/api/map/insights", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ geoid, ntaName, borough, demandScore, timeWindow, competitorCount }),
            })
              .then((r) => r.json())
              .then((d) => {
                if (d.insight) {
                  insightCacheRef.current.set(cacheKey, d.insight);
                  setInsight((prev) => (prev ? { ...prev, loading: false, text: d.insight } : null));
                } else {
                  setInsight(null);
                }
              })
              .catch(() => setInsight(null));
          }, 1000);
        });

        fetchAll(map);
      });

      map.on("moveend", () => debouncedFetch(map));
      mapRef.current = map;
      if (onMapReady) {
        onMapReady({
          flyTo: (center: [number, number], zoom: number) => {
            map.flyTo({ center, zoom, duration: 1500 });
          },
          setBlocksData: (geojson: unknown) => {
            const source = map.getSource("blocks");
            if (source) source.setData(geojson);
          },
          getBbox: () => {
            const bounds = map.getBounds();
            if (!bounds) return null;
            return {
              west: bounds.getWest(),
              south: bounds.getSouth(),
              east: bounds.getEast(),
              north: bounds.getNorth(),
            };
          },
          getCamera: () => {
            const c = map.getCenter();
            if (!c) return null;
            return { center: [c.lng, c.lat] as [number, number], zoom: map.getZoom() };
          },
          getMap: () => map,
        });
      }
    }).catch((err) => {
      setMapError(err instanceof Error ? err.message : "Failed to load map library");
    });

    return () => {
      removed = true;
      clearTimeout(fetchTimerRef.current);
      clearTimeout(insightDwellRef.current);
      if (map) map.remove();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when filters change
  const fetchKey = `${filters.timeWindow}|${filters.vertical}|${filters.minDemand}|${[...filters.overlays].sort().join(",")}|${[...filters.boroughs].sort().join(",")}|${[...filters.competitorTiers].sort().join(",")}|${filters.chainFilter}|${filters.maxCompetitors}`;
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    fetchAll(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  // Toggle overlay visibility
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const setVis = (id: string, visible: boolean) => {
      if (map.getLayer(id)) map.setLayoutProperty(id, "visibility", visible ? "visible" : "none");
    };
    setVis("competitors-circle", filters.overlays.has("competitors"));
    setVis("stations-circle", filters.overlays.has("transit"));
    setVis("busyness-circle", filters.overlays.has("busyness"));
    setVis("events-circle", filters.overlays.has("events"));
    setVis("closures-circle", filters.overlays.has("closures"));
  }, [filters.overlays]);

  // Update block fill color when colorMode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("blocks-fill")) return;
    map.setPaintProperty("blocks-fill", "fill-color", getBlockFillColor(filters.colorMode));
  }, [filters.colorMode]);

  // Update pinned-block outline filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.getLayer("blocks-pinned")) return;
    const ids = pinnedGeoids ?? [];
    if (ids.length === 0) {
      map.setFilter("blocks-pinned", ["==", ["get", "geoid"], "__none__"]);
    } else {
      map.setFilter("blocks-pinned", [
        "match",
        ["get", "geoid"],
        ids,
        true,
        false,
      ]);
    }
  }, [pinnedGeoids]);

  // Clear any shown insight when toggled off
  useEffect(() => {
    if (!filters.aiInsights) {
      clearTimeout(insightDwellRef.current);
      setInsight(null);
    }
  }, [filters.aiInsights]);

  return (
    <>
      <div ref={containerRef} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-zinc-950/80">
          <div className="bg-zinc-900 border border-red-800 rounded-xl p-4 max-w-xs text-center">
            <p className="text-xs font-bold text-red-400 mb-1">Map Error</p>
            <p className="text-[11px] text-zinc-400">{mapError}</p>
          </div>
        </div>
      )}
      <WeatherWidget />
      <MapLegend colorMode={filters.colorMode} />
      <InsightCard state={insight} />
      {routeMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-teal-900/80 text-xs text-teal-300 px-3 py-1.5 rounded-full border border-teal-700/50 backdrop-blur pointer-events-none">
          Click a block to add it to your route
        </div>
      )}
      {loading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-zinc-900/90 text-xs text-zinc-400 px-3 py-1.5 rounded-full border border-zinc-800">
          Loading...
        </div>
      )}
    </>
  );
}
