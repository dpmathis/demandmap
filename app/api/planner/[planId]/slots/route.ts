import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

type Params = { params: Promise<{ planId: string }> };

async function verifyPlan(planId: string, tenantId: string) {
  return prisma.weeklyPlan.findFirst({ where: { id: planId, tenantId } });
}

export async function GET(_req: Request, { params }: Params) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const plan = await verifyPlan(planId, tu.tenantId);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const slots = await prisma.weeklyPlanSlot.findMany({
    where: { weeklyPlanId: planId },
    include: { route: true },
    orderBy: [{ dayOfWeek: "asc" }, { timeWindow: "asc" }],
  });

  return NextResponse.json({ slots });
}

export async function POST(request: Request, { params }: Params) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const plan = await verifyPlan(planId, tu.tenantId);
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { routeId, dayOfWeek, timeWindow, assignedTo, notes } = body as {
    routeId?: string;
    dayOfWeek?: number;
    timeWindow?: string;
    assignedTo?: string;
    notes?: string;
  };

  if (!routeId || typeof dayOfWeek !== "number" || !timeWindow) {
    return NextResponse.json({ error: "routeId, dayOfWeek, timeWindow required" }, { status: 400 });
  }

  const route = await prisma.route.findFirst({ where: { id: routeId, tenantId: tu.tenantId } });
  if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });

  const slot = await prisma.weeklyPlanSlot.create({
    data: { weeklyPlanId: planId, routeId, dayOfWeek, timeWindow, assignedTo, notes },
    include: { route: true },
  });

  return NextResponse.json({ slot }, { status: 201 });
}
