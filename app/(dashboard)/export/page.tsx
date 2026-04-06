"use client";

import { useState } from "react";
import { Download, FileSpreadsheet, FileJson, Route, DollarSign, TrendingUp } from "lucide-react";

const EXPORT_TYPES = [
  {
    type: "routes",
    label: "Routes & Stops",
    description: "All routes with stop details, demand scores, and subway proximity",
    icon: Route,
    color: "text-teal-400",
  },
  {
    type: "performance",
    label: "Performance Logs",
    description: "Revenue, tips, ratings, and notes for every logged stop visit",
    icon: DollarSign,
    color: "text-green-400",
  },
  {
    type: "analytics",
    label: "Daily Analytics",
    description: "Daily revenue and tip totals aggregated across all routes",
    icon: TrendingUp,
    color: "text-blue-400",
    hasRange: true,
  },
] as const;

export default function ExportPage() {
  const [downloading, setDownloading] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [days, setDays] = useState(30);

  async function handleExport(type: string, format: "csv" | "json") {
    setDownloading(`${type}-${format}`);
    setExportError(null);
    try {
      const params = new URLSearchParams({ type, format });
      if (type === "analytics") params.set("days", String(days));
      const res = await fetch(`/api/export?${params}`);
      if (!res.ok) {
        setExportError(`Export failed (${res.status}). Please try again.`);
        return;
      }

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="(.+)"/);
      const filename = match?.[1] ?? `export.${format}`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Download size={20} className="text-teal-400" /> Data Export
        </h1>
        <p className="text-sm text-zinc-500 mt-0.5">Download your data as CSV or JSON</p>
      </div>

      {exportError && (
        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
          {exportError}
        </div>
      )}

      <div className="space-y-4">
        {EXPORT_TYPES.map((exp) => {
          const Icon = exp.icon;
          return (
            <div key={exp.type} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex items-start gap-3 mb-4">
                <div className={`mt-0.5 ${exp.color}`}>
                  <Icon size={18} />
                </div>
                <div className="flex-1">
                  <h2 className="text-sm font-semibold">{exp.label}</h2>
                  <p className="text-xs text-zinc-500 mt-0.5">{exp.description}</p>
                </div>
              </div>

              {"hasRange" in exp && exp.hasRange && (
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-xs text-zinc-500">Range:</span>
                  {[7, 30, 90, 365].map((d) => (
                    <button
                      key={d}
                      onClick={() => setDays(d)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        days === d ? "bg-teal-500/15 text-teal-400" : "text-zinc-500 hover:text-white hover:bg-white/5"
                      }`}
                    >
                      {d}d
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => handleExport(exp.type, "csv")}
                  disabled={downloading === `${exp.type}-csv`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <FileSpreadsheet size={13} />
                  {downloading === `${exp.type}-csv` ? "Exporting..." : "Download CSV"}
                </button>
                <button
                  onClick={() => handleExport(exp.type, "json")}
                  disabled={downloading === `${exp.type}-json`}
                  className="flex items-center gap-1.5 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-xs font-semibold rounded-xl transition-colors cursor-pointer"
                >
                  <FileJson size={13} />
                  {downloading === `${exp.type}-json` ? "Exporting..." : "Download JSON"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
