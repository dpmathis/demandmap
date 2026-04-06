"use client";

import { useEffect, useState, useCallback } from "react";
import { X, Plus, MapPin, Construction, ParkingSquare, CalendarDays, AlertTriangle, StickyNote, Trash2 } from "lucide-react";

interface Annotation {
  id: string;
  lat: number;
  lng: number;
  label: string;
  category: string;
  color: string;
  notes: string | null;
  userName: string | null;
  createdAt: string;
}

const CATEGORIES = [
  { value: "note", label: "Note", icon: StickyNote },
  { value: "construction", label: "Construction", icon: Construction },
  { value: "parking", label: "Parking", icon: ParkingSquare },
  { value: "event", label: "Event", icon: CalendarDays },
  { value: "hazard", label: "Hazard", icon: AlertTriangle },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  note: "#14b8a6",
  construction: "#f59e0b",
  parking: "#3b82f6",
  event: "#a855f7",
  hazard: "#ef4444",
};

interface AnnotationLayerProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  map: any;
  active: boolean;
  onClose: () => void;
}

export function AnnotationLayer({ map, active, onClose }: AnnotationLayerProps) {
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({ label: "", category: "note", notes: "" });
  const [pendingLngLat, setPendingLngLat] = useState<{ lng: number; lat: number } | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [markers, setMarkers] = useState<any[]>([]);

  // Load annotations
  useEffect(() => {
    fetch("/api/map/annotations")
      .then((r) => r.json())
      .then((d) => setAnnotations(d.annotations ?? []))
      .catch(() => {});
  }, []);

  // Render markers on map using maplibregl
  useEffect(() => {
    if (!map) return;

    // Clear old markers
    markers.forEach((m) => m.remove());

    // Dynamically import maplibre-gl for Marker
    import("maplibre-gl").then((ml) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const newMarkers: any[] = [];

      for (const ann of annotations) {
        const el = document.createElement("div");
        el.className = "annotation-marker";
        el.style.cssText = `
          width: 24px; height: 24px; border-radius: 50%;
          background: ${ann.color}; border: 2px solid white;
          cursor: pointer; display: flex; align-items: center;
          justify-content: center; box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          font-size: 10px; color: white; font-weight: bold;
        `;
        el.textContent = ann.label.charAt(0).toUpperCase();
        el.title = `${ann.label}${ann.notes ? `\n${ann.notes}` : ""}${ann.userName ? `\n— ${ann.userName}` : ""}`;

        const marker = new ml.Marker({ element: el })
          .setLngLat([ann.lng, ann.lat])
          .addTo(map);

        newMarkers.push(marker);
      }

      setMarkers(newMarkers);
    });

    return () => {
      markers.forEach((m) => m.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, annotations]);

  // Click handler for placing annotations
  useEffect(() => {
    if (!map || !active || !creating) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    function handleClick(e: any) {
      setPendingLngLat({ lng: e.lngLat.lng, lat: e.lngLat.lat });
    }

    map.on("click", handleClick);
    map.getCanvas().style.cursor = "crosshair";

    return () => {
      map.off("click", handleClick);
      map.getCanvas().style.cursor = "";
    };
  }, [map, active, creating]);

  const handleSave = useCallback(async () => {
    if (!pendingLngLat || !formData.label.trim()) return;

    const res = await fetch("/api/map/annotations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lat: pendingLngLat.lat,
        lng: pendingLngLat.lng,
        label: formData.label.trim(),
        category: formData.category,
        color: CATEGORY_COLORS[formData.category] ?? "#14b8a6",
        notes: formData.notes.trim() || null,
      }),
    });
    if (res.ok) {
      const { annotation } = await res.json();
      setAnnotations((prev) => [annotation, ...prev]);
    }
    setPendingLngLat(null);
    setFormData({ label: "", category: "note", notes: "" });
    setCreating(false);
  }, [pendingLngLat, formData]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/map/annotations/${id}`, { method: "DELETE" });
    setAnnotations((prev) => prev.filter((a) => a.id !== id));
  }, []);

  if (!active) return null;

  return (
    <div className="absolute top-3 right-3 z-30 w-64 bg-zinc-900/95 border border-zinc-800 rounded-xl backdrop-blur shadow-2xl">
      <div className="flex items-center justify-between px-3 py-2 border-b border-zinc-800">
        <h3 className="text-xs font-semibold flex items-center gap-1.5">
          <MapPin size={12} className="text-teal-400" /> Annotations
        </h3>
        <div className="flex items-center gap-1">
          <button
            onClick={() => { setCreating(!creating); setPendingLngLat(null); }}
            className={`p-1 rounded transition-colors cursor-pointer ${creating ? "bg-teal-500/20 text-teal-400" : "text-zinc-500 hover:text-white"}`}
          >
            <Plus size={12} />
          </button>
          <button onClick={onClose} className="p-1 text-zinc-500 hover:text-white cursor-pointer">
            <X size={12} />
          </button>
        </div>
      </div>

      {creating && !pendingLngLat && (
        <div className="px-3 py-2 border-b border-zinc-800 text-[10px] text-teal-400">
          Click on the map to place an annotation
        </div>
      )}

      {pendingLngLat && (
        <div className="px-3 py-3 border-b border-zinc-800 space-y-2">
          <input
            type="text"
            value={formData.label}
            onChange={(e) => setFormData((prev) => ({ ...prev, label: e.target.value }))}
            placeholder="Label"
            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500"
            autoFocus
          />
          <div className="flex gap-1">
            {CATEGORIES.map((cat) => {
              const Icon = cat.icon;
              return (
                <button
                  key={cat.value}
                  onClick={() => setFormData((prev) => ({ ...prev, category: cat.value }))}
                  className={`flex-1 flex items-center justify-center p-1.5 rounded-lg text-[9px] transition-colors cursor-pointer ${
                    formData.category === cat.value
                      ? "bg-teal-500/20 text-teal-400"
                      : "text-zinc-500 hover:text-white hover:bg-white/5"
                  }`}
                  title={cat.label}
                >
                  <Icon size={12} />
                </button>
              );
            })}
          </div>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
            placeholder="Notes (optional)"
            rows={2}
            className="w-full px-2 py-1.5 bg-zinc-950 border border-zinc-800 rounded-lg text-xs text-white placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-teal-500 resize-none"
          />
          <div className="flex gap-1">
            <button
              onClick={handleSave}
              disabled={!formData.label.trim()}
              className="flex-1 px-2 py-1.5 bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-[10px] font-semibold rounded-lg cursor-pointer"
            >
              Save
            </button>
            <button
              onClick={() => { setPendingLngLat(null); setCreating(false); }}
              className="px-2 py-1.5 text-zinc-500 hover:text-white text-[10px] cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="max-h-60 overflow-y-auto">
        {annotations.length === 0 ? (
          <div className="px-3 py-4 text-center text-[10px] text-zinc-600">
            No annotations yet. Click + to add one.
          </div>
        ) : (
          annotations.map((ann) => (
            <div key={ann.id} className="flex items-start gap-2 px-3 py-2 border-b border-zinc-800/50 hover:bg-white/5">
              <div
                className="w-3 h-3 rounded-full mt-0.5 shrink-0"
                style={{ background: ann.color }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium truncate">{ann.label}</p>
                {ann.notes && <p className="text-[9px] text-zinc-500 truncate">{ann.notes}</p>}
                <p className="text-[8px] text-zinc-600">
                  {ann.userName ?? "Unknown"} · {new Date(ann.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </p>
              </div>
              <button
                onClick={() => handleDelete(ann.id)}
                className="p-1 text-zinc-700 hover:text-red-400 transition-colors cursor-pointer shrink-0"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
