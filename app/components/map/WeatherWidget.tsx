"use client";

import { useState, useEffect } from "react";
import { Cloud, CloudRain, Sun, CloudSnow, CloudLightning, Wind, Droplets } from "lucide-react";

interface WeatherData {
  current: { temp: number; feelsLike: number; humidity: number; description: string; icon: string; windSpeed: number; precipitation: number };
  forecast: Array<{ dt: number; temp: number; pop: number; icon: string }>;
}

function WIcon({ icon, size = 18 }: { icon: string; size?: number }) {
  switch (icon) {
    case "clear": return <Sun size={size} className="text-amber-400" />;
    case "rain": return <CloudRain size={size} className="text-blue-400" />;
    case "snow": return <CloudSnow size={size} className="text-zinc-300" />;
    case "thunder": return <CloudLightning size={size} className="text-purple-400" />;
    default: return <Cloud size={size} className="text-zinc-400" />;
  }
}

export function WeatherWidget() {
  const [data, setData] = useState<WeatherData | null>(null);

  useEffect(() => {
    fetch("/api/map/weather")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.current) setData(d); })
      .catch(() => {});
    const i = setInterval(() => {
      fetch("/api/map/weather").then((r) => r.ok ? r.json() : null).then((d) => { if (d?.current) setData(d); }).catch(() => {});
    }, 15 * 60 * 1000);
    return () => clearInterval(i);
  }, []);

  if (!data) return null;

  return (
    <div className="absolute top-3 right-14 z-10 bg-zinc-900/90 backdrop-blur border border-zinc-800 rounded-xl p-3 min-w-[160px]">
      <div className="flex items-center gap-2 mb-1">
        <WIcon icon={data.current.icon} size={20} />
        <span className="text-lg font-bold text-white">{data.current.temp}°F</span>
      </div>
      <p className="text-[10px] text-zinc-400 capitalize mb-1.5">{data.current.description}</p>
      <div className="flex gap-3 text-[9px] text-zinc-500">
        <span className="flex items-center gap-0.5"><Wind size={9} /> {data.current.windSpeed}mph</span>
        <span className="flex items-center gap-0.5"><Droplets size={9} /> {data.current.humidity}%</span>
      </div>
      {data.forecast.length > 0 && (
        <div className="border-t border-zinc-800 mt-2 pt-2 grid grid-cols-4 gap-1">
          {data.forecast.slice(0, 4).map((f) => (
            <div key={f.dt} className="flex flex-col items-center gap-0.5">
              <span className="text-[8px] text-zinc-600">
                {new Date(f.dt * 1000).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric" })}
              </span>
              <WIcon icon={f.icon} size={12} />
              <span className="text-[9px] text-zinc-300">{f.temp}°</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
