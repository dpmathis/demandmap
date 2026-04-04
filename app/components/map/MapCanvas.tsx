"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { NYC_CENTER, NYC_DEFAULT_ZOOM } from "@/app/lib/constants";
import type { MapFilters } from "@/app/map/page";
import { WeatherWidget } from "./WeatherWidget";

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

interface MapCanvasProps {
  filters: MapFilters;
  onAddStop?: (block: BlockClickData) => void;
  routeMode?: boolean;
}

export function MapCanvas({ filters, onAddStop, routeMode }: MapCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const filtersRef = useRef(filters);
  const onAddStopRef = useRef(onAddStop);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  useEffect(() => { filtersRef.current = filters; }, [filters]);
  useEffect(() => { onAddStopRef.current = onAddStop; }, [onAddStop]);

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

  useEffect(() => {
    if (!containerRef.current) return;

    let map: maplibregl.Map;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: {
          version: 8,
          sources: {
            "carto-dark": {
              type: "raster",
              tiles: [
                "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
                "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
              ],
              tileSize: 256,
              attribution: "©OpenStreetMap ©CARTO",
            },
          },
          layers: [{ id: "carto-dark", type: "raster", source: "carto-dark" }],
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any,
        center: NYC_CENTER,
        zoom: NYC_DEFAULT_ZOOM,
        minZoom: 9,
        maxZoom: 18,
      });
    } catch (err) {
      setMapError(err instanceof Error ? err.message : "Map failed to initialize");
      return;
    }

    map.on("error", (e) => {
      console.error("MapLibre error:", e.error?.message ?? e);
      setMapError(e.error?.message ?? "Map error");
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
        const demand = p.demandScore != null ? Math.round(p.demandScore as number) : null;
        const opp = p.compositeScore != null ? Math.round(p.compositeScore as number) : null;

        // Build popup DOM so we can attach event handlers
        const el = document.createElement("div");
        el.style.fontFamily = "Inter, system-ui, sans-serif";

        const header = document.createElement("div");
        header.style.cssText = "font-size:13px;font-weight:700;margin-bottom:4px";
        header.textContent = String(p.ntaName || p.geoid || "");
        el.appendChild(header);

        if (p.borough) {
          const sub = document.createElement("div");
          sub.style.cssText = "font-size:10px;color:#94a3b8;margin-bottom:6px";
          sub.textContent = String(p.borough);
          el.appendChild(sub);
        }

        const scores = document.createElement("div");
        scores.style.cssText = "display:flex;gap:12px;margin-bottom:6px";
        scores.innerHTML = `
          <div><span style="font-size:10px;color:#64748b">Demand</span><br>
            <strong style="font-size:16px;color:#fbbf24">${demand ?? "N/A"}</strong></div>
          <div><span style="font-size:10px;color:#64748b">Opportunity</span><br>
            <strong style="font-size:16px;color:#22c55e">${opp ?? "N/A"}</strong></div>
        `;
        el.appendChild(scores);

        const meta = document.createElement("div");
        meta.style.cssText = "font-size:10px;color:#64748b;margin-bottom:8px";
        const subwayText = p.nearestSubwayMeters != null ? Math.round(p.nearestSubwayMeters as number) + "m" : "—";
        meta.textContent = `Jobs: ${p.totalJobs ?? "—"} · Subway: ${subwayText}`;
        el.appendChild(meta);

        // "Add to Route" button — only shown when onAddStop is available
        const popup = new maplibregl.Popup({ closeButton: true, maxWidth: "260px" })
          .setLngLat(e.lngLat)
          .setDOMContent(el)
          .addTo(map);

        const cb = onAddStopRef.current;
        if (cb) {
          const btn = document.createElement("button");
          btn.textContent = "+ Add to Route";
          btn.style.cssText = `
            width:100%;padding:6px 0;background:#0f766e;color:white;
            border:none;border-radius:8px;font-size:11px;font-weight:600;
            cursor:pointer;transition:background .15s
          `;
          btn.onmouseover = () => { btn.style.background = "#0d9488"; };
          btn.onmouseout = () => { btn.style.background = "#0f766e"; };
          btn.onclick = () => {
            cb({
              geoid: String(p.geoid ?? ""),
              ntaName: p.ntaName != null ? String(p.ntaName) : null,
              borough: p.borough != null ? String(p.borough) : null,
              demandScore: demand,
              compositeScore: opp,
              lat: e.lngLat.lat,
              lng: e.lngLat.lng,
              timeWindow: filtersRef.current.timeWindow,
            });
            popup.remove();
          };
          el.appendChild(btn);
        }
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

  const fetchKey = `${filters.timeWindow}|${filters.vertical}|${filters.minDemand}|${[...filters.overlays].sort().join(",")}`;
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    fetchAll(map);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

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
      {mapError && (
        <div className="absolute inset-0 flex items-center justify-center z-20 bg-zinc-950/80">
          <div className="bg-zinc-900 border border-red-800 rounded-xl p-4 max-w-xs text-center">
            <p className="text-xs font-bold text-red-400 mb-1">Map Error</p>
            <p className="text-[11px] text-zinc-400">{mapError}</p>
          </div>
        </div>
      )}
      <WeatherWidget />
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
