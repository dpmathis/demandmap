"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Map, Route, Users, TrendingUp, Plus, ChevronRight, Activity } from "lucide-react";

interface ActivityItem {
  id: string;
  userName: string | null;
  action: string;
  entity: string;
  entityName: string | null;
  createdAt: string;
}

interface DashboardData {
  user: { name: string | null; email: string };
  stats: {
    totalRoutes: number;
    activeRoutes: number;
    totalStops: number;
    teamMembers: number;
  };
  recentRoutes: Array<{
    id: string;
    name: string;
    vertical: string;
    status: string;
    stopCount: number;
    updatedAt: string;
  }>;
}

const verticalEmoji: Record<string, string> = {
  coffee: "☕", food_truck: "🚚", retail: "🛍", political: "📣", events: "🎪", custom: "⚙️",
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activity, setActivity] = useState<ActivityItem[]>([]);

  useEffect(() => {
    fetch("/api/dashboard")
      .then(async (r) => {
        if (!r.ok) return null;
        const d = await r.json();
        return d && d.user ? (d as DashboardData) : null;
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));

    fetch("/api/activity?limit=10")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setActivity(d.logs ?? []); })
      .catch(() => {});
  }, []);

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-zinc-500 text-sm">Failed to load dashboard</p>
      </div>
    );
  }

  const { stats, recentRoutes } = data;
  const email = data.user.email ?? "";
  const displayName = data.user.name?.split(" ")[0] || email.split("@")[0] || "there";

  const statCards = [
    { label: "Total Routes", value: stats.totalRoutes, icon: Route, color: "text-teal-400" },
    { label: "Active", value: stats.activeRoutes, icon: TrendingUp, color: "text-green-400" },
    { label: "Total Stops", value: stats.totalStops, icon: Map, color: "text-blue-400" },
    { label: "Team Members", value: stats.teamMembers, icon: Users, color: "text-amber-400" },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Greeting */}
      <div className="mb-8">
        <h1 className="text-xl font-bold">{greeting()}, {displayName}</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Here&apos;s your demand overview</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 mb-8">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon size={14} className={card.color} />
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{card.label}</span>
              </div>
              <p className="text-2xl font-bold">{card.value}</p>
            </div>
          );
        })}
      </div>

      {/* Quick actions */}
      <div className="flex gap-2 mb-8">
        <button
          onClick={() => router.push("/map")}
          className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          <Plus size={13} /> New Route
        </button>
        <button
          onClick={() => router.push("/map")}
          className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer"
        >
          <Map size={13} /> Open Explorer
        </button>
      </div>

      {/* Recent routes */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">Recent Routes</h2>
          {recentRoutes.length > 0 && (
            <button
              onClick={() => router.push("/routes")}
              className="text-[10px] text-zinc-500 hover:text-teal-400 transition-colors cursor-pointer flex items-center gap-0.5"
            >
              View all <ChevronRight size={10} />
            </button>
          )}
        </div>

        {recentRoutes.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-zinc-800 rounded-xl">
            <Route size={28} className="text-zinc-700 mx-auto mb-2" />
            <p className="text-zinc-500 text-sm">No routes yet</p>
            <p className="text-zinc-600 text-xs mt-1">Create your first route from the Explorer</p>
          </div>
        ) : (
          <div className="space-y-2">
            {recentRoutes.map((route) => {
              const updated = new Date(route.updatedAt).toLocaleDateString("en-US", {
                month: "short", day: "numeric",
              });
              return (
                <button
                  key={route.id}
                  onClick={() => router.push(`/routes/${route.id}`)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 flex items-center gap-3 hover:border-zinc-700 transition-colors cursor-pointer text-left"
                >
                  <span className="text-base">{verticalEmoji[route.vertical] ?? "📍"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{route.name}</p>
                    <p className="text-[10px] text-zinc-500">
                      {route.stopCount} stop{route.stopCount !== 1 ? "s" : ""} · {updated}
                    </p>
                  </div>
                  <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                    route.status === "active"
                      ? "bg-green-500/15 text-green-400"
                      : "bg-zinc-800 text-zinc-500"
                  }`}>
                    {route.status}
                  </span>
                  <ChevronRight size={13} className="text-zinc-600" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Activity Feed */}
      {activity.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
            <Activity size={14} className="text-purple-400" /> Recent Activity
          </h2>
          <div className="space-y-1">
            {activity.map((item) => {
              const ago = formatRelativeTime(item.createdAt);
              const actionLabel = ACTION_LABELS[item.action] ?? item.action;
              return (
                <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-zinc-900 border border-zinc-800 rounded-xl text-xs">
                  <span className="text-zinc-400 font-medium">{item.userName ?? "Someone"}</span>
                  <span className="text-zinc-600">{actionLabel}</span>
                  <span className="text-zinc-300 font-medium truncate">{item.entityName ?? item.entity}</span>
                  <span className="text-zinc-700 ml-auto shrink-0">{ago}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

const ACTION_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  cloned: "cloned",
  logged_performance: "logged performance on",
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}
