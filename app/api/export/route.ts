import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const type = req.nextUrl.searchParams.get("type"); // routes, performance, analytics
  const format = req.nextUrl.searchParams.get("format") ?? "csv"; // csv or json

  if (!type) return NextResponse.json({ error: "Missing type parameter" }, { status: 400 });

  let data: unknown;
  let filename: string;

  switch (type) {
    case "routes": {
      const routes = await prisma.route.findMany({
        where: { tenantId: tu.tenantId },
        include: {
          stops: {
            orderBy: { sortOrder: "asc" },
            include: {
              censusBlock: { select: { ntaName: true, borough: true, nearestSubwayMeters: true } },
            },
          },
        },
        orderBy: { updatedAt: "desc" },
      });

      // Get demand scores
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
      const demandMap = new Map(demands.map((d) => [`${d.censusBlockGeoid}:${d.timeWindow}`, d.demandScore]));

      if (format === "json") {
        data = routes.map((r) => ({
          name: r.name,
          vertical: r.vertical,
          status: r.status,
          date: r.date,
          stops: r.stops.map((s) => ({
            order: s.sortOrder + 1,
            neighborhood: s.censusBlock?.ntaName,
            borough: s.censusBlock?.borough,
            timeWindow: s.timeWindow,
            demand: demandMap.get(`${s.censusBlockGeoid}:${s.timeWindow}`) ?? null,
            subwayMeters: s.censusBlock?.nearestSubwayMeters,
          })),
        }));
      } else {
        const rows = [["Route", "Vertical", "Status", "Date", "Stop #", "Neighborhood", "Borough", "Time Window", "Demand", "Subway (m)"]];
        for (const r of routes) {
          for (const s of r.stops) {
            rows.push([
              r.name,
              r.vertical,
              r.status,
              r.date ? new Date(r.date).toISOString().split("T")[0] : "",
              String(s.sortOrder + 1),
              s.censusBlock?.ntaName ?? "",
              s.censusBlock?.borough ?? "",
              s.timeWindow,
              String(demandMap.get(`${s.censusBlockGeoid}:${s.timeWindow}`) ?? ""),
              String(s.censusBlock?.nearestSubwayMeters != null ? Math.round(s.censusBlock.nearestSubwayMeters) : ""),
            ]);
          }
        }
        data = rows;
      }
      filename = "demandmap-routes";
      break;
    }

    case "performance": {
      const routes = await prisma.route.findMany({
        where: { tenantId: tu.tenantId },
        include: {
          stops: {
            include: {
              censusBlock: { select: { ntaName: true, borough: true } },
              performanceLogs: { orderBy: { date: "desc" } },
            },
          },
        },
      });

      if (format === "json") {
        data = routes.flatMap((r) =>
          r.stops.flatMap((s) =>
            s.performanceLogs.map((log) => ({
              route: r.name,
              neighborhood: s.censusBlock?.ntaName,
              borough: s.censusBlock?.borough,
              timeWindow: s.timeWindow,
              date: log.date,
              revenue: log.revenue,
              tips: log.tips,
              unitsSold: log.unitsSold,
              rating: log.rating,
              notes: log.notes,
              weather: log.weather,
            }))
          )
        );
      } else {
        const rows = [["Route", "Neighborhood", "Borough", "Time Window", "Date", "Revenue", "Tips", "Units Sold", "Rating", "Notes", "Weather"]];
        for (const r of routes) {
          for (const s of r.stops) {
            for (const log of s.performanceLogs) {
              rows.push([
                r.name,
                s.censusBlock?.ntaName ?? "",
                s.censusBlock?.borough ?? "",
                s.timeWindow,
                new Date(log.date).toISOString().split("T")[0],
                String(log.revenue ?? ""),
                String(log.tips ?? ""),
                String(log.unitsSold ?? ""),
                String(log.rating ?? ""),
                log.notes ?? "",
                log.weather ?? "",
              ]);
            }
          }
        }
        data = rows;
      }
      filename = "demandmap-performance";
      break;
    }

    case "analytics": {
      const days = parseInt(req.nextUrl.searchParams.get("days") ?? "30", 10);
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

      const dailyRevenue = await prisma.$queryRawUnsafe<
        Array<{ date: string; revenue: number; tips: number; logs: number }>
      >(`
        SELECT
          spl.date::text,
          COALESCE(SUM(spl.revenue), 0)::float as revenue,
          COALESCE(SUM(spl.tips), 0)::float as tips,
          COUNT(*)::int as logs
        FROM stop_performance_logs spl
        JOIN route_stops rs ON spl.route_stop_id = rs.id
        JOIN routes r ON rs.route_id = r.id
        WHERE r.tenant_id = $1 AND spl.date >= $2
        GROUP BY spl.date
        ORDER BY spl.date
      `, tu.tenantId, since);

      if (format === "json") {
        data = dailyRevenue;
      } else {
        const rows = [["Date", "Revenue", "Tips", "Logs"]];
        for (const d of dailyRevenue) {
          rows.push([d.date, String(d.revenue), String(d.tips), String(d.logs)]);
        }
        data = rows;
      }
      filename = `demandmap-analytics-${days}d`;
      break;
    }

    default:
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  if (format === "json") {
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="${filename}.json"`,
      },
    });
  }

  // CSV
  const csvRows = (data as string[][]).map((row) =>
    row.map((cell) => {
      if (cell.includes(",") || cell.includes('"') || cell.includes("\n")) {
        return `"${cell.replace(/"/g, '""')}"`;
      }
      return cell;
    }).join(",")
  );

  return new NextResponse(csvRows.join("\n"), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}.csv"`,
    },
  });
}
