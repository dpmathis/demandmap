"use client";

import { useEffect, useState } from "react";
import { Bookmark, Save, Trash2, ChevronDown } from "lucide-react";

export interface SavedViewConfig {
  filters: {
    vertical: string;
    timeWindow: string;
    overlays: string[];
    minDemand: number;
    weights: { supply: number; demand: number; transit: number };
    colorMode: string;
    boroughs: string[];
    competitorTiers: string[];
    chainFilter: string;
    maxCompetitors: number;
    aiInsights: boolean;
  };
  center: [number, number];
  zoom: number;
}

interface SavedView {
  id: string;
  name: string;
  config: SavedViewConfig;
  createdAt: string;
}

interface Props {
  onSave: (name: string) => Promise<SavedViewConfig | null>;
  onLoad: (config: SavedViewConfig) => void;
}

export function SavedViewSelector({ onSave, onLoad }: Props) {
  const [views, setViews] = useState<SavedView[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/views");
      if (!res.ok) return;
      const data = await res.json();
      setViews(data.views ?? []);
    } catch {}
  }

  useEffect(() => { refresh(); }, []);

  async function handleSave() {
    const name = prompt("Name this view:");
    if (!name?.trim()) return;
    setSaving(true);
    try {
      const config = await onSave(name.trim());
      if (!config) return;
      const res = await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), config }),
      });
      if (res.ok) {
        const { view } = await res.json();
        setViews((prev) => [view, ...prev]);
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (!confirm("Delete this saved view?")) return;
    const res = await fetch(`/api/views?id=${id}`, { method: "DELETE" });
    if (res.ok) setViews((prev) => prev.filter((v) => v.id !== id));
  }

  return (
    <div className="relative">
      <div className="flex gap-1">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex-1 flex items-center justify-between gap-1.5 px-2.5 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-zinc-300 hover:bg-zinc-900 transition-colors cursor-pointer"
        >
          <span className="flex items-center gap-1.5">
            <Bookmark size={12} className="text-zinc-500" />
            Saved views ({views.length})
          </span>
          <ChevronDown size={12} className={`text-zinc-500 transition-transform ${open ? "rotate-180" : ""}`} />
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          title="Save current view"
          className="p-1.5 bg-teal-500/15 hover:bg-teal-500/25 text-teal-400 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
        >
          <Save size={12} />
        </button>
      </div>

      {open && views.length > 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-zinc-900 border border-zinc-800 rounded-lg z-30 max-h-[240px] overflow-y-auto">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => { onLoad(v.config); setOpen(false); }}
              className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 text-left hover:bg-zinc-800/60 transition-colors cursor-pointer group"
            >
              <span className="text-xs text-zinc-300 truncate">{v.name}</span>
              <button
                onClick={(e) => handleDelete(v.id, e)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 size={10} />
              </button>
            </button>
          ))}
        </div>
      )}

      {open && views.length === 0 && (
        <div className="absolute top-full mt-1 left-0 right-0 bg-zinc-900 border border-zinc-800 rounded-lg z-30 px-2.5 py-2">
          <p className="text-[10px] text-zinc-500">No saved views yet. Click save to bookmark the current filters + map position.</p>
        </div>
      )}
    </div>
  );
}
