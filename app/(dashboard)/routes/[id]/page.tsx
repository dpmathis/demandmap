"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, MapPin, Clock, Download, Trash2, Copy, DollarSign, Star, TrendingUp, Plus, X, FileText, BookTemplate } from "lucide-react";
import { TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

interface StopData {
  id: string;
  censusBlockGeoid: string;
  timeWindow: string;
  sortOrder: number;
  lat: number | null;
  lng: number | null;
  censusBlock: {
    ntaName: string | null;
    borough: string | null;
    nearestSubwayMeters: number | null;
  } | null;
  demandScore?: number | null;
}

interface RouteDetail {
  id: string;
  name: string;
  vertical: string;
  status: string;
  date: string | null;
  notes: string | null;
  isTemplate: boolean;
  createdAt: string;
  updatedAt: string;
  stops: StopData[];
}

const verticalEmoji: Record<string, string> = {
  coffee: "☕", food_truck: "🚚", retail: "🛍", political: "📣", events: "🎪", custom: "⚙️",
};

export default function RouteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params.id as string;

  const [route, setRoute] = useState<RouteDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/routes/${routeId}`);
        if (!res.ok) { setLoading(false); return; }
        const data = await res.json();
        const r = data.route as RouteDetail;

        // Fetch demand scores for each stop's block
        const geoids = [...new Set(r.stops.map((s) => s.censusBlockGeoid))];
        const demandMap: Record<string, Record<string, number>> = {};
        await Promise.all(
          geoids.map(async (geoid) => {
            const dRes = await fetch(`/api/map/blocks/${geoid}/demand`);
            if (dRes.ok) {
              const d = await dRes.json();
              demandMap[geoid] = d.windows;
            }
          })
        );

        r.stops = r.stops.map((s) => ({
          ...s,
          demandScore: demandMap[s.censusBlockGeoid]?.[s.timeWindow] ?? null,
        }));

        setRoute(r);
      } catch {
        // ignore
      }
      setLoading(false);
    }
    load();
  }, [routeId]);

  async function handleDelete() {
    await fetch(`/api/routes/${routeId}`, { method: "DELETE" });
    router.push("/routes");
  }

  async function handleClone() {
    const res = await fetch(`/api/routes/${routeId}/clone`, { method: "POST" });
    if (!res.ok) return;
    const { route } = await res.json();
    router.push(`/routes/${route.id}`);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!route) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500 text-sm">Route not found</p>
      </div>
    );
  }

  const created = new Date(route.createdAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const updated = new Date(route.updatedAt).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
  });
  const avgDemand = route.stops.length > 0
    ? route.stops.reduce((sum, s) => sum + (s.demandScore ?? 0), 0) / route.stops.length
    : 0;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Back */}
      <button
        onClick={() => router.push("/routes")}
        className="flex items-center gap-1 text-xs text-zinc-500 hover:text-white mb-4 cursor-pointer transition-colors"
      >
        <ArrowLeft size={12} /> Back to routes
      </button>

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{verticalEmoji[route.vertical] ?? "📍"}</span>
            <h1 className="text-xl font-bold">{route.name}</h1>
            <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
              route.status === "active"
                ? "bg-green-500/15 text-green-400"
                : "bg-zinc-800 text-zinc-500"
            }`}>{route.status}</span>
            {route.isTemplate && (
              <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-purple-500/15 text-purple-400">template</span>
            )}
          </div>
          <p className="text-[10px] text-zinc-500 mt-1">
            Created {created} · Updated {updated}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={async () => {
              const next = !route.isTemplate;
              await fetch(`/api/routes/${routeId}`, {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ isTemplate: next }),
              });
              setRoute((prev) => prev ? { ...prev, isTemplate: next } : prev);
            }}
            className={`p-2 transition-colors cursor-pointer ${route.isTemplate ? "text-purple-400" : "text-zinc-600 hover:text-purple-400"}`}
            title={route.isTemplate ? "Remove template" : "Save as template"}
          >
            <BookTemplate size={14} />
          </button>
          <button
            onClick={handleClone}
            className="p-2 text-zinc-600 hover:text-teal-400 transition-colors cursor-pointer"
            title="Duplicate route"
          >
            <Copy size={14} />
          </button>
          <button
            onClick={() => window.open(`/api/routes/${routeId}/export`, "_blank")}
            className="p-2 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
            title="Export CSV"
          >
            <Download size={14} />
          </button>
          <button
            onClick={async () => {
              const { generateRoutePDF } = await import("@/app/lib/pdf-export");
              const pdf = generateRoutePDF({
                name: route.name,
                vertical: route.vertical,
                date: route.date,
                status: route.status,
                stops: route.stops.map((s) => ({
                  sortOrder: s.sortOrder,
                  ntaName: s.censusBlock?.ntaName ?? null,
                  borough: s.censusBlock?.borough ?? null,
                  timeWindow: s.timeWindow,
                  demandScore: s.demandScore ?? null,
                  nearestSubwayMeters: s.censusBlock?.nearestSubwayMeters ?? null,
                  notes: null,
                })),
                avgDemand,
              });
              pdf.save(`${route.name.replace(/\s+/g, "-").toLowerCase()}.pdf`);
            }}
            className="p-2 text-zinc-600 hover:text-purple-400 transition-colors cursor-pointer"
            title="Export PDF"
          >
            <FileText size={14} />
          </button>
          <button
            onClick={handleDelete}
            className="p-2 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
            title="Delete route"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Stops</p>
          <p className="text-lg font-bold">{route.stops.length}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Avg Demand</p>
          <p className="text-lg font-bold">{avgDemand.toFixed(1)}</p>
        </div>
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Time Slots</p>
          <p className="text-lg font-bold">{new Set(route.stops.map((s) => s.timeWindow)).size}</p>
        </div>
      </div>

      {/* Stops table */}
      <div className="mb-6">
        <h2 className="text-sm font-semibold mb-3">Stops</h2>
        {route.stops.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-zinc-800 rounded-xl">
            <MapPin size={24} className="text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No stops added yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {route.stops.map((stop, i) => (
              <div key={stop.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/15 text-teal-400 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {stop.censusBlock?.ntaName ?? stop.censusBlockGeoid}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {stop.censusBlock?.borough && (
                      <span className="text-[9px] text-zinc-600">{stop.censusBlock.borough}</span>
                    )}
                    <span className="text-[9px] text-zinc-500 flex items-center gap-0.5">
                      <Clock size={8} />
                      {TIME_WINDOW_LABELS[stop.timeWindow as TimeWindow] ?? stop.timeWindow}
                    </span>
                    {stop.censusBlock?.nearestSubwayMeters != null && (
                      <span className="text-[9px] text-zinc-600">
                        🚇 {Math.round(stop.censusBlock.nearestSubwayMeters)}m
                      </span>
                    )}
                  </div>
                </div>
                {stop.demandScore != null && (
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold">{stop.demandScore.toFixed(1)}</p>
                    <p className="text-[9px] text-zinc-500">demand</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Performance Section */}
      {route.stops.length > 0 && (
        <PerformanceSection routeId={routeId} stops={route.stops} />
      )}

      {/* Notes */}
      {route.notes && (
        <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
          <h2 className="text-sm font-semibold mb-2">Notes</h2>
          <p className="text-xs text-zinc-400 whitespace-pre-wrap">{route.notes}</p>
        </div>
      )}
    </div>
  );
}

// ── Performance Tracking Section ────────────────────────────────────────────

interface PerformanceSummary {
  totalLogs: number;
  totalRevenue: number | null;
  totalTips: number | null;
  totalUnits: number | null;
  avgRevenue: number | null;
  avgRating: number | null;
}

interface StopStat {
  stopId: string;
  logCount: number;
  avgRevenue: number | null;
  totalRevenue: number | null;
  avgRating: number | null;
}

interface PerformanceLog {
  id: string;
  routeStopId: string;
  date: string;
  revenue: number | null;
  tips: number | null;
  unitsSold: number | null;
  rating: number | null;
  notes: string | null;
  routeStop?: { censusBlockGeoid: string; timeWindow: string; sortOrder: number };
}

function PerformanceSection({
  routeId,
  stops,
}: {
  routeId: string;
  stops: StopData[];
}) {
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [stopStats, setStopStats] = useState<StopStat[]>([]);
  const [recentLogs, setRecentLogs] = useState<PerformanceLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [logStopId, setLogStopId] = useState<string | null>(null);

  const loadPerformance = useCallback(() => {
    fetch(`/api/routes/${routeId}/performance`)
      .then((r) => r.json())
      .then((d) => {
        setSummary(d.summary);
        setStopStats(d.stops ?? []);
        setRecentLogs(d.recentLogs ?? []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [routeId]);

  useEffect(() => { loadPerformance(); }, [loadPerformance]);

  if (loading) return null;

  const hasData = summary && summary.totalLogs > 0;

  return (
    <div className="mb-6">
      <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <TrendingUp size={14} className="text-teal-400" /> Performance Tracking
      </h2>

      {hasData && (
        <div className="grid grid-cols-4 gap-3 mb-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Total Revenue</p>
            <p className="text-lg font-bold text-green-400">
              ${(summary.totalRevenue ?? 0).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Avg / Stop</p>
            <p className="text-lg font-bold">
              ${(summary.avgRevenue ?? 0).toFixed(0)}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Total Tips</p>
            <p className="text-lg font-bold text-teal-400">
              ${(summary.totalTips ?? 0).toFixed(0)}
            </p>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-3 text-center">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Avg Rating</p>
            <p className="text-lg font-bold text-amber-400">
              {summary.avgRating != null ? `${summary.avgRating.toFixed(1)}` : "—"}
              <Star size={12} className="inline ml-0.5 -mt-0.5" />
            </p>
          </div>
        </div>
      )}

      {/* Log entry per stop */}
      <div className="space-y-2">
        {stops.map((stop, i) => {
          const stat = stopStats.find((s) => s.stopId === stop.id);
          return (
            <div key={stop.id} className="bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-zinc-500 font-mono w-4 text-right">{i + 1}</span>
                  <span className="text-xs truncate">
                    {stop.censusBlock?.ntaName ?? stop.censusBlockGeoid}
                  </span>
                  <span className="text-[9px] text-zinc-600">
                    {TIME_WINDOW_LABELS[stop.timeWindow as TimeWindow] ?? stop.timeWindow}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {stat && (
                    <span className="text-[10px] text-zinc-500">
                      {stat.logCount} logs · avg ${(stat.avgRevenue ?? 0).toFixed(0)}
                    </span>
                  )}
                  <button
                    onClick={() => setLogStopId(logStopId === stop.id ? null : stop.id)}
                    className="p-1 text-zinc-600 hover:text-teal-400 transition-colors cursor-pointer"
                    title="Log performance"
                  >
                    {logStopId === stop.id ? <X size={12} /> : <Plus size={12} />}
                  </button>
                </div>
              </div>

              {logStopId === stop.id && (
                <PerformanceLogForm
                  routeId={routeId}
                  stopId={stop.id}
                  onSaved={() => {
                    setLogStopId(null);
                    loadPerformance();
                  }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Recent logs */}
      {recentLogs.length > 0 && (
        <div className="mt-4">
          <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">Recent Logs</p>
          <div className="space-y-1">
            {recentLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-xs px-2 py-1.5 bg-zinc-950 rounded-lg">
                <div className="flex items-center gap-2">
                  <span className="text-zinc-600 font-mono">
                    {new Date(log.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                  <span className="text-zinc-400">
                    Stop #{(log.routeStop?.sortOrder ?? 0) + 1}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  {log.revenue != null && (
                    <span className="text-green-400 font-mono">${log.revenue}</span>
                  )}
                  {log.tips != null && (
                    <span className="text-teal-400 font-mono">+${log.tips}</span>
                  )}
                  {log.rating != null && (
                    <span className="text-amber-400 flex items-center gap-0.5">
                      {log.rating}<Star size={8} />
                    </span>
                  )}
                  {log.notes && (
                    <span className="text-zinc-600 truncate max-w-[120px]">{log.notes}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PerformanceLogForm({
  routeId,
  stopId,
  onSaved,
}: {
  routeId: string;
  stopId: string;
  onSaved: () => void;
}) {
  const [revenue, setRevenue] = useState("");
  const [tips, setTips] = useState("");
  const [units, setUnits] = useState("");
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    await fetch(`/api/routes/${routeId}/stops/${stopId}/performance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: new Date().toISOString(),
        revenue: revenue ? parseFloat(revenue) : undefined,
        tips: tips ? parseFloat(tips) : undefined,
        unitsSold: units ? parseInt(units, 10) : undefined,
        rating: rating > 0 ? rating : undefined,
        notes: notes || undefined,
      }),
    });

    setSaving(false);
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 border-t border-zinc-800 pt-3 space-y-2">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            Revenue ($)
          </label>
          <div className="relative">
            <DollarSign size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-zinc-600" />
            <input
              type="number"
              step="0.01"
              value={revenue}
              onChange={(e) => setRevenue(e.target.value)}
              className="w-full pl-6 pr-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
              placeholder="0"
            />
          </div>
        </div>
        <div>
          <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            Tips ($)
          </label>
          <input
            type="number"
            step="0.01"
            value={tips}
            onChange={(e) => setTips(e.target.value)}
            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder="0"
          />
        </div>
        <div>
          <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            Units Sold
          </label>
          <input
            type="number"
            value={units}
            onChange={(e) => setUnits(e.target.value)}
            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder="0"
          />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            Rating
          </label>
          <div className="flex gap-0.5">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(rating === n ? 0 : n)}
                className="cursor-pointer"
              >
                <Star
                  size={14}
                  className={n <= rating ? "text-amber-400 fill-amber-400" : "text-zinc-700"}
                />
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1">
          <label className="text-[9px] text-zinc-500 uppercase tracking-wider block mb-0.5">
            Notes
          </label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white focus:outline-none focus:ring-1 focus:ring-teal-500"
            placeholder="Optional notes..."
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={saving}
        className="px-3 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-[10px] font-semibold rounded-lg transition-colors cursor-pointer"
      >
        {saving ? "Saving..." : "Log Performance"}
      </button>
    </form>
  );
}
