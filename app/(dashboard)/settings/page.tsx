"use client";

import { useEffect, useState, useCallback } from "react";
import { VERTICALS } from "@/app/lib/constants";
import { Building2, Save, AlertTriangle, Database, RefreshCw, Bell } from "lucide-react";

interface SettingsData {
  tenant: { id: string; name: string; slug: string; defaultVertical: string };
  role: string;
}

export default function SettingsPage() {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [vertical, setVertical] = useState("");

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((d: SettingsData) => {
        setData(d);
        setName(d.tenant.name);
        setSlug(d.tenant.slug);
        setVertical(d.tenant.defaultVertical);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setMsg(null);

    const res = await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, slug, defaultVertical: vertical }),
    });
    const d = await res.json();

    if (res.ok) {
      setMsg({ type: "ok", text: "Settings saved" });
      if (d.tenant) {
        setName(d.tenant.name);
        setSlug(d.tenant.slug);
        setVertical(d.tenant.defaultVertical);
      }
    } else {
      setMsg({ type: "err", text: d.error ?? "Failed to save" });
    }
    setSaving(false);
  }

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
        <p className="text-zinc-500 text-sm">Failed to load settings</p>
      </div>
    );
  }

  const isAdmin = data.role === "admin";

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold">Settings</h1>
        <p className="text-sm text-zinc-500 mt-0.5">Manage your workspace</p>
      </div>

      {/* Organization settings */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
          <Building2 size={14} className="text-teal-400" /> Organization
        </h2>
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
              Organization Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isAdmin}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
              Slug
            </label>
            <input
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              disabled={!isAdmin}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50 font-mono"
            />
          </div>

          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1">
              Default Vertical
            </label>
            <select
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              disabled={!isAdmin}
              className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-sm text-white focus:outline-none focus:ring-2 focus:ring-teal-500 disabled:opacity-50"
            >
              {VERTICALS.map((v) => (
                <option key={v.value} value={v.value}>{v.label}</option>
              ))}
            </select>
          </div>

          {isAdmin && (
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
              >
                <Save size={12} />
                {saving ? "Saving..." : "Save Changes"}
              </button>
              {msg && (
                <span className={`text-xs ${msg.type === "ok" ? "text-teal-400" : "text-red-400"}`}>
                  {msg.text}
                </span>
              )}
            </div>
          )}

          {!isAdmin && (
            <p className="text-[10px] text-zinc-600">Only admins can edit settings</p>
          )}
        </form>
      </div>

      {/* Notification Preferences */}
      <NotificationPrefsCard />

      {/* Data Management - Competitor Refresh */}
      {isAdmin && <CompetitorDataCard />}

      {/* Danger zone */}
      {isAdmin && (
        <div className="border border-red-500/20 rounded-2xl p-5">
          <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5 text-red-400">
            <AlertTriangle size={14} /> Danger Zone
          </h2>
          <p className="text-[10px] text-zinc-500 mb-3">
            These actions are permanent and cannot be undone.
          </p>
          <button
            disabled
            className="px-4 py-2 border border-red-500/30 text-red-400 text-xs font-semibold rounded-xl opacity-50 cursor-not-allowed"
          >
            Delete Workspace
          </button>
          <p className="text-[9px] text-zinc-600 mt-1">Contact support to delete your workspace</p>
        </div>
      )}
    </div>
  );
}

// ── Competitor Data Management Card ─────────────────────────────────────────

