import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

type Params = { params: Promise<{ id: string }> };

export async function POST(request: Request, { params }: Params) {
  const { id: routeId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const route = await prisma.route.findFirst({ where: { id: routeId, tenantId: tu.tenantId } });
  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  const body = await request.json();
  const { censusBlockGeoid, timeWindow, lat, lng, notes } = body as {
    censusBlockGeoid: string;
    timeWindow: string;
    lat?: number;
    lng?: number;
    notes?: string;
  };

  if (!censusBlockGeoid || !timeWindow) {
    return NextResponse.json({ error: "censusBlockGeoid and timeWindow are required" }, { status: 400 });
  }

  // Determine next sort order
  const lastStop = await prisma.routeStop.findFirst({
    where: { routeId },
    orderBy: { sortOrder: "desc" },
  });
  const sortOrder = (lastStop?.sortOrder ?? 0) + 1;

  const stop = await prisma.routeStop.create({
    data: { routeId, censusBlockGeoid, timeWindow, sortOrder, lat, lng, notes },
    include: { censusBlock: { select: { ntaName: true, borough: true } } },
  });

  return NextResponse.json({ stop }, { status: 201 });
}
