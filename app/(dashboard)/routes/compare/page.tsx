"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Star, DollarSign, MapPin, Clock } from "lucide-react";
import { TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

const VERTICAL_LABELS: Record<string, string> = {
  coffee: "Coffee / Beverage",
  food_truck: "Food Truck",
  retail: "Retail Pop-Up",
  political: "Political Canvass",
  events: "Event Planning",
  custom: "Custom",
};

const COLORS = ["teal", "purple", "amber", "blue"] as const;
const COLOR_CLASSES = {
  teal: { bg: "bg-teal-500/15", text: "text-teal-400", bar: "bg-teal-500/70" },
  purple: { bg: "bg-purple-500/15", text: "text-purple-400", bar: "bg-purple-500/70" },
  amber: { bg: "bg-amber-500/15", text: "text-amber-400", bar: "bg-amber-500/70" },
  blue: { bg: "bg-blue-500/15", text: "text-blue-400", bar: "bg-blue-500/70" },
};

interface CompareStop {
  id: string;
  ntaName: string | null;
  borough: string | null;
  timeWindow: string;
  demandScore: number | null;
  nearestSubwayMeters: number | null;
}

interface CompareRoute {
  id: string;
  name: string;
  vertical: string;
  status: string;
  date: string | null;
  stopCount: number;
  avgDemand: number;
  boroughs: string[];
  stops: CompareStop[];
  performance: {
    totalLogs: number;
    totalRevenue: number | null;
    avgRevenue: number | null;
    avgRating: number | null;
  } | null;
}

export default function CompareRoutesPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-full"><div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" /></div>}>
      <CompareRoutesContent />
    </Suspense>
  );
}

function CompareRoutesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [routes, setRoutes] = useState<CompareRoute[]>([]);
  const [loading, setLoading] = useState(true);

  const ids = searchParams.get("ids") ?? "";

  useEffect(() => {
    if (!ids) { setLoading(false); return; }
    fetch(`/api/routes/compare?ids=${ids}`)
      .then((r) => r.json())
      .then((d) => { setRoutes(d.routes ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [ids]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (routes.length < 2) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8">
        <button onClick={() => router.push("/routes")} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-4 cursor-pointer">
          <ArrowLeft size={14} /> Back to routes
        </button>
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl">
          <p className="text-zinc-500 text-sm">Select at least 2 routes to compare</p>
        </div>
      </div>
    );
  }

  const maxStops = Math.max(...routes.map((r) => r.stopCount));
  const maxDemand = Math.max(...routes.map((r) => r.avgDemand), 1);
  const maxRevenue = Math.max(
    ...routes.map((r) => r.performance?.totalRevenue ?? 0),
    1
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <button onClick={() => router.push("/routes")} className="flex items-center gap-1 text-sm text-zinc-500 hover:text-white mb-4 cursor-pointer">
        <ArrowLeft size={14} /> Back to routes
      </button>

      <h1 className="text-xl font-bold mb-1">Route Comparison</h1>
      <p className="text-sm text-zinc-500 mb-6">Side-by-side analysis of {routes.length} routes</p>

      {/* Summary cards */}
      <div className="grid gap-4 mb-8" style={{ gridTemplateColumns: `repeat(${routes.length}, 1fr)` }}>
        {routes.map((route, i) => {
          const c = COLOR_CLASSES[COLORS[i % COLORS.length]];
          return (
            <div key={route.id} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-2 h-2 rounded-full ${c.bar}`} />
                <h2 className="text-sm font-bold truncate">{route.name}</h2>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Vertical</span>
                  <span>{VERTICAL_LABELS[route.vertical] ?? route.vertical}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Status</span>
                  <span className={route.status === "active" ? "text-green-400" : "text-zinc-400"}>{route.status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Stops</span>
                  <span className="font-mono">{route.stopCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Avg Demand</span>
                  <span className="font-mono">{route.avgDemand.toFixed(1)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Boroughs</span>
                  <span className="text-right">{route.boroughs.join(", ") || "—"}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Metric bars */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
          <MapPin size={14} className="text-teal-400" /> Stops & Demand
        </h2>
        <div className="space-y-4">
          <MetricBar label="Stop Count" routes={routes} getValue={(r) => r.stopCount} max={maxStops} format={(v) => v.toString()} />
          <MetricBar label="Avg Demand" routes={routes} getValue={(r) => r.avgDemand} max={maxDemand} format={(v) => v.toFixed(1)} />
        </div>
      </div>

      {/* Performance comparison */}
      {routes.some((r) => r.performance && r.performance.totalLogs > 0) && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
            <DollarSign size={14} className="text-green-400" /> Performance
          </h2>
          <div className="space-y-4">
            <MetricBar
              label="Total Revenue"
              routes={routes}
              getValue={(r) => r.performance?.totalRevenue ?? 0}
              max={maxRevenue}
              format={(v) => `$${v.toFixed(0)}`}
            />
            <MetricBar
              label="Avg Revenue / Stop"
              routes={routes}
              getValue={(r) => r.performance?.avgRevenue ?? 0}
              max={Math.max(...routes.map((r) => r.performance?.avgRevenue ?? 0), 1)}
              format={(v) => `$${v.toFixed(0)}`}
            />
            <MetricBar
              label="Avg Rating"
              routes={routes}
              getValue={(r) => r.performance?.avgRating ?? 0}
              max={5}
              format={(v) => v > 0 ? `${v.toFixed(1)}/5` : "—"}
            />
            <MetricBar
              label="Total Logs"
              routes={routes}
              getValue={(r) => r.performance?.totalLogs ?? 0}
              max={Math.max(...routes.map((r) => r.performance?.totalLogs ?? 0), 1)}
              format={(v) => v.toString()}
            />
          </div>
        </div>
      )}

      {/* Stop-by-stop detail */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
          <Clock size={14} className="text-purple-400" /> Stop Details
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left text-zinc-500 font-medium py-2 px-2">#</th>
                {routes.map((r, i) => {
                  const c = COLOR_CLASSES[COLORS[i % COLORS.length]];
                  return (
                    <th key={r.id} className={`text-left font-medium py-2 px-2 ${c.text}`}>
                      {r.name}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: Math.max(...routes.map((r) => r.stops.length)) }, (_, idx) => (
                <tr key={idx} className="border-b border-zinc-800/50">
                  <td className="py-2 px-2 text-zinc-600 font-mono">{idx + 1}</td>
                  {routes.map((r) => {
                    const stop = r.stops[idx];
                    if (!stop) return <td key={r.id} className="py-2 px-2 text-zinc-700">—</td>;
                    return (
                      <td key={r.id} className="py-2 px-2">
                        <p className="font-medium">{stop.ntaName ?? "Unknown"}</p>
                        <p className="text-zinc-500">
                          {TIME_WINDOW_LABELS[stop.timeWindow as TimeWindow] ?? stop.timeWindow}
                          {stop.demandScore != null && <span className="ml-1 text-teal-400">{stop.demandScore.toFixed(0)}</span>}
                          {stop.nearestSubwayMeters != null && <span className="ml-1 text-zinc-600">{Math.round(stop.nearestSubwayMeters)}m</span>}
                        </p>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function MetricBar({
  label,
  routes,
  getValue,
  max,
  format,
}: {
  label: string;
  routes: CompareRoute[];
  getValue: (r: CompareRoute) => number;
  max: number;
  format: (v: number) => string;
}) {
  return (
    <div>
      <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">{label}</p>
      <div className="space-y-1">
        {routes.map((r, i) => {
          const value = getValue(r);
          const c = COLOR_CLASSES[COLORS[i % COLORS.length]];
          return (
            <div key={r.id} className="flex items-center gap-2">
              <span className="text-[10px] text-zinc-500 w-20 truncate">{r.name}</span>
              <div className="flex-1 h-4 bg-zinc-950 rounded overflow-hidden">
                <div
                  className={`h-full rounded ${c.bar}`}
                  style={{ width: `${max > 0 ? (value / max) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] font-mono text-zinc-300 w-14 text-right">{format(value)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
