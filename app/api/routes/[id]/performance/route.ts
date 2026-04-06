import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

type Params = { params: Promise<{ id: string }> };

/** GET: Aggregate performance data for a route */
export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const route = await prisma.route.findFirst({
    where: { id, tenantId: tu.tenantId },
    include: { stops: { orderBy: { sortOrder: "asc" } } },
  });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const stopIds = route.stops.map((s) => s.id);
  if (stopIds.length === 0) {
    return NextResponse.json({ summary: null, stops: [] });
  }

  // Aggregate across all stops
  const agg = await prisma.stopPerformanceLog.aggregate({
    where: { routeStopId: { in: stopIds } },
    _sum: { revenue: true, tips: true, unitsSold: true },
    _avg: { revenue: true, tips: true, rating: true },
    _count: true,
  });

  // Per-stop averages
  const stopStats = await prisma.stopPerformanceLog.groupBy({
    by: ["routeStopId"],
    where: { routeStopId: { in: stopIds } },
    _avg: { revenue: true, tips: true, rating: true },
    _sum: { revenue: true, unitsSold: true },
    _count: true,
  });

  // Recent logs (last 10)
  const recentLogs = await prisma.stopPerformanceLog.findMany({
    where: { routeStopId: { in: stopIds } },
    orderBy: { date: "desc" },
    take: 10,
    include: {
      routeStop: { select: { censusBlockGeoid: true, timeWindow: true, sortOrder: true } },
    },
  });

  return NextResponse.json({
    summary: {
      totalLogs: agg._count,
      totalRevenue: agg._sum.revenue,
      totalTips: agg._sum.tips,
      totalUnits: agg._sum.unitsSold,
      avgRevenue: agg._avg.revenue,
      avgRating: agg._avg.rating,
    },
    stops: stopStats.map((s) => ({
      stopId: s.routeStopId,
      logCount: s._count,
      avgRevenue: s._avg.revenue,
      avgTips: s._avg.tips,
      avgRating: s._avg.rating,
      totalRevenue: s._sum.revenue,
      totalUnits: s._sum.unitsSold,
    })),
    recentLogs,
  });
}
