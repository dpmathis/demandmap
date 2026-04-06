import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";

/**
 * Morning route alerts: notify assigned team members about today's routes
 * with weather summary and top demand scores.
 * Called by Vercel Cron at 7 AM ET daily.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Find routes scheduled for today
  const routes = await prisma.route.findMany({
    where: {
      date: { gte: today, lt: tomorrow },
      status: "active",
    },
    include: {
      stops: {
        orderBy: { sortOrder: "asc" },
        include: {
          censusBlock: { select: { ntaName: true, borough: true } },
        },
      },
      tenant: { select: { id: true, name: true } },
    },
  });

  if (routes.length === 0) {
    return NextResponse.json({ checked: true, alerts: 0 });
  }

  // Fetch today's weather summary
  let weatherSummary = "";
  try {
    const res = await fetch(
      "https://api.open-meteo.com/v1/forecast" +
        "?latitude=40.7128&longitude=-74.006" +
        "&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code" +
        "&forecast_days=1&temperature_unit=fahrenheit&timezone=America/New_York",
      { signal: AbortSignal.timeout(8000) }
    );
    if (res.ok) {
      const data = await res.json();
      const high = Math.round(data.daily.temperature_2m_max[0]);
      const low = Math.round(data.daily.temperature_2m_min[0]);
      const precip = data.daily.precipitation_sum[0];
      const code = data.daily.weather_code[0];
      const condition = weatherCodeToText(code);
      weatherSummary = `${condition}, ${low}-${high}°F` + (precip > 0 ? `, ${precip.toFixed(1)}" rain` : "");
    }
  } catch {
    weatherSummary = "Weather data unavailable";
  }

  // Get demand scores for route stops
  const allGeoidTw = routes.flatMap((r) =>
    r.stops.map((s) => ({ geoid: s.censusBlockGeoid, tw: s.timeWindow }))
  );
  const demands = await prisma.blockHourlyDemand.findMany({
    where: {
      OR: allGeoidTw.map((g) => ({
        censusBlockGeoid: g.geoid,
        timeWindow: g.tw,
      })),
    },
  });
  const demandMap = new Map(
    demands.map((d) => [`${d.censusBlockGeoid}:${d.timeWindow}`, d.demandScore])
  );

  let alertCount = 0;

  for (const route of routes) {
    const stopSummary = route.stops
      .slice(0, 3)
      .map((s) => {
        const demand = demandMap.get(`${s.censusBlockGeoid}:${s.timeWindow}`);
        return `${s.censusBlock?.ntaName ?? "Unknown"}${demand != null ? ` (${demand.toFixed(0)})` : ""}`;
      })
      .join(", ");

    const extra = route.stops.length > 3 ? ` +${route.stops.length - 3} more` : "";

    const body = [
      `Route "${route.name}" is scheduled for today.`,
      weatherSummary ? `Weather: ${weatherSummary}` : null,
      `Stops: ${stopSummary}${extra}`,
    ]
      .filter(Boolean)
      .join("\n");

    // Deduplicate: skip if we already sent this alert today
    const existing = await prisma.notification.findFirst({
      where: {
        tenantId: route.tenant.id,
        type: "route_reminder",
        createdAt: { gte: today },
        metadata: { path: ["routeId"], equals: route.id },
      },
    });
    if (existing) continue;

    await prisma.notification.create({
      data: {
        tenantId: route.tenant.id,
        userId: route.assignedTo ?? null,
        type: "route_reminder",
        title: `Today: ${route.name}`,
        body,
        metadata: { routeId: route.id, weather: weatherSummary },
      },
    });
    alertCount++;
  }

  return NextResponse.json({ checked: true, alerts: alertCount });
}

function weatherCodeToText(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Fog";
  if (code <= 57) return "Drizzle";
  if (code <= 67) return "Rain";
  if (code <= 77) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code <= 86) return "Snow showers";
  if (code >= 95) return "Thunderstorm";
  return "Mixed conditions";
}
