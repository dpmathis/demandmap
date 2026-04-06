"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, Copy, ChevronRight, Route, GitCompareArrows, BookTemplate } from "lucide-react";
import { TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

interface RouteData {
  id: string;
  name: string;
  vertical: string;
  date: string | null;
  status: string;
  isTemplate: boolean;
  stops: Array<{
    id: string;
    timeWindow: string;
    censusBlock: { ntaName: string | null; borough: string | null } | null;
  }>;
  createdAt: string;
  updatedAt: string;
}

export default function RoutesPage() {
  const router = useRouter();
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(true);
  const [compareIds, setCompareIds] = useState<Set<string>>(new Set());
  const [showFilter, setShowFilter] = useState<"all" | "routes" | "templates">("all");

  useEffect(() => {
    fetch("/api/routes")
      .then((r) => r.json())
      .then((d) => { setRoutes(d.routes ?? []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function handleDelete(id: string) {
    await fetch(`/api/routes/${id}`, { method: "DELETE" });
    setRoutes((prev) => prev.filter((r) => r.id !== id));
  }

  async function handleClone(id: string) {
    const res = await fetch(`/api/routes/${id}/clone`, { method: "POST" });
    if (!res.ok) return;
    const { route } = await res.json();
    setRoutes((prev) => [route, ...prev]);
  }

  async function toggleStatus(id: string, current: string) {
    const next = current === "active" ? "draft" : "active";
    await fetch(`/api/routes/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setRoutes((prev) => prev.map((r) => r.id === id ? { ...r, status: next } : r));
  }

  const verticalEmoji: Record<string, string> = {
    coffee: "☕", food_truck: "🚚", retail: "🛍", political: "📣", events: "🎪", custom: "⚙️",
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold">Saved Routes</h1>
              <p className="text-sm text-zinc-500 mt-0.5">Your demand-optimized routes</p>
              <div className="flex gap-1 mt-2">
                {(["all", "routes", "templates"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setShowFilter(f)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors cursor-pointer ${
                      showFilter === f ? "bg-teal-500/15 text-teal-400" : "text-zinc-500 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {f === "all" ? "All" : f === "routes" ? "Routes" : "Templates"}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {compareIds.size >= 2 && (
                <button
                  onClick={() => router.push(`/routes/compare?ids=${[...compareIds].join(",")}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <GitCompareArrows size={13} /> Compare ({compareIds.size})
                </button>
              )}
              <button
                onClick={() => router.push("/map")}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                + New Route
              </button>
            </div>
          </div>

          {loading && (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loading && routes.length === 0 && (
            <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl">
              <Route size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">No routes yet</p>
              <p className="text-zinc-600 text-xs mt-1">Build a route from the Map Explorer</p>
              <button
                onClick={() => router.push("/map")}
                className="mt-4 px-4 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
              >
                Go to Map
              </button>
            </div>
          )}

          <div className="space-y-3">
            {routes.filter((r) => showFilter === "all" ? true : showFilter === "templates" ? r.isTemplate : !r.isTemplate).map((route) => {
              const date = route.date
                ? new Date(route.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : null;
              const updated = new Date(route.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

              return (
                <div
                  key={route.id}
                  onClick={() => router.push(`/routes/${route.id}`)}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setCompareIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(route.id)) next.delete(route.id);
                          else if (next.size < 4) next.add(route.id);
                          return next;
                        });
                      }}
                      className={`mt-1 w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors cursor-pointer ${
                        compareIds.has(route.id)
                          ? "bg-purple-500 border-purple-500 text-white"
                          : "border-zinc-700 hover:border-zinc-500"
                      }`}
                    >
                      {compareIds.has(route.id) && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      )}
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{verticalEmoji[route.vertical] ?? "📍"}</span>
                        <h2 className="font-semibold text-sm truncate">{route.name}</h2>
                        <button
                          onClick={() => toggleStatus(route.id, route.status)}
                          className={`text-[9px] px-1.5 py-0.5 rounded font-medium cursor-pointer transition-colors ${
                            route.status === "active"
                              ? "bg-green-500/15 text-green-400 hover:bg-green-500/25"
                              : "bg-zinc-800 text-zinc-500 hover:bg-zinc-700"
                          }`}
                        >
                          {route.status}
                        </button>
                        {route.isTemplate && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded font-medium bg-purple-500/15 text-purple-400">template</span>
                        )}
                      </div>
                      <p className="text-[10px] text-zinc-500">
                        {route.stops.length} stop{route.stops.length !== 1 ? "s" : ""}
                        {date ? ` · ${date}` : ""}
                        {" · updated "}{updated}
                      </p>
                      {route.stops.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {route.stops.slice(0, 4).map((s, i) => (
                            <span key={s.id} className="text-[9px] px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-400">
                              {i + 1}. {s.censusBlock?.ntaName ?? "—"} · {TIME_WINDOW_LABELS[s.timeWindow as TimeWindow] ?? s.timeWindow}
                            </span>
                          ))}
                          {route.stops.length > 4 && (
                            <span className="text-[9px] text-zinc-600">+{route.stops.length - 4} more</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {route.isTemplate && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleClone(route.id); }}
                          className="p-1.5 text-purple-500 hover:text-purple-400 transition-colors cursor-pointer"
                          title="Create route from template"
                        >
                          <BookTemplate size={13} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleClone(route.id); }}
                        className="p-1.5 text-zinc-600 hover:text-teal-400 transition-colors cursor-pointer"
                        title="Duplicate route"
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); window.open(`/api/routes/${route.id}/export`, "_blank"); }}
                        className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
                        title="Export CSV"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(route.id); }}
                        className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete route"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
    </div>
  );
}
