import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";
import { TIME_WINDOW_LABELS, type TimeWindow } from "@/app/lib/constants";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { id: routeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const route = await prisma.route.findFirst({
    where: { id: routeId, tenantId: tu.tenantId },
    include: {
      stops: {
        orderBy: { sortOrder: "asc" },
        include: {
          censusBlock: {
            select: { ntaName: true, borough: true, nearestSubwayMeters: true, totalJobs: true },
          },
        },
      },
    },
  });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const header = ["Stop #", "Neighborhood", "Borough", "Time Window", "Jobs Nearby", "Subway Distance (m)", "Notes"];
  const rows = route.stops.map((s, i) => [
    i + 1,
    s.censusBlock?.ntaName ?? s.censusBlockGeoid,
    s.censusBlock?.borough ?? "",
    TIME_WINDOW_LABELS[s.timeWindow as TimeWindow] ?? s.timeWindow,
    s.censusBlock?.totalJobs ?? "",
    s.censusBlock?.nearestSubwayMeters != null ? Math.round(s.censusBlock.nearestSubwayMeters) : "",
    s.notes ?? "",
  ]);

  const csv = [header, ...rows]
    .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const filename = `${route.name.replace(/[^a-z0-9]/gi, "-").toLowerCase()}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
