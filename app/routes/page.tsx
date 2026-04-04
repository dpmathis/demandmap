"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Route, Users, LogOut, Download, Trash2, ChevronRight } from "lucide-react";
import { createClient } from "@/app/lib/supabase/client";
import { TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

interface RouteData {
  id: string;
  name: string;
  vertical: string;
  date: string | null;
  status: string;
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
  const supabase = createClient();
  const [routes, setRoutes] = useState<RouteData[]>([]);
  const [loading, setLoading] = useState(true);

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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const verticalEmoji: Record<string, string> = {
    coffee: "☕", food_truck: "🚚", retail: "🛍", political: "📣", events: "🎪", custom: "⚙️",
  };

  return (
    <div className="h-dvh bg-zinc-950 text-white flex flex-col">
      <nav className="flex items-center justify-between px-4 h-11 bg-zinc-900/80 backdrop-blur border-b border-zinc-800 shrink-0 z-20">
        <div className="flex items-center gap-5">
          <span className="text-base font-black tracking-tight">DemandMap</span>
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => router.push("/map")}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
            >
              <Map size={13} /> Explorer
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-teal-500/15 text-teal-400">
              <Route size={13} /> Routes
            </button>
            <button className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium text-zinc-500 hover:text-white hover:bg-white/5 transition-colors">
              <Users size={13} /> Team
            </button>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-zinc-500 hover:text-white hover:bg-white/5 transition-colors cursor-pointer"
        >
          <LogOut size={13} />
        </button>
      </nav>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-xl font-bold">Saved Routes</h1>
              <p className="text-sm text-zinc-500 mt-0.5">Your demand-optimized routes</p>
            </div>
            <button
              onClick={() => router.push("/map")}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
            >
              + New Route
            </button>
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
            {routes.map((route) => {
              const date = route.date
                ? new Date(route.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                : null;
              const updated = new Date(route.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });

              return (
                <div
                  key={route.id}
                  className="bg-zinc-900 border border-zinc-800 rounded-2xl p-4 hover:border-zinc-700 transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{verticalEmoji[route.vertical] ?? "📍"}</span>
                        <h2 className="font-semibold text-sm truncate">{route.name}</h2>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          route.status === "active"
                            ? "bg-green-500/15 text-green-400"
                            : "bg-zinc-800 text-zinc-500"
                        }`}>
                          {route.status}
                        </span>
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
                      <button
                        onClick={() => window.open(`/api/routes/${route.id}/export`, "_blank")}
                        className="p-1.5 text-zinc-600 hover:text-zinc-300 transition-colors cursor-pointer"
                        title="Export CSV"
                      >
                        <Download size={13} />
                      </button>
                      <button
                        onClick={() => handleDelete(route.id)}
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
      </div>
    </div>
  );
}
