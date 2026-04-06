import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

type Params = { params: Promise<{ planId: string; slotId: string }> };

async function verifyOwnership(planId: string, slotId: string, tenantId: string) {
  const plan = await prisma.weeklyPlan.findFirst({ where: { id: planId, tenantId } });
  if (!plan) return null;
  const slot = await prisma.weeklyPlanSlot.findFirst({ where: { id: slotId, weeklyPlanId: planId } });
  return slot;
}

export async function PUT(request: Request, { params }: Params) {
  const { planId, slotId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await verifyOwnership(planId, slotId, tu.tenantId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { routeId, dayOfWeek, timeWindow, assignedTo, notes } = body as {
    routeId?: string;
    dayOfWeek?: number;
    timeWindow?: string;
    assignedTo?: string | null;
    notes?: string | null;
  };

  if (routeId) {
    const route = await prisma.route.findFirst({ where: { id: routeId, tenantId: tu.tenantId } });
    if (!route) return NextResponse.json({ error: "Route not found" }, { status: 404 });
  }

  const slot = await prisma.weeklyPlanSlot.update({
    where: { id: slotId },
    data: { routeId, dayOfWeek, timeWindow, assignedTo, notes },
    include: { route: true },
  });

  return NextResponse.json({ slot });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { planId, slotId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await verifyOwnership(planId, slotId, tu.tenantId);
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.weeklyPlanSlot.delete({ where: { id: slotId } });
  return NextResponse.json({ ok: true });
}
