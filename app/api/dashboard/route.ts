import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tu = await getTenantUser(user.id);
  if (!tu) {
    return NextResponse.json({ error: "No tenant" }, { status: 404 });
  }

  const [routes, teamCount] = await Promise.all([
    prisma.route.findMany({
      where: { tenantId: tu.tenantId },
      include: {
        stops: {
          orderBy: { sortOrder: "asc" },
          include: { censusBlock: { select: { ntaName: true, borough: true } } },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.tenantUser.count({ where: { tenantId: tu.tenantId } }),
  ]);

  const totalStops = routes.reduce((sum, r) => sum + r.stops.length, 0);
  const activeRoutes = routes.filter((r) => r.status === "active").length;

  const recentRoutes = routes.slice(0, 5).map((r) => ({
    id: r.id,
    name: r.name,
    vertical: r.vertical,
    status: r.status,
    stopCount: r.stops.length,
    updatedAt: r.updatedAt.toISOString(),
  }));

  // Top opportunity blocks from routes' stops
  const topBlocks = routes
    .flatMap((r) =>
      r.stops.map((s) => ({
        geoid: s.censusBlockGeoid,
        ntaName: s.censusBlock?.ntaName ?? "Unknown",
        borough: s.censusBlock?.borough ?? "",
        timeWindow: s.timeWindow,
      }))
    )
    .slice(0, 6);

  return NextResponse.json({
    user: { name: tu.name, email: tu.email },
    stats: {
      totalRoutes: routes.length,
      activeRoutes,
      totalStops,
      teamMembers: teamCount,
    },
    recentRoutes,
    topBlocks,
  });
}
