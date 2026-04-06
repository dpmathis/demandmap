import { NextResponse } from "next/server";
import { TIME_WINDOWS } from "@/app/lib/constants";
import { requireAuth } from "@/app/lib/auth-guard";

const OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=40.7128&longitude=-74.006` +
  `&hourly=precipitation,wind_speed_10m,weather_code` +
  `&forecast_days=1&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York`;

type RiskLevel = "low" | "moderate" | "high";

function computeRisk(precipMm: number, windMph: number, weatherCode: number): RiskLevel {
  // Thunderstorm or heavy precip
  if (weatherCode >= 95 || precipMm > 0.5 || windMph > 40) return "high";
  // Light rain/snow or moderate wind
  if (precipMm > 0 || windMph > 25 || (weatherCode >= 51 && weatherCode <= 77)) return "moderate";
  return "low";
}

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  try {
    const res = await fetch(OPEN_METEO_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return NextResponse.json({ error: "Weather API error" }, { status: 502 });

    const data = await res.json();
    const times: string[] = data.hourly.time;
    const precip: number[] = data.hourly.precipitation;
    const wind: number[] = data.hourly.wind_speed_10m;
    const codes: number[] = data.hourly.weather_code;

    // Map each time window to a risk level based on worst hour in the window
    const risks: Record<string, RiskLevel> = {};

    for (const tw of TIME_WINDOWS) {
      const [startStr, endStr] = tw.split("-");
      const startHour = parseInt(startStr, 10);
      const endHour = parseInt(endStr, 10);

      let worstRisk: RiskLevel = "low";

      for (let i = 0; i < times.length; i++) {
        const hour = new Date(times[i]).getHours();
        if (hour >= startHour && hour < endHour) {
          const risk = computeRisk(precip[i] ?? 0, wind[i] ?? 0, codes[i] ?? 0);
          if (risk === "high") { worstRisk = "high"; break; }
          if (risk === "moderate") worstRisk = "moderate";
        }
      }

      risks[tw] = worstRisk;
    }

    return NextResponse.json({ risks }, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch weather risk" }, { status: 502 });
  }
}
