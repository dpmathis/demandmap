import { NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { getNYCClosures } from "@/app/lib/external/nyc-closures";
import { TIME_WINDOWS } from "@/app/lib/constants";

/**
 * Check for new alert conditions and create notifications.
 * Called by Vercel Cron every 30 minutes (GET) or manually from admin (POST).
 */
export async function GET(request: Request) {
  return checkAlerts(request);
}

export async function POST(request: Request) {
  return checkAlerts(request);
}

async function checkAlerts(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results: string[] = [];

  // 1. Weather risk check (call Open-Meteo directly)
  try {
    const weatherUrl =
      "https://api.open-meteo.com/v1/forecast" +
      "?latitude=40.7128&longitude=-74.006" +
      "&hourly=precipitation,wind_speed_10m,weather_code" +
      "&forecast_days=1&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York";

    const res = await fetch(weatherUrl, { signal: AbortSignal.timeout(10000) });
    if (res.ok) {
      const data = await res.json();
      const times: string[] = data.hourly.time;
      const precip: number[] = data.hourly.precipitation;
      const wind: number[] = data.hourly.wind_speed_10m;
      const codes: number[] = data.hourly.weather_code;

      const highRiskWindows: string[] = [];
      for (const tw of TIME_WINDOWS) {
        const [startStr, endStr] = tw.split("-");
        const startHour = parseInt(startStr, 10);
        const endHour = parseInt(endStr, 10);
        for (let i = 0; i < times.length; i++) {
          const hour = new Date(times[i]).getHours();
          if (hour >= startHour && hour < endHour) {
            if (codes[i] >= 95 || (precip[i] ?? 0) > 0.5 || (wind[i] ?? 0) > 40) {
              highRiskWindows.push(tw);
              break;
            }
          }
        }
      }

      if (highRiskWindows.length > 0) {
        await createNotificationForAllTenants(
          "weather",
          "Severe Weather Alert",
          `High weather risk during ${highRiskWindows.join(", ")}. Consider adjusting your route.`,
          { windows: highRiskWindows },
        );
        results.push(`weather: ${highRiskWindows.length} high-risk windows`);
      } else {
        results.push("weather: clear");
      }
    }
  } catch {
    results.push("weather: check failed");
  }

  // 2. Closures check (call the underlying function directly)
  try {
    const closures = await getNYCClosures();
    const count = closures?.features?.length ?? 0;
    if (count > 5) {
      await createNotificationForAllTenants(
        "closure",
        "Street Closures Active",
        `${count} active street closures in NYC today. Check the map for affected areas.`,
        { count },
      );
      results.push(`closures: ${count} active`);
    } else {
      results.push(`closures: ${count} (below threshold)`);
    }
  } catch {
    results.push("closures: check failed");
  }

  // 3. Demand spikes in current window
  try {
    const now = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hour = now.getHours();
    const windowStart = Math.floor(hour / 2) * 2;
    const windowEnd = windowStart + 2;
    const tw = `${windowStart.toString().padStart(2, "0")}-${windowEnd.toString().padStart(2, "0")}`;

    const spikeCount = await prisma.blockHourlyDemand.count({
      where: { timeWindow: tw, demandScore: { gte: 90 } },
    });

    if (spikeCount > 50) {
      await createNotificationForAllTenants(
        "demand_spike",
        "Demand Spike Detected",
        `${spikeCount} blocks showing demand scores above 90 during ${tw}. High opportunity window!`,
        { timeWindow: tw, blockCount: spikeCount },
      );
      results.push(`demand: ${spikeCount} hot blocks in ${tw}`);
    } else {
      results.push(`demand: ${spikeCount} blocks >=90 in ${tw}`);
    }
  } catch {
    results.push("demand: check failed");
  }

  return NextResponse.json({ checked: true, results });
}

async function createNotificationForAllTenants(
  type: string,
  title: string,
  body: string,
  metadata: Record<string, unknown>,
) {
  // Deduplicate: don't create if same type+title exists in last 2 hours
  const recent = await prisma.notification.findFirst({
    where: {
      type,
      title,
      createdAt: { gte: new Date(Date.now() - 2 * 60 * 60 * 1000) },
    },
  });
  if (recent) return;

  const tenants = await prisma.tenant.findMany({ select: { id: true } });
  await prisma.notification.createMany({
    data: tenants.map((t) => ({
      tenantId: t.id,
      type,
      title,
      body,
      metadata: metadata as object,
    })),
  });
}
