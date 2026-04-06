"use client";

import { COLOR_MODE_LABELS, type ColorMode } from "@/app/lib/constants";

interface LegendStop {
  label: string;
  color: string;
}

const LEGEND_CONFIG: Record<ColorMode, { low: LegendStop; high: LegendStop; colors: string[] }> = {
  demand: {
    low: { label: "Low", color: "#1e293b" },
    high: { label: "High", color: "#dc2626" },
    colors: ["#1e293b", "#1e3a5f", "#2563eb", "#fbbf24", "#f97316", "#dc2626"],
  },
  gap: {
    low: { label: "Saturated", color: "#1e293b" },
    high: { label: "Opportunity", color: "#7c3aed" },
    colors: ["#1e293b", "#065f46", "#059669", "#34d399", "#a855f7", "#7c3aed"],
  },
  competitors: {
    low: { label: "Few", color: "#22c55e" },
    high: { label: "Many", color: "#1e3a5f" },
    colors: ["#22c55e", "#86efac", "#fbbf24", "#3b82f6", "#1e3a5f"],
  },
  transit: {
    low: { label: "Near", color: "#dc2626" },
    high: { label: "Far", color: "#1e293b" },
    colors: ["#dc2626", "#f97316", "#fbbf24", "#2563eb", "#1e293b"],
  },
};

interface MapLegendProps {
  colorMode: ColorMode;
}

export function MapLegend({ colorMode }: MapLegendProps) {
  const config = LEGEND_CONFIG[colorMode];
  const gradient = `linear-gradient(to right, ${config.colors.join(", ")})`;

  return (
    <div className="absolute bottom-6 left-3 z-10 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl px-3 py-2 pointer-events-auto">
      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">
        {COLOR_MODE_LABELS[colorMode]}
      </p>
      <div className="w-32 h-2.5 rounded-full" style={{ background: gradient }} />
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-zinc-500">{config.low.label}</span>
        <span className="text-[9px] text-zinc-500">{config.high.label}</span>
      </div>
    </div>
  );
}
