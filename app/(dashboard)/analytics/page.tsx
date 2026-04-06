"use client";

import { useEffect, useState } from "react";
import { TrendingUp, DollarSign, Star, Hash, Clock } from "lucide-react";
import { TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

const DOW_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

interface AnalyticsData {
  summary: {
    totalLogs: number;
    totalRevenue: number | null;
    totalTips: number | null;
    totalUnits: number | null;
    avgRevenue: number | null;
    avgRating: number | null;
  } | null;
  dailyRevenue: Array<{ date: string; revenue: number; tips: number; logs: number }>;
  byTimeWindow: Array<{ timeWindow: string; avgRevenue: number; totalRevenue: number; logs: number }>;
  byDayOfWeek: Array<{ dow: number; avgRevenue: number; totalRevenue: number; logs: number }>;
  topStops: Array<{ stopId: string; ntaName: string; timeWindow: string; avgRevenue: number; avgRating: number; logs: number }>;
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/analytics?days=${days}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [days]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const noData = !data?.summary || data.summary.totalLogs === 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <TrendingUp size={20} className="text-teal-400" /> Performance Analytics
          </h1>
          <p className="text-sm text-zinc-500 mt-0.5">Revenue, trends, and stop performance</p>
        </div>
        <div className="flex items-center gap-1">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                days === d ? "bg-teal-500/15 text-teal-400" : "text-zinc-500 hover:text-white hover:bg-white/5"
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {noData ? (
        <div className="text-center py-16 border border-dashed border-zinc-800 rounded-2xl">
          <TrendingUp size={32} className="text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No performance data yet</p>
          <p className="text-zinc-600 text-xs mt-1">Log revenue on your route stops to see analytics here</p>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
            <StatCard
              icon={<DollarSign size={14} />}
              label="Total Revenue"
              value={`$${(data!.summary!.totalRevenue ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              color="text-green-400"
            />
            <StatCard
              icon={<DollarSign size={14} />}
              label="Avg / Stop"
              value={`$${(data!.summary!.avgRevenue ?? 0).toFixed(0)}`}
              color="text-teal-400"
            />
            <StatCard
              icon={<Star size={14} />}
              label="Avg Rating"
              value={data!.summary!.avgRating ? `${data!.summary!.avgRating.toFixed(1)}/5` : "—"}
              color="text-amber-400"
            />
            <StatCard
              icon={<Hash size={14} />}
              label="Total Logs"
              value={data!.summary!.totalLogs.toString()}
              color="text-blue-400"
            />
          </div>

          {/* Daily Revenue Chart */}
          {data!.dailyRevenue.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 mb-6">
              <h2 className="text-sm font-semibold mb-4">Daily Revenue</h2>
              <div className="h-40 flex items-end gap-1">
                {(() => {
                  const maxRev = Math.max(...data!.dailyRevenue.map((d) => d.revenue), 1);
                  return data!.dailyRevenue.map((d, i) => (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                      <div
                        className="w-full bg-teal-500/70 rounded-t-sm hover:bg-teal-400/80 transition-colors cursor-pointer"
                        style={{ height: `${(d.revenue / maxRev) * 100}%`, minHeight: 2 }}
                        title={`${new Date(d.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}: $${d.revenue}`}
                      />
                      {data!.dailyRevenue.length <= 14 && (
                        <span className="text-[8px] text-zinc-600 font-mono">
                          {new Date(d.date).getDate()}
                        </span>
                      )}
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Revenue by Time Window */}
            {data!.byTimeWindow.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <h2 className="text-sm font-semibold mb-4 flex items-center gap-1.5">
                  <Clock size={14} className="text-teal-400" /> Revenue by Time Window
                </h2>
                <div className="space-y-2">
                  {(() => {
                    const maxAvg = Math.max(...data!.byTimeWindow.map((t) => t.avgRevenue), 1);
                    return data!.byTimeWindow.map((tw) => (
                      <div key={tw.timeWindow} className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500 font-mono w-12 text-right shrink-0">
                          {TIME_WINDOW_LABELS[tw.timeWindow as TimeWindow] ?? tw.timeWindow}
                        </span>
                        <div className="flex-1 h-5 bg-zinc-950 rounded overflow-hidden">
                          <div
                            className="h-full bg-teal-600/60 rounded"
                            style={{ width: `${(tw.avgRevenue / maxAvg) * 100}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-zinc-400 font-mono w-12 text-right shrink-0">
                          ${tw.avgRevenue.toFixed(0)}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}

            {/* Revenue by Day of Week */}
            {data!.byDayOfWeek.length > 0 && (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                <h2 className="text-sm font-semibold mb-4">Revenue by Day</h2>
                <div className="h-32 flex items-end gap-2">
                  {(() => {
                    const maxAvg = Math.max(...data!.byDayOfWeek.map((d) => d.avgRevenue), 1);
                    return data!.byDayOfWeek.map((d) => (
                      <div key={d.dow} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full bg-purple-500/60 rounded-t-sm"
                          style={{ height: `${(d.avgRevenue / maxAvg) * 100}%`, minHeight: 2 }}
                          title={`${DOW_LABELS[d.dow]}: avg $${d.avgRevenue.toFixed(0)}`}
                        />
                        <span className="text-[9px] text-zinc-500 font-mono">{DOW_LABELS[d.dow]}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Top Stops */}
          {data!.topStops.length > 0 && (
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <h2 className="text-sm font-semibold mb-4">Top Stops by Revenue</h2>
              <div className="space-y-2">
                {data!.topStops.map((stop, i) => (
                  <div key={stop.stopId} className="flex items-center gap-3 px-2 py-2 bg-zinc-950 rounded-xl">
                    <span className="text-[10px] text-zinc-600 font-mono w-4 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{stop.ntaName ?? "Unknown"}</p>
                      <p className="text-[9px] text-zinc-600">
                        {TIME_WINDOW_LABELS[stop.timeWindow as TimeWindow] ?? stop.timeWindow} · {stop.logs} logs
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-green-400">${stop.avgRevenue.toFixed(0)}</p>
                      {stop.avgRating > 0 && (
                        <p className="text-[9px] text-amber-400 flex items-center justify-end gap-0.5">
                          {stop.avgRating.toFixed(1)}<Star size={7} className="fill-amber-400" />
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
      <div className={`flex items-center gap-1 mb-1 ${color}`}>{icon}
        <span className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</span>
      </div>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  );
}
