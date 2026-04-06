import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";
import { logActivity } from "@/app/lib/activity";

type Params = { params: Promise<{ id: string; stopId: string }> };

/** GET: List performance logs for a stop */
export async function GET(_req: Request, { params }: Params) {
  const { id, stopId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify route belongs to tenant
  const route = await prisma.route.findFirst({ where: { id, tenantId: tu.tenantId } });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const logs = await prisma.stopPerformanceLog.findMany({
    where: { routeStopId: stopId },
    orderBy: { date: "desc" },
    take: 30,
  });

  return NextResponse.json({ logs });
}

/** POST: Create a performance log entry */
export async function POST(request: Request, { params }: Params) {
  const { id, stopId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const route = await prisma.route.findFirst({ where: { id, tenantId: tu.tenantId } });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify stop belongs to this route
  const stop = await prisma.routeStop.findFirst({ where: { id: stopId, routeId: id } });
  if (!stop) return NextResponse.json({ error: "Stop not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { date, revenue, tips, unitsSold, rating, notes, weather } = body as {
    date?: string;
    revenue?: number;
    tips?: number;
    unitsSold?: number;
    rating?: number;
    notes?: string;
    weather?: string;
  };

  const log = await prisma.stopPerformanceLog.create({
    data: {
      routeStopId: stopId,
      date: date ? new Date(date) : new Date(),
      revenue: revenue ?? null,
      tips: tips ?? null,
      unitsSold: unitsSold ?? null,
      rating: rating != null ? Math.min(5, Math.max(1, rating)) : null,
      notes: notes ?? null,
      weather: weather ?? null,
    },
  });

  logActivity({ tenantId: tu.tenantId, userId: user.id, userName: tu.name, action: "logged_performance", entity: "performance", entityId: stopId, entityName: route.name, metadata: { revenue, rating } });
  return NextResponse.json({ log }, { status: 201 });
}
