"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, TrendingDown, Crosshair, Cloud, CloudRain, CloudSnow, CloudFog, Sun, Zap, LayoutDashboard, Map, Route, Calendar, Users, Settings, LogOut } from "lucide-react";
import { createClient } from "@/app/lib/supabase/client";
import {
  TIME_WINDOWS,
  DEFAULT_TIME_WINDOW,
  type TimeWindow,
} from "@/app/lib/constants";
import { ForecastMap, type SelectedZone } from "@/app/components/forecast/ForecastMap";
import { HorizonSelector, type Horizon } from "@/app/components/forecast/HorizonSelector";
import { HourlyChart } from "@/app/components/forecast/HourlyChart";
import { ZoneDrilldown } from "@/app/components/forecast/ZoneDrilldown";
import { WeeklyRhythm } from "@/app/components/forecast/WeeklyRhythm";

interface WeatherData {
  current: {
    temp: number;
    feelsLike: number;
    description: string;
    icon: string;
    precipitation: number;
  };
  forecast: Array<{ dt: number; temp: number; pop: number; icon: string }>;
}

function weatherIconComponent(icon: string) {
  switch (icon) {
    case "clear": return Sun;
    case "cloudy": return Cloud;
    case "rain": return CloudRain;
    case "snow": return CloudSnow;
    case "fog": return CloudFog;
    case "thunder": return Zap;
    default: return Cloud;
  }
}

/** Map current wall-clock hour to a TimeWindow. */
function currentTimeWindow(): TimeWindow {
  const h = new Date().getHours();
  for (const tw of TIME_WINDOWS) {
    const [startStr, endStr] = tw.split("-");
    const start = parseInt(startStr, 10);
    const end = parseInt(endStr, 10);
    if (h >= start && h < end) return tw;
  }
  // Before 7am or after 9pm → default to first/last window
  return h < 7 ? "07-09" : "19-21";
}

function findPeak(windows: Record<string, number | null>): { tw: TimeWindow | null; score: number | null } {
  let peakTw: TimeWindow | null = null;
  let peakScore = -1;
  for (const tw of TIME_WINDOWS) {
    const s = windows[tw];
    if (s != null && s > peakScore) {
      peakScore = s;
      peakTw = tw;
    }
  }
  return { tw: peakTw, score: peakTw ? peakScore : null };
}

