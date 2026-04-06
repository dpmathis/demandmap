import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";
import { getWeeklyPlanSuggestion, type RouteSummary, type WeatherDay } from "@/app/lib/ai-planner";

type Params = { params: Promise<{ planId: string }> };

type RouteWithStops = {
  id: string;
  name: string;
  vertical: string;
  stops: Array<{
    timeWindow: string;
    censusBlock: { borough: string | null } | null;
    censusBlockGeoid: string;
  }>;
};

async function fetchWeekWeather(): Promise<WeatherDay[]> {
  try {
    const url =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=40.7128&longitude=-74.006" +
      "&daily=precipitation_sum,wind_speed_10m_max,weather_code" +
      "&forecast_days=7&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York";
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return [];
    const data = await res.json();
    const precip: number[] = data.daily.precipitation_sum ?? [];
    const wind: number[] = data.daily.wind_speed_10m_max ?? [];
    const codes: number[] = data.daily.weather_code ?? [];
    return precip.map((p, i): WeatherDay => {
      const w = wind[i] ?? 0;
      const c = codes[i] ?? 0;
      const risk: WeatherDay["riskLevel"] =
        c >= 95 || p > 5 || w > 40 ? "high" : p > 0 || w > 25 || (c >= 51 && c <= 77) ? "moderate" : "low";
      const desc = c >= 95 ? "thunderstorm" : c >= 71 ? "snow" : c >= 51 ? "rain" : c >= 45 ? "fog" : c >= 1 ? "cloudy" : "clear";
      return { day: i, description: `${desc}, ${w.toFixed(0)}mph wind`, riskLevel: risk };
    });
  } catch {
    return [];
  }
}

function summarizeRoute(r: RouteWithStops): RouteSummary {
  const boroughs = new Set<string>();
  const timeWindows = new Set<string>();
  for (const s of r.stops) {
    if (s.censusBlock?.borough) boroughs.add(s.censusBlock.borough);
    if (s.timeWindow) timeWindows.add(s.timeWindow);
  }
  return {
    id: r.id,
    name: r.name,
    vertical: r.vertical,
    stopCount: r.stops.length,
    avgDemand: null,
    boroughs: Array.from(boroughs),
    timeWindows: Array.from(timeWindows),
  };
}

export async function POST(_req: Request, { params }: Params) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const plan = await prisma.weeklyPlan.findFirst({ where: { id: planId, tenantId: tu.tenantId } });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const routes = await prisma.route.findMany({
    where: { tenantId: tu.tenantId },
    include: {
      stops: {
        include: { censusBlock: { select: { borough: true } } },
      },
    },
  });

  if (routes.length === 0) {
    return NextResponse.json({ error: "No routes available to schedule" }, { status: 400 });
  }

  // Compute avg demand per route
  const summaries: RouteSummary[] = await Promise.all(
    routes.map(async (r) => {
      const base = summarizeRoute(r as RouteWithStops);
      const geoids = r.stops.map((s) => s.censusBlockGeoid);
      if (geoids.length === 0) return base;
      const demands = await prisma.blockHourlyDemand.findMany({
        where: { censusBlockGeoid: { in: geoids } },
        select: { demandScore: true },
      });
      if (demands.length === 0) return base;
      const avg = demands.reduce((s, d) => s + d.demandScore, 0) / demands.length;
      return { ...base, avgDemand: avg };
    })
  );

  const weather = await fetchWeekWeather();

  // Team size = number of tenant users
  const teamSize = await prisma.tenantUser.count({ where: { tenantId: tu.tenantId } });

  try {
    const result = await getWeeklyPlanSuggestion({
      routes: summaries,
      weather,
      teamSize: Math.max(1, teamSize),
      vertical: tu.tenant.defaultVertical,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI suggestion failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
