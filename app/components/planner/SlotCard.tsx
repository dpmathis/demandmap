"use client";

import { useDraggable } from "@dnd-kit/core";
import { X } from "lucide-react";

export interface SlotData {
  id: string;
  routeId: string;
  dayOfWeek: number;
  timeWindow: string;
  assignedTo?: string | null;
  notes?: string | null;
  route?: { id: string; name: string; vertical: string } | null;
}

interface SlotCardProps {
  slot: SlotData;
  onRemove: (id: string) => void;
}

export function SlotCard({ slot, onRemove }: SlotCardProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `slot:${slot.id}`,
    data: { type: "slot", slot },
  });

  const style: React.CSSProperties = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, opacity: isDragging ? 0.4 : 1, zIndex: isDragging ? 100 : "auto" }
    : { opacity: isDragging ? 0.4 : 1 };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="group relative flex flex-col bg-zinc-900 border-l-2 border-teal-500 rounded px-2 py-1.5 cursor-grab active:cursor-grabbing hover:bg-zinc-800 transition-colors shadow-sm shadow-black/50"
      {...attributes}
      {...listeners}
    >
      <div className="font-mono text-[10px] font-bold text-zinc-200 truncate pr-4">
        {slot.route?.name ?? "Route"}
      </div>
      {slot.assignedTo && (
        <div className="text-[9px] text-zinc-400 truncate">{slot.assignedTo}</div>
      )}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onRemove(slot.id);
        }}
        onPointerDown={(e) => e.stopPropagation()}
        className="absolute top-0.5 right-0.5 opacity-0 group-hover:opacity-100 p-0.5 text-zinc-500 hover:text-red-400 transition-colors cursor-pointer"
      >
        <X size={9} />
      </button>
    </div>
  );
}
