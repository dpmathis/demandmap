"use client";

import { useState } from "react";
import { useDraggable } from "@dnd-kit/core";
import { Search, Plus } from "lucide-react";

export interface AvailableRoute {
  id: string;
  name: string;
  vertical: string;
  stopCount: number;
}

const VERTICAL_LABEL: Record<string, string> = {
  coffee: "C-Class",
  food_truck: "F-Class",
  retail: "R-Class",
  political: "P-Class",
  events: "E-Class",
  custom: "X-Class",
};

const VERTICAL_EMOJI: Record<string, string> = {
  coffee: "☕",
  food_truck: "🚚",
  retail: "🛍",
  political: "📣",
  events: "🎪",
  custom: "⚙️",
};

function toMonoName(name: string): string {
  return name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 18);
}

function DraggableRoute({ route }: { route: AvailableRoute }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `route:${route.id}`,
    data: { type: "route", routeId: route.id, name: route.name, vertical: route.vertical },
  });

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 100 : "auto" }
    : { opacity: isDragging ? 0.4 : 1 };

  const mono = toMonoName(route.name);
  const klass = VERTICAL_LABEL[route.vertical] ?? "X-Class";
  const emoji = VERTICAL_EMOJI[route.vertical] ?? "⚙️";

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative bg-zinc-900 border border-zinc-800 rounded px-3 py-2.5 hover:border-zinc-700 cursor-grab active:cursor-grabbing transition-colors"
      {...attributes}
      {...listeners}
    >
      <div className="flex justify-between items-start mb-1 gap-2">
        <span className="font-mono text-[11px] font-bold text-zinc-200 truncate">{mono}</span>
        <span className="font-mono text-[9px] text-teal-400 bg-teal-400/10 px-1 rounded shrink-0">
          {route.stopCount} STOP{route.stopCount === 1 ? "" : "S"}
        </span>
      </div>
      <p className="text-[11px] text-zinc-400 mb-1.5 truncate">{route.name}</p>
      <div className="flex items-center gap-3 font-mono text-[9px] text-zinc-500">
        <span className="flex items-center gap-1">
          <span className="text-xs leading-none">{emoji}</span> {klass}
        </span>
      </div>
    </div>
  );
}

interface RouteDrawerProps {
  routes: AvailableRoute[];
}

export function RouteDrawer({ routes }: RouteDrawerProps) {
  const [filter, setFilter] = useState("");
  const q = filter.trim().toLowerCase();
  const visible = q
    ? routes.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          r.vertical.toLowerCase().includes(q) ||
          (VERTICAL_LABEL[r.vertical] ?? "").toLowerCase().includes(q)
      )
    : routes;

  return (
    <aside className="w-[320px] shrink-0 border-r border-zinc-800/80 bg-zinc-950 flex flex-col z-20">
      <div className="p-3 border-b border-zinc-800/80">
        <div className="flex justify-between items-center mb-3">
          <span className="font-mono text-[10px] text-zinc-500 tracking-widest uppercase">
            Saved Routes [{routes.length}]
          </span>
        </div>
        <div className="relative rounded bg-zinc-900 border border-zinc-800 flex items-center px-2 py-1.5 focus-within:border-teal-500/60 focus-within:bg-teal-500/5 transition-colors">
          <Search size={12} className="text-zinc-500" />
          <input
            type="text"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter by name, class..."
            className="bg-transparent border-none text-[11px] font-mono text-zinc-200 ml-2 w-full focus:outline-none placeholder:text-zinc-600"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {routes.length === 0 ? (
          <div className="text-[11px] text-zinc-600 text-center py-8 border border-dashed border-zinc-800 rounded">
            No routes yet.
            <br />
            Create one from the Map.
          </div>
        ) : visible.length === 0 ? (
          <div className="text-[11px] text-zinc-600 text-center py-8 font-mono">
            NO MATCH
          </div>
        ) : (
          visible.map((r) => <DraggableRoute key={r.id} route={r} />)
        )}
      </div>
      <a
        href="/routes"
        className="p-3 bg-zinc-900/50 hover:bg-zinc-800 transition-colors border-t border-zinc-800 flex items-center justify-center gap-2 group"
      >
        <Plus size={12} className="text-zinc-500 group-hover:text-teal-400" />
        <span className="font-mono text-[10px] tracking-wider text-zinc-400 group-hover:text-zinc-200">
          DEFINE NEW ROUTE
        </span>
      </a>
    </aside>
  );
}
