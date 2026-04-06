"use client";

import { useRef, useEffect, useCallback } from "react";
import { NYC_CENTER, NYC_DEFAULT_ZOOM, type TimeWindow } from "@/app/lib/constants";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ML = any;

export interface SelectedZone {
  geoid: string;
  ntaName: string | null;
  borough: string | null;
  demandScore: number | null;
  lat: number;
  lng: number;
}

interface ForecastMapProps {
  timeWindow: TimeWindow;
  selectedGeoid: string | null;
  onZoneSelect: (zone: SelectedZone | null) => void;
  /** called once with the current bbox demand aggregate after each fetch */
  onBboxAggregate?: (avgDemand: number, zoneCount: number) => void;
}

const DEMAND_COLOR: ML = [
  "interpolate", ["linear"],
  ["to-number", ["coalesce", ["get", "demandScore"], 0], 0],
  0, "#1e293b", 20, "#1e3a5f", 40, "#2563eb", 60, "#fbbf24", 80, "#f97316", 100, "#dc2626",
];

export function ForecastMap({
  timeWindow,
  selectedGeoid,
  onZoneSelect,
  onBboxAggregate,
}: ForecastMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<ML>(null);
  const onSelectRef = useRef(onZoneSelect);
  const onAggRef = useRef(onBboxAggregate);
  const timeWindowRef = useRef(timeWindow);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => { onSelectRef.current = onZoneSelect; }, [onZoneSelect]);
  useEffect(() => { onAggRef.current = onBboxAggregate; }, [onBboxAggregate]);
  useEffect(() => { timeWindowRef.current = timeWindow; }, [timeWindow]);

  const getBboxParams = useCallback((map: ML) => {
    const bounds = map.getBounds();
    if (!bounds) return null;
    return new URLSearchParams({
      west: bounds.getWest().toString(),
      south: bounds.getSouth().toString(),
      east: bounds.getEast().toString(),
      north: bounds.getNorth().toString(),
      timeWindow: timeWindowRef.current,
    });
  }, []);

  const fetchBlocks = useCallback(async (map: ML) => {
    const params = getBboxParams(map);
    if (!params) return;
    try {
      const res = await fetch(`/api/map/blocks?${params}`);
      if (!res.ok) return;
      const geojson = await res.json();
      const source = map.getSource("blocks");
      if (source) source.setData(geojson);

      // Compute bbox aggregate
      if (onAggRef.current && geojson.features) {
        let total = 0, count = 0;
        for (const f of geojson.features) {
          const s = f.properties?.demandScore;
          if (typeof s === "number") { total += s; count++; }
        }
        if (count > 0) onAggRef.current(total / count, count);
      }
    } catch { /* silent */ }
  }, [getBboxParams]);

  const debouncedFetch = useCallback((map: ML) => {
    clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => fetchBlocks(map), 300);
  }, [fetchBlocks]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;
    let removed = false;
    let map: ML = null;
    const el = containerRef.current;

    import("maplibre-gl/dist/maplibre-gl.css").catch(() => {});
    import("maplibre-gl").then((mod) => {
      if (removed) return;
      const maplibregl = mod.default ?? mod;

      map = new (maplibregl as ML).Map({
        container: el,
        style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
        center: NYC_CENTER,
        zoom: NYC_DEFAULT_ZOOM,
        minZoom: 9,
        maxZoom: 18,
      });

      map.addControl(new maplibregl.NavigationControl({}), "top-right");

      map.on("load", () => {
        map.addSource("blocks", {
          type: "geojson",
          data: { type: "FeatureCollection", features: [] },
        });

        map.addLayer({
          id: "blocks-fill",
          type: "fill",
          source: "blocks",
          paint: {
            "fill-color": DEMAND_COLOR,
            "fill-opacity": ["interpolate", ["linear"], ["zoom"], 11, 0.55, 14, 0.65, 16, 0.45],
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

        // Selected zone highlight
        map.addLayer({
          id: "blocks-selected",
          type: "line",
          source: "blocks",
          paint: {
            "line-color": "#f43f5e",
            "line-width": 2.5,
            "line-opacity": 1,
          },
          filter: ["==", ["get", "geoid"], "__none__"],
        });

        // Click to select
        map.on("click", "blocks-fill", (e: ML) => {
          const f = e.features?.[0];
          if (!f) return;
          const props = f.properties ?? {};
          onSelectRef.current({
            geoid: props.geoid,
            ntaName: props.ntaName ?? null,
            borough: props.borough ?? null,
            demandScore: typeof props.demandScore === "number" ? props.demandScore : null,
            lat: e.lngLat.lat,
            lng: e.lngLat.lng,
          });
        });

        map.on("mouseenter", "blocks-fill", () => { map.getCanvas().style.cursor = "crosshair"; });
        map.on("mouseleave", "blocks-fill", () => { map.getCanvas().style.cursor = ""; });

        fetchBlocks(map);
        mapRef.current = map;
      });

      map.on("moveend", () => debouncedFetch(map));
    });

    return () => {
      removed = true;
      clearTimeout(fetchTimerRef.current);
      if (map) map.remove();
      mapRef.current = null;
    };
  }, [fetchBlocks, debouncedFetch]);

  // Refetch when timeWindow changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    fetchBlocks(map);
  }, [timeWindow, fetchBlocks]);

  // Update selected highlight filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const layer = map.getLayer?.("blocks-selected");
    if (!layer) return;
    map.setFilter("blocks-selected", ["==", ["get", "geoid"], selectedGeoid ?? "__none__"]);
  }, [selectedGeoid]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {/* Legend overlay */}
      <div className="absolute bottom-4 left-4 z-10 bg-zinc-900/70 backdrop-blur border border-zinc-800 rounded px-3 py-2 flex items-center gap-3 pointer-events-auto">
        <span className="text-[10px] font-mono text-zinc-400 uppercase tracking-widest">Demand</span>
        <div className="flex items-center gap-2">
          <span className="font-mono text-[9px] text-zinc-500">LOW</span>
          <div
            className="w-32 h-2 rounded-full"
            style={{
              background:
                "linear-gradient(to right, #1e293b 0%, #1e3a5f 20%, #2563eb 40%, #fbbf24 60%, #f97316 80%, #dc2626 100%)",
            }}
          />
          <span className="font-mono text-[9px] text-zinc-500">PEAK</span>
        </div>
      </div>
    </div>
  );
}
