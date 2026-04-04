"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { NYC_CENTER, NYC_DEFAULT_ZOOM } from "@/app/lib/constants";
import type { MapFilters } from "@/app/map/page";
import { WeatherWidget } from "./WeatherWidget";

interface MapCanvasProps {
  filters: MapFilters;
}

export function MapCanvas({ filters }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const filtersRef = useRef(filters);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  useEffect(() => { filtersRef.current = filters; }, [filters]);

  // Build bbox params from map bounds
  const getBboxParams = useCallback((map: maplibregl.Map) => {
    const bounds = map.getBounds();
    if (!bounds) return null;
    return new URLSearchParams({
      west: bounds.getWest().toString(),
      south: bounds.getSouth().toString(),
      east: bounds.getEast().toString(),
      north: bounds.getNorth().toString(),
    });
  }, []);

  // Fetch blocks
  const fetchBlocks = useCallback(async (map: maplibregl.Map) => {
    const params = getBboxParams(map);
    if (!params) return;
    params.set("timeWindow", filtersRef.current.timeWindow);
    try {
      const res = await fetch(`/api/map/blocks?${params}`);
      if (!res.ok) return;
      const geojson = await res.json();
      const source = map.getSource("blocks") as maplibregl.GeoJSONSource;
      if (source) source.setData(geojson);
    } catch { /* silent */ }
  }, [getBboxParams]);

  // Fetch competitors
  const fetchCompetitors = useCallback(async (map: maplibregl.Map) => {
    const params = getBboxParams(map);
    if (!params) return;
    try {
      const res = await fetch(`/api/map/competitors?${params}`);
      if (!res.ok) return;
      const geojson = await res.json();
      const source = map.getSource("competitors") as maplibregl.GeoJSONSource;
      if (source) source.setData(geojson);
    } catch { /* silent */ }
  }, [getBboxParams]);

  // Fetch all data
  const fetchAll = useCallback(async (map: maplibregl.Map) => {
    setLoading(true);
    const f = filtersRef.current;
    const fetches = [fetchBlocks(map)];
    if (f.overlays.has("competitors")) fetches.push(fetchCompetitors(map));
    await Promise.all(fetches);
    setLoading(false);
  }, [fetchBlocks, fetchCompetitors]);

  const debouncedFetch = useCallback((map: maplibregl.Map) => {
    clearTimeout(fetchTimerRef.current);
    fetchTimerRef.current = setTimeout(() => fetchAll(map), 300);
  }, [fetchAll]);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://tiles.openfreemap.org/styles/dark",
      center: NYC_CENTER,
      zoom: NYC_DEFAULT_ZOOM,
      minZoom: 9,
      maxZoom: 18,
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
          "fill-color": [
            "interpolate", ["linear"],
            ["to-number", ["coalesce", ["get", "demandScore"], 0], 0],
            0, "#1e293b",
            20, "#1e3a5f",
            40, "#2563eb",
            60, "#fbbf24",
            80, "#f97316",
            100, "#dc2626",
          ],
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

      // ── Block click popup ──
      map.on("click", "blocks-fill", (e) => {
        if (!e.features?.length) return;
        const p = e.features[0].properties!;
        const demand = p.demandScore != null ? Math.round(p.demandScore as number) : "N/A";
        const opp = p.compositeScore != null ? Math.round(p.compositeScore as number) : "N/A";
        new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
          .setLngLat(e.lngLat)
          .setHTML(
            `<div style="font-family:Inter,system-ui,sans-serif">
              <div style="font-size:13px;font-weight:700;margin-bottom:4px">${p.ntaName || p.geoid}</div>
              ${p.borough ? `<div style="font-size:10px;color:#94a3b8;margin-bottom:6px">${p.borough}</div>` : ""}
              <div style="display:flex;gap:12px;margin-bottom:6px">
                <div><span style="font-size:10px;color:#64748b">Demand</span><br><strong style="font-size:16px;color:#fbbf24">${demand}</strong></div>
                <div><span style="font-size:10px;color:#64748b">Opportunity</span><br><strong style="font-size:16px;color:#22c55e">${opp}</strong></div>
              </div>
              <div style="font-size:10px;color:#64748b">
                Jobs: ${p.totalJobs ?? "—"} · Subway: ${p.nearestSubwayMeters != null ? Math.round(p.nearestSubwayMeters as number) + "m" : "—"}
              </div>
            </div>`
          )
          .addTo(map);
      });

      map.on("mouseenter", "blocks-fill", () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", "blocks-fill", () => { map.getCanvas().style.cursor = ""; });

      fetchAll(map);
    });

    map.on("moveend", () => debouncedFetch(map));

    mapRef.current = map;
    return () => { clearTimeout(fetchTimerRef.current); map.remove(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Refetch when filters change
  const fetchKey = `${filters.timeWindow}|${filters.vertical}|${filters.minDemand}|${[...filters.overlays].sort().join(",")}`;
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
  }, [filters.overlays]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <WeatherWidget />
      {loading && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-zinc-900/90 text-xs text-zinc-400 px-3 py-1.5 rounded-full border border-zinc-800">
          Loading...
        </div>
      )}
    </>
  );
}