interface CompetitorStats {
  total: number;
  staleCount: number;
  lastOsmRefresh: string | null;
  byCategory: Array<{ category: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
}

function CompetitorDataCard() {
  const [stats, setStats] = useState<CompetitorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState<string | null>(null);
  const [result, setResult] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const loadStats = useCallback(() => {
    fetch("/api/admin/competitors")
      .then((r) => r.json())
      .then((d) => { setStats(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  useEffect(() => { loadStats(); }, [loadStats]);

  async function handleRefresh(category: string) {
    setRefreshing(category);
    setResult(null);

    try {
      const res = await fetch("/api/admin/competitors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category }),
      });
      const d = await res.json();
      if (res.ok) {
        setResult({ type: "ok", text: `${d.processed} competitors processed (${d.skipped} skipped)` });
        loadStats();
      } else {
        setResult({ type: "err", text: d.error ?? "Refresh failed" });
      }
    } catch {
      setResult({ type: "err", text: "Network error" });
    }
    setRefreshing(null);
  }

  if (loading) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-zinc-500">Loading competitor data...</span>
        </div>
      </div>
    );
  }

  const CATEGORIES = [
    { key: "coffee", label: "Coffee / Cafes" },
    { key: "food_truck", label: "Food / Fast Food" },
    { key: "retail", label: "Retail / Shops" },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
        <Database size={14} className="text-teal-400" /> Competitor Data
      </h2>

      {stats && (
        <div className="space-y-4">
          {/* Stats summary */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-zinc-950 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Total</p>
              <p className="text-lg font-bold tabular-nums">{stats.total.toLocaleString()}</p>
            </div>
            <div className="bg-zinc-950 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Stale ({">"}90d)</p>
              <p className={`text-lg font-bold tabular-nums ${stats.staleCount > 0 ? "text-amber-400" : "text-teal-400"}`}>
                {stats.staleCount.toLocaleString()}
              </p>
            </div>
            <div className="bg-zinc-950 rounded-xl p-3">
              <p className="text-[10px] text-zinc-500 uppercase tracking-wider">Last Refresh</p>
              <p className="text-xs font-mono text-zinc-300 mt-1">
                {stats.lastOsmRefresh
                  ? new Date(stats.lastOsmRefresh).toLocaleDateString()
                  : "Never"}
              </p>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="space-y-1">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider">By Category</p>
            {stats.byCategory.map((c) => (
              <div key={c.category} className="flex items-center justify-between text-xs">
                <span className="text-zinc-400">{c.category}</span>
                <span className="text-zinc-500 font-mono tabular-nums">{c.count.toLocaleString()}</span>
              </div>
            ))}
          </div>

          {/* Refresh buttons */}
          <div className="border-t border-zinc-800 pt-4">
            <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-2">
              Refresh from OpenStreetMap
            </p>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => handleRefresh(cat.key)}
                  disabled={refreshing !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-xs rounded-lg transition-colors cursor-pointer"
                >
                  <RefreshCw size={10} className={refreshing === cat.key ? "animate-spin" : ""} />
                  {cat.label}
                </button>
              ))}
            </div>
            {refreshing && (
              <p className="text-[10px] text-zinc-500 mt-2">
                Fetching from OSM... this may take a minute
              </p>
            )}
            {result && (
              <p className={`text-[10px] mt-2 ${result.type === "ok" ? "text-teal-400" : "text-red-400"}`}>
                {result.text}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Notification Preferences Card ───────────────────────────────────────────

interface NotifPrefs {
  weatherAlerts: boolean;
  closureAlerts: boolean;
  demandAlerts: boolean;
  systemAlerts: boolean;
}

const PREF_ITEMS: Array<{ key: keyof NotifPrefs; label: string; description: string }> = [
  { key: "weatherAlerts", label: "Weather Alerts", description: "Severe weather warnings for your operating areas" },
  { key: "closureAlerts", label: "Street Closures", description: "New street closures that may affect your routes" },
  { key: "demandAlerts", label: "Demand Spikes", description: "Unusually high demand in your areas of interest" },
  { key: "systemAlerts", label: "System Updates", description: "Data refreshes, new features, and maintenance" },
];

function NotificationPrefsCard() {
  const [prefs, setPrefs] = useState<NotifPrefs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/notifications/preferences")
      .then((r) => r.json())
      .then((d) => { setPrefs(d.preferences); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  async function toggle(key: keyof NotifPrefs) {
    if (!prefs) return;
    const newVal = !prefs[key];
    setPrefs({ ...prefs, [key]: newVal });

    await fetch("/api/notifications/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: newVal }),
    });
  }

  if (loading) return null;

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
      <h2 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
        <Bell size={14} className="text-teal-400" /> Notifications
      </h2>
      <div className="space-y-3">
        {PREF_ITEMS.map((item) => (
          <div key={item.key} className="flex items-center justify-between">
            <div>
              <p className="text-xs font-medium">{item.label}</p>
              <p className="text-[10px] text-zinc-500">{item.description}</p>
            </div>
            <button
              onClick={() => toggle(item.key)}
              className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${
                prefs?.[item.key] ? "bg-teal-600" : "bg-zinc-700"
              }`}
            >
              <div
                className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
                  prefs?.[item.key] ? "translate-x-4" : "translate-x-0.5"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