function dayAverage(windows: Record<string, number | null>): number | null {
  const vals = TIME_WINDOWS.map((tw) => windows[tw]).filter((v): v is number => v != null);
  if (vals.length === 0) return null;
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

function ForecastContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = createClient();

  const urlGeoid = searchParams.get("geoid");
  const urlHorizon = (searchParams.get("horizon") as Horizon | null) ?? "today";

  const [horizon, setHorizon] = useState<Horizon>(urlHorizon);
  const [selected, setSelected] = useState<SelectedZone | null>(null);
  const [zoneWindows, setZoneWindows] = useState<Record<string, number | null>>({});
  const [zoneLoading, setZoneLoading] = useState(false);
  const [cityAggregate, setCityAggregate] = useState<{ avgDemand: number; zoneCount: number } | null>(null);
  const [citywideBaselines, setCitywideBaselines] = useState<Record<string, number>>({});
  const [weather, setWeather] = useState<WeatherData | null>(null);

  const activeWindow = useMemo(() => currentTimeWindow(), []);
  const mapTimeWindow: TimeWindow = horizon === "1h" ? activeWindow : DEFAULT_TIME_WINDOW;

  // Sync URL when selection or horizon changes
  useEffect(() => {
    const params = new URLSearchParams();
    if (selected) params.set("geoid", selected.geoid);
    if (horizon !== "today") params.set("horizon", horizon);
    const qs = params.toString();
    router.replace(qs ? `/forecast?${qs}` : "/forecast", { scroll: false });
  }, [selected, horizon, router]);

  // Load citywide baselines + weather once
  useEffect(() => {
    fetch("/api/forecast/baselines")
      .then((r) => (r.ok ? r.json() : { windows: {} }))
      .then((data) => setCitywideBaselines(data.windows ?? {}))
      .catch(() => {});
    fetch("/api/map/weather")
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => data && setWeather(data))
      .catch(() => {});
  }, []);

  // Restore selection from URL on mount
  useEffect(() => {
    if (urlGeoid && !selected) {
      // Fetch metadata for the geoid by hitting its demand endpoint and probing blocks
      fetch(`/api/map/blocks/${urlGeoid}/demand`)
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.geoid) {
            setSelected({
              geoid: data.geoid,
              ntaName: null,
              borough: null,
              demandScore: null,
              lat: 0,
              lng: 0,
            });
          }
        })
        .catch(() => {});
    }
    // Only on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch hourly curve for selected zone
  useEffect(() => {
    if (!selected) {
      setZoneWindows({});
      return;
    }
    setZoneLoading(true);
    fetch(`/api/map/blocks/${selected.geoid}/demand`)
      .then((r) => (r.ok ? r.json() : { windows: {} }))
      .then((data) => setZoneWindows(data.windows ?? {}))
      .catch(() => setZoneWindows({}))
      .finally(() => setZoneLoading(false));
  }, [selected]);

  const handleZoneSelect = useCallback((zone: SelectedZone | null) => {
    setSelected(zone);
  }, []);

  const handleBboxAggregate = useCallback((avgDemand: number, zoneCount: number) => {
    setCityAggregate({ avgDemand, zoneCount });
  }, []);

  // Compute delta / peak
  const peak = findPeak(zoneWindows);
  const currentScore = selected ? zoneWindows[activeWindow] ?? null : null;
  // Baseline = citywide average for the active window
  const baselineForActive = citywideBaselines[activeWindow] ?? dayAverage(zoneWindows);

  const citywideDelta = useMemo(() => {
    if (!cityAggregate) return null;
    // Compare visible viewport avg to citywide all-day avg
    const baselineVals = Object.values(citywideBaselines);
    const baseline = baselineVals.length > 0
      ? baselineVals.reduce((a, b) => a + b, 0) / baselineVals.length
      : 50;
    if (baseline === 0) return null;
    const pct = ((cityAggregate.avgDemand - baseline) / baseline) * 100;
    return Math.round(pct * 10) / 10;
  }, [cityAggregate, citywideBaselines]);

  // Chart baseline = real citywide per-window averages
  const chartBaseline = useMemo(() => {
    const b: Record<string, number | null> = {};
    for (const tw of TIME_WINDOWS) {
      b[tw] = citywideBaselines[tw] ?? null;
    }
    return b;
  }, [citywideBaselines]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      {/* Nav bar */}
      <nav className="flex items-center justify-between px-3 h-11 bg-zinc-900/80 backdrop-blur border-b border-zinc-800 shrink-0 z-20">
        <div className="flex items-center gap-2">
          <span className="flex items-baseline gap-1.5">
            <span className="text-base font-semibold tracking-tight text-zinc-100">DemandMap</span>
            <span className="font-mono text-[10px] text-zinc-500">NYC</span>
          </span>
          <div className="flex items-center gap-0.5 ml-3">
            <button onClick={() => router.push("/")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <LayoutDashboard size={13} /> Dashboard
            </button>
            <button onClick={() => router.push("/map")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <Map size={13} /> Explorer
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-500/15 text-teal-400">
              <TrendingUp size={13} /> Forecast
            </button>
            <button onClick={() => router.push("/routes")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <Route size={13} /> Routes
            </button>
            <button onClick={() => router.push("/planner")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <Calendar size={13} /> Planner
            </button>
            <button onClick={() => router.push("/team")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <Users size={13} /> Team
            </button>
            <button onClick={() => router.push("/settings")} className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
              <Settings size={13} /> Settings
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={handleLogout} className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer">
            <LogOut size={13} />
          </button>
        </div>
      </nav>

      {/* Forecast controls bar */}
      <div className="h-[42px] shrink-0 border-b border-zinc-800 bg-zinc-950 flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2 text-teal-500">
            <Crosshair size={14} strokeWidth={2.5} />
            <span className="font-mono font-bold text-sm tracking-wider uppercase text-teal-500">
              Forecast
            </span>
          </div>
          <div className="h-4 w-px bg-zinc-800" />
          <HorizonSelector value={horizon} onChange={setHorizon} />
        </div>

        <div className="flex items-center gap-5">
          {/* Weather context strip */}
          {weather && (() => {
            const WeatherIcon = weatherIconComponent(weather.current.icon);
            const nextPrecip = weather.forecast.find((f) => f.pop >= 40);
            const warn = weather.current.icon === "rain" || weather.current.icon === "thunder" || weather.current.icon === "snow" || !!nextPrecip;
            const color = warn ? "border-amber-500/20 bg-amber-500/5 text-amber-400" : "border-zinc-800 bg-zinc-900/50 text-zinc-400";
            return (
              <div className={`hidden md:flex items-center gap-2 border px-2.5 py-1.5 rounded ${color}`}>
                <WeatherIcon size={12} />
                <span className="font-mono text-[11px] uppercase tracking-wide">
                  {weather.current.description} · {weather.current.temp}°F
                </span>
                {nextPrecip && (
                  <span className="font-mono text-[9px] text-amber-400 bg-amber-500/10 px-1 rounded border border-amber-500/20">
                    RAIN {nextPrecip.pop}%
                  </span>
                )}
              </div>
            );
          })()}

          {/* Citywide delta */}
          {citywideDelta != null && (
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-zinc-500 tracking-widest uppercase">
                Citywide vs Typical
              </span>
              <div
                className={`flex items-center gap-1.5 px-2 py-1 rounded font-mono text-sm border ${
                  citywideDelta >= 0
                    ? "bg-teal-500/10 border-teal-500/30 text-teal-400"
                    : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                }`}
              >
                {citywideDelta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                <span>
                  {citywideDelta >= 0 ? "+" : ""}
                  {citywideDelta}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Split workspace */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Map */}
        <section className="w-[60%] lg:w-[65%] relative bg-zinc-950 border-r border-zinc-800">
          <ForecastMap
            timeWindow={mapTimeWindow}
            selectedGeoid={selected?.geoid ?? null}
            onZoneSelect={handleZoneSelect}
            onBboxAggregate={handleBboxAggregate}
          />
        </section>

        {/* Right panel */}
        <section className="w-[40%] lg:w-[35%] bg-zinc-950 overflow-y-auto flex flex-col">
          <ZoneDrilldown
            selected={selected}
            currentScore={currentScore}
            baselineScore={baselineForActive}
            peakWindow={peak.tw}
            peakScore={peak.score}
            cityAggregate={cityAggregate}
            onClear={() => setSelected(null)}
          />

          {/* Chart section: hourly (today/1h) or weekly rhythm (7d) */}
          <div className="p-5 border-b border-zinc-800">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-[10px] font-mono text-zinc-400 tracking-widest uppercase">
                {horizon === "7d" ? "Weekly Rhythm" : "Hourly Demand Forecast"}
              </h2>
              <span className="bg-zinc-800 border border-zinc-700 px-2 py-0.5 rounded text-[10px] font-mono text-zinc-300">
                {selected ? "ZONE" : "SELECT A ZONE"}
              </span>
            </div>
            {zoneLoading ? (
              <div className="h-40 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : selected ? (
              horizon === "7d" ? (
                <WeeklyRhythm windows={zoneWindows} />
              ) : (
                <HourlyChart
                  windows={zoneWindows}
                  activeWindow={activeWindow}
                  baseline={chartBaseline}
                />
              )
            ) : (
              <div className="h-40 flex flex-col items-center justify-center text-center border border-dashed border-zinc-800 rounded">
                <p className="text-zinc-500 text-sm">Click a zone on the map</p>
                <p className="text-zinc-600 text-xs mt-1">
                  to see its {horizon === "7d" ? "weekly rhythm" : "hourly forecast curve"}
                </p>
              </div>
            )}
          </div>

          {/* Footer note */}
          <div className="p-5 flex-1 bg-zinc-950">
            <div className="text-[10px] font-mono text-zinc-600 tracking-widest uppercase mb-2">
              Prediction Metadata
            </div>
            <div className="font-mono text-[11px] text-zinc-500 space-y-1">
              <div className="flex justify-between">
                <span>MODEL</span>
                <span className="text-zinc-400">BLOCK_DEMAND_V1</span>
              </div>
              <div className="flex justify-between">
                <span>HORIZON</span>
                <span className="text-zinc-400">{horizon.toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span>ACTIVE WINDOW</span>
                <span className="text-zinc-400">{activeWindow}</span>
              </div>
              <div className="flex justify-between">
                <span>BASELINE</span>
                <span className="text-zinc-400">
                  {Object.keys(citywideBaselines).length > 0 ? "CITYWIDE AVG" : "—"}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ForecastPage() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <ForecastContent />
    </Suspense>
  );
}
