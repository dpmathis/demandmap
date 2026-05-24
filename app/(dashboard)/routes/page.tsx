"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, Trash2, Copy, ChevronRight, Route, GitCompareArrows, BookTemplate } from "lucide-react";
import { tapHaptic, notificationHaptic } from "@/app/lib/haptics";
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
          <div className="mb-6">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <h1 className="text-xl font-bold">Saved Routes</h1>
                <p className="text-sm text-zinc-500 mt-0.5">Your demand-optimized routes</p>
              </div>
              <button
                onClick={() => { tapHaptic("light"); router.push("/map"); }}
                className="flex items-center gap-1.5 px-4 py-2.5 min-h-[44px] bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
              >
                + New
              </button>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {(["all", "routes", "templates"] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => { tapHaptic("light"); setShowFilter(f); }}
                  className={`px-3 py-2 min-h-[36px] rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    showFilter === f ? "bg-teal-500/15 text-teal-400" : "text-zinc-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  {f === "all" ? "All" : f === "routes" ? "Routes" : "Templates"}
                </button>
              ))}
              {compareIds.size >= 2 && (
                <button
                  onClick={() => { tapHaptic("medium"); router.push(`/routes/compare?ids=${[...compareIds].join(",")}`); }}
                  className="ml-auto flex items-center gap-1.5 px-3 py-2 min-h-[36px] bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
                >
                  <GitCompareArrows size={13} /> Compare ({compareIds.size})
                </button>
              )}
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
                onClick={() => { tapHaptic("medium"); router.push("/map"); }}
                className="mt-4 px-5 py-3 min-h-[44px] bg-teal-600 hover:bg-teal-500 text-white text-sm font-semibold rounded-xl transition-colors cursor-pointer"
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
                  onClick={() => { tapHaptic("light"); router.push(`/routes/${route.id}`); }}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        tapHaptic("light");
                        setCompareIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(route.id)) next.delete(route.id);
                          else if (next.size < 4) next.add(route.id);
                          return next;
                        });
                      }}
                      aria-label="Select for compare"
                      className="min-w-[28px] min-h-[28px] -m-1 p-1 flex items-center justify-center shrink-0 cursor-pointer"
                    >
                      <span className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                        compareIds.has(route.id)
                          ? "bg-purple-500 border-purple-500 text-white"
                          : "border-zinc-700 hover:border-zinc-500"
                      }`}>
                        {compareIds.has(route.id) && (
                          <svg width="12" height="12" viewBox="0 0 10 10" fill="none"><path d="M2 5L4 7L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        )}
                      </span>
                    </button>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{verticalEmoji[route.vertical] ?? "📍"}</span>
                        <h2 className="font-semibold text-sm truncate">{route.name}</h2>
                        <button
                          onClick={(e) => { e.stopPropagation(); tapHaptic("light"); toggleStatus(route.id, route.status); }}
                          className={`text-[10px] px-2 py-1 min-h-[28px] rounded font-medium cursor-pointer transition-colors ${
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
                    <div className="flex items-center gap-0.5 shrink-0">
                      {route.isTemplate && (
                        <button
                          onClick={(e) => { e.stopPropagation(); tapHaptic("medium"); handleClone(route.id); }}
                          className="min-w-[44px] min-h-[44px] flex items-center justify-center text-purple-500 hover:text-purple-400 transition-colors cursor-pointer"
                          title="Create route from template"
                          aria-label="Create from template"
                        >
                          <BookTemplate size={17} />
                        </button>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); tapHaptic("light"); handleClone(route.id); }}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-teal-400 transition-colors cursor-pointer"
                        title="Duplicate route"
                        aria-label="Duplicate route"
                      >
                        <Copy size={17} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); tapHaptic("light"); window.open(`/api/routes/${route.id}/export`, "_blank"); }}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
                        title="Export CSV"
                        aria-label="Export CSV"
                      >
                        <Download size={17} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); tapHaptic("heavy"); handleDelete(route.id); }}
                        className="min-w-[44px] min-h-[44px] flex items-center justify-center text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
                        title="Delete route"
                        aria-label="Delete route"
                      >
                        <Trash2 size={17} />
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
