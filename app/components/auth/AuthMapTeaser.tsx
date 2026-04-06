import { BarChart3, Clock, CloudRain, TrendingUp } from "lucide-react";

/**
 * Right-side split-screen teaser: procedural NYC map visualization with
 * glass overlay panels. No external assets — entirely SVG + CSS.
 */
export function AuthMapTeaser() {
  return (
    <div className="relative hidden h-full w-full overflow-hidden bg-[#050505] lg:flex lg:flex-col">
      {/* Base layers */}
      <div className="absolute inset-0 z-0">
        {/* Procedural "map" background: radial teal + linear gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950 via-zinc-950 to-teal-950/60" />

        {/* Grid pattern */}
        <svg
          className="absolute inset-0 h-full w-full opacity-25"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <pattern id="auth-grid" width="40" height="40" patternUnits="userSpaceOnUse">
              <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#27272a" strokeWidth="0.5" />
            </pattern>
            <pattern id="auth-dots" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#3f3f46" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#auth-grid)" />
          <rect width="100%" height="100%" fill="url(#auth-dots)" opacity="0.4" />
        </svg>

        {/* Faux choropleth: a few offset blocks to suggest a city grid */}
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox="0 0 800 600"
          preserveAspectRatio="xMidYMid slice"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Manhattan-ish diagonal spine */}
          <g opacity="0.35" transform="rotate(-28 400 300)">
            <rect x="340" y="80" width="60" height="440" fill="#134e4a" opacity="0.5" />
            <rect x="360" y="120" width="40" height="60" fill="#14b8a6" opacity="0.6" />
            <rect x="360" y="200" width="40" height="80" fill="#2dd4bf" opacity="0.7" />
            <rect x="360" y="300" width="40" height="50" fill="#14b8a6" opacity="0.5" />
            <rect x="360" y="380" width="40" height="70" fill="#0d9488" opacity="0.4" />
          </g>
          {/* Brooklyn/Queens blur east */}
          <rect x="500" y="280" width="220" height="260" fill="#0d9488" opacity="0.08" />
          <rect x="560" y="320" width="120" height="80" fill="#134e4a" opacity="0.3" />
        </svg>

        {/* Animated teal glow blobs */}
        <div className="auth-glow-pulse absolute left-[30%] top-[25%] h-[40vw] max-h-[520px] min-h-[280px] w-[40vw] min-w-[280px] max-w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-teal-500/30 blur-[90px] mix-blend-screen" />
        <div
          className="auth-glow-pulse absolute right-[18%] top-[62%] h-[22vw] max-h-[280px] min-h-[180px] w-[22vw] min-w-[180px] max-w-[280px] rounded-full bg-emerald-600/20 blur-[70px] mix-blend-screen"
          style={{ animationDelay: "1.5s" }}
        />
      </div>

      {/* Crosshair border + coordinates */}
      <div className="pointer-events-none absolute inset-8 z-10 border border-zinc-800/40">
        <div className="absolute left-1/2 top-0 h-4 w-px bg-zinc-700" />
        <div className="absolute bottom-0 left-1/2 h-4 w-px bg-zinc-700" />
        <div className="absolute left-0 top-1/2 h-px w-4 bg-zinc-700" />
        <div className="absolute right-0 top-1/2 h-px w-4 bg-zinc-700" />
        <span className="absolute bottom-2 right-2 font-mono text-[9px] tracking-wider text-zinc-600">
          LAT 40.7128 · LNG −74.0060
        </span>
        <span className="absolute left-2 top-2 font-mono text-[9px] tracking-wider text-zinc-600">
          NYC · DEMAND LAYER
        </span>
      </div>

      {/* Floating data pins */}
      <div className="pointer-events-none absolute inset-0 z-10">
        {/* Primary pin — Midtown hotspot */}
        <div className="auth-float absolute left-[42%] top-[34%]">
          <div className="relative flex items-center justify-center">
            <div className="z-10 flex h-4 w-4 items-center justify-center rounded-full bg-white shadow-[0_0_20px_rgba(255,255,255,0.7)]">
              <div className="h-1.5 w-1.5 rounded-full bg-zinc-950" />
            </div>
            <div className="absolute h-12 w-12 animate-ping rounded-full bg-white/20" />
          </div>
        </div>
        {/* Secondary pin — downtown */}
        <div
          className="auth-float absolute left-[34%] top-[62%]"
          style={{ animationDelay: "1s" }}
        >
          <div className="h-3 w-3 rounded-full border border-zinc-900 bg-teal-400 shadow-[0_0_10px_rgba(45,212,191,0.6)]" />
        </div>
        {/* Tertiary pin — Brooklyn */}
        <div
          className="auth-float absolute left-[62%] top-[54%]"
          style={{ animationDelay: "2s" }}
        >
          <div className="h-2.5 w-2.5 rounded-full bg-zinc-400" />
        </div>
      </div>

      {/* Overlay cards */}
      <div className="relative z-20 flex h-full w-full flex-col justify-between p-8">
        {/* Top row: active layer + weather (left) and demand forecast (right) */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3 rounded-lg border border-zinc-800/40 bg-zinc-900/60 px-4 py-2.5 backdrop-blur-md">
              <div className="h-2 w-2 animate-pulse rounded-full bg-teal-500" />
              <div className="flex flex-col">
                <span className="font-mono text-[10px] tracking-wider text-zinc-400">
                  ACTIVE LAYER
                </span>
                <span className="text-sm font-semibold tracking-wide text-zinc-100">
                  Midtown Heat Index
                </span>
              </div>
            </div>
            <div className="inline-flex max-w-[200px] flex-col gap-1 rounded-lg border border-zinc-800/40 bg-zinc-900/60 px-3 py-2 backdrop-blur-md">
              <span className="font-mono text-[9px] uppercase tracking-wider text-zinc-500">
                Weather Impact
              </span>
              <div className="flex items-center gap-2 text-xs text-zinc-300">
                <CloudRain className="h-3.5 w-3.5 text-zinc-400" strokeWidth={2} />
                <span>Showers · +15% indoor hub traffic</span>
              </div>
            </div>
          </div>

          {/* Demand forecast glass panel */}
          <div className="w-64 rounded-xl border border-zinc-800/40 bg-zinc-900/60 p-4 shadow-2xl backdrop-blur-md">
            <div className="mb-4 flex items-center justify-between">
              <span className="font-mono text-xs tracking-wider text-zinc-400">
                DEMAND FORECAST
              </span>
              <BarChart3 className="h-3.5 w-3.5 text-zinc-500" strokeWidth={2} />
            </div>
            <div className="mb-4">
              <div className="mb-1 font-mono text-2xl font-medium text-white">
                8,420
                <span className="ml-1 text-xs text-zinc-500">pax/hr</span>
              </div>
              <div className="flex w-fit items-center gap-1 rounded bg-teal-400/10 px-1.5 py-0.5 font-mono text-[10px] text-teal-400">
                <TrendingUp className="h-2.5 w-2.5" strokeWidth={2.5} />
                <span>+24% vs historical</span>
              </div>
            </div>
            <div className="flex h-16 w-full items-end justify-between gap-1 border-b border-zinc-800 pb-1">
              {[30, 45, 20, 60, 85, 100, 70, 40].map((h, i) => (
                <div
                  key={i}
                  className={`h-full w-full rounded-t-sm ${
                    h === 100
                      ? "bg-teal-500 shadow-[0_0_10px_rgba(20,184,166,0.5)]"
                      : h >= 70
                      ? "bg-zinc-700"
                      : "bg-zinc-800"
                  }`}
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
            <div className="mt-1 flex justify-between pt-1 font-mono text-[8px] text-zinc-600">
              <span>10AM</span>
              <span className="text-teal-500">3PM · PEAK</span>
              <span>8PM</span>
            </div>
          </div>
        </div>

        {/* Bottom: hourly timeline scrubber */}
        <div className="relative mx-auto mt-auto w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-800/40 bg-zinc-900/60 p-4 backdrop-blur-md">
          <div className="pointer-events-none absolute right-0 top-0 h-full w-1/3 bg-gradient-to-l from-teal-500/5 to-transparent" />
          <div className="mb-3 flex items-center justify-between px-1">
            <div className="flex items-center gap-2 font-mono text-xs text-zinc-300">
              <Clock className="h-3.5 w-3.5 text-teal-500" strokeWidth={2} />
              <span className="tracking-wider">HOURLY DEMAND WINDOW</span>
            </div>
            <div className="rounded border border-zinc-700 bg-zinc-800 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-400">
              Live Simulation
            </div>
          </div>
          <div className="relative flex h-8 w-full items-center">
            <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-zinc-800" />
            <div className="absolute top-1/2 h-1 w-[65%] -translate-y-1/2 rounded-l-full bg-gradient-to-r from-teal-900 to-teal-400" />
            <div className="absolute left-[65%] top-1/2 h-6 w-1.5 -translate-y-1/2 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.6)]" />
          </div>
          <div className="mt-2 flex justify-between px-1 font-mono text-[10px] text-zinc-500">
            <span>06:00</span>
            <span>10:00</span>
            <span className="font-bold text-teal-400">14:00</span>
            <span>18:00</span>
            <span>22:00</span>
          </div>
        </div>
      </div>
    </div>
  );
}
