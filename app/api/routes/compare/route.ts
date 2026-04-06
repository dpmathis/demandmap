import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

/** GET /api/routes/compare?ids=a,b,c — comparison data for up to 4 routes */
export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const ids = (req.nextUrl.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  if (ids.length < 2 || ids.length > 4) {
    return NextResponse.json({ error: "Provide 2-4 route IDs" }, { status: 400 });
  }

  const routes = await prisma.route.findMany({
    where: { id: { in: ids }, tenantId: tu.tenantId },
    include: {
      stops: {
        orderBy: { sortOrder: "asc" },
        include: {
          censusBlock: {
            select: {
              ntaName: true,
              borough: true,
              nearestSubwayMeters: true,
            },
          },
        },
      },
    },
  });

  // Get performance data for each route
  const result = await Promise.all(
    routes.map(async (route) => {
      const stopIds = route.stops.map((s) => s.id);

      let perf = null;
      if (stopIds.length > 0) {
        const agg = await prisma.stopPerformanceLog.aggregate({
          where: { routeStopId: { in: stopIds } },
          _sum: { revenue: true, tips: true },
          _avg: { revenue: true, rating: true },
          _count: true,
        });
        perf = {
          totalLogs: agg._count,
          totalRevenue: agg._sum.revenue,
          avgRevenue: agg._avg.revenue,
          avgRating: agg._avg.rating,
        };
      }

      // Get demand scores for stops
      const demandScores = await prisma.blockHourlyDemand.findMany({
        where: {
          censusBlockGeoid: { in: route.stops.map((s) => s.censusBlockGeoid) },
          timeWindow: { in: route.stops.map((s) => s.timeWindow) },
        },
      });
      const demandMap = new Map(
        demandScores.map((d) => [`${d.censusBlockGeoid}:${d.timeWindow}`, d.demandScore])
      );

      const avgDemand =
        route.stops.length > 0
          ? route.stops.reduce((sum, s) => {
              return sum + (demandMap.get(`${s.censusBlockGeoid}:${s.timeWindow}`) ?? 0);
            }, 0) / route.stops.length
          : 0;

      return {
        id: route.id,
        name: route.name,
        vertical: route.vertical,
        status: route.status,
        date: route.date,
        stopCount: route.stops.length,
        avgDemand,
        boroughs: [...new Set(route.stops.map((s) => s.censusBlock?.borough).filter(Boolean))],
        stops: route.stops.map((s) => ({
          id: s.id,
          ntaName: s.censusBlock?.ntaName ?? null,
          borough: s.censusBlock?.borough ?? null,
          timeWindow: s.timeWindow,
          demandScore: demandMap.get(`${s.censusBlockGeoid}:${s.timeWindow}`) ?? null,
          nearestSubwayMeters: s.censusBlock?.nearestSubwayMeters ?? null,
        })),
        performance: perf,
      };
    })
  );

  return NextResponse.json({ routes: result });
}
