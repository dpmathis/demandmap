"use client";

export type Horizon = "1h" | "today" | "7d";

interface HorizonSelectorProps {
  value: Horizon;
  onChange: (h: Horizon) => void;
}

const OPTIONS: { value: Horizon; label: string; disabled?: boolean }[] = [
  { value: "1h", label: "NEXT 1H" },
  { value: "today", label: "TODAY" },
  { value: "7d", label: "7 DAYS" },
];

export function HorizonSelector({ value, onChange }: HorizonSelectorProps) {
  return (
    <div className="flex bg-zinc-900 p-1 rounded border border-zinc-800/80 font-mono text-xs">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          onClick={() => !opt.disabled && onChange(opt.value)}
          disabled={opt.disabled}
          className={`px-3 py-1 rounded-sm transition-colors ${
            opt.disabled
              ? "text-zinc-700 cursor-not-allowed"
              : value === opt.value
              ? "bg-zinc-800 text-teal-400 border border-zinc-700 cursor-pointer"
              : "text-zinc-400 hover:text-zinc-200 cursor-pointer"
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
