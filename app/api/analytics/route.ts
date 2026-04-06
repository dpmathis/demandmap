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

  const days = parseInt(req.nextUrl.searchParams.get("days") || "30", 10);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get all route IDs for this tenant
  const routes = await prisma.route.findMany({
    where: { tenantId: tu.tenantId },
    select: { id: true, name: true, stops: { select: { id: true } } },
  });

  const allStopIds = routes.flatMap((r) => r.stops.map((s) => s.id));
  if (allStopIds.length === 0) {
    return NextResponse.json({
      summary: null,
      dailyRevenue: [],
      byTimeWindow: [],
      byDayOfWeek: [],
      topStops: [],
    });
  }

  // Overall summary
  const summary = await prisma.stopPerformanceLog.aggregate({
    where: { routeStopId: { in: allStopIds }, date: { gte: since } },
    _sum: { revenue: true, tips: true, unitsSold: true },
    _avg: { revenue: true, tips: true, rating: true },
    _count: true,
  });

  // Daily revenue trend
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

  // Revenue by time window
  const byTimeWindow = await prisma.$queryRawUnsafe<
    Array<{ time_window: string; avg_revenue: number; total_revenue: number; logs: number }>
  >(`
    SELECT
      rs.time_window,
      COALESCE(AVG(spl.revenue), 0)::float as avg_revenue,
      COALESCE(SUM(spl.revenue), 0)::float as total_revenue,
      COUNT(*)::int as logs
    FROM stop_performance_logs spl
    JOIN route_stops rs ON spl.route_stop_id = rs.id
    JOIN routes r ON rs.route_id = r.id
    WHERE r.tenant_id = $1 AND spl.date >= $2
    GROUP BY rs.time_window
    ORDER BY rs.time_window
  `, tu.tenantId, since);

  // Revenue by day of week
  const byDayOfWeek = await prisma.$queryRawUnsafe<
    Array<{ dow: number; avg_revenue: number; total_revenue: number; logs: number }>
  >(`
    SELECT
      EXTRACT(DOW FROM spl.date)::int as dow,
      COALESCE(AVG(spl.revenue), 0)::float as avg_revenue,
      COALESCE(SUM(spl.revenue), 0)::float as total_revenue,
      COUNT(*)::int as logs
    FROM stop_performance_logs spl
    JOIN route_stops rs ON spl.route_stop_id = rs.id
    JOIN routes r ON rs.route_id = r.id
    WHERE r.tenant_id = $1 AND spl.date >= $2
    GROUP BY EXTRACT(DOW FROM spl.date)
    ORDER BY dow
  `, tu.tenantId, since);

  // Top stops by average revenue
  const topStops = await prisma.$queryRawUnsafe<
    Array<{
      stop_id: string;
      nta_name: string;
      time_window: string;
      avg_revenue: number;
      avg_rating: number;
      logs: number;
    }>
  >(`
    SELECT
      rs.id as stop_id,
      cb.nta_name,
      rs.time_window,
      COALESCE(AVG(spl.revenue), 0)::float as avg_revenue,
      COALESCE(AVG(spl.rating), 0)::float as avg_rating,
      COUNT(*)::int as logs
    FROM stop_performance_logs spl
    JOIN route_stops rs ON spl.route_stop_id = rs.id
    JOIN routes r ON rs.route_id = r.id
    LEFT JOIN census_blocks cb ON rs.census_block_geoid = cb.geoid
    WHERE r.tenant_id = $1 AND spl.date >= $2
    GROUP BY rs.id, cb.nta_name, rs.time_window
    HAVING COUNT(*) >= 2
    ORDER BY avg_revenue DESC
    LIMIT 10
  `, tu.tenantId, since);

  return NextResponse.json({
    summary: {
      totalLogs: summary._count,
      totalRevenue: summary._sum.revenue,
      totalTips: summary._sum.tips,
      totalUnits: summary._sum.unitsSold,
      avgRevenue: summary._avg.revenue,
      avgRating: summary._avg.rating,
    },
    dailyRevenue,
    byTimeWindow: byTimeWindow.map((r) => ({
      timeWindow: r.time_window,
      avgRevenue: r.avg_revenue,
      totalRevenue: r.total_revenue,
      logs: r.logs,
    })),
    byDayOfWeek: byDayOfWeek.map((r) => ({
      dow: r.dow,
      avgRevenue: r.avg_revenue,
      totalRevenue: r.total_revenue,
      logs: r.logs,
    })),
    topStops: topStops.map((r) => ({
      stopId: r.stop_id,
      ntaName: r.nta_name,
      timeWindow: r.time_window,
      avgRevenue: r.avg_revenue,
      avgRating: r.avg_rating,
      logs: r.logs,
    })),
  });
}
