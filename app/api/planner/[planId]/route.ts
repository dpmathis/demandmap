import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

type Params = { params: Promise<{ planId: string }> };

export async function GET(_req: Request, { params }: Params) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const plan = await prisma.weeklyPlan.findFirst({
    where: { id: planId, tenantId: tu.tenantId },
    include: {
      slots: {
        include: { route: { include: { stops: { orderBy: { sortOrder: "asc" } } } } },
      },
    },
  });
  if (!plan) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ plan });
}

export async function PUT(request: Request, { params }: Params) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.weeklyPlan.findFirst({ where: { id: planId, tenantId: tu.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { name, status, weekStart } = body as { name?: string; status?: string; weekStart?: string };

  const plan = await prisma.weeklyPlan.update({
    where: { id: planId },
    data: {
      name,
      status,
      weekStart: weekStart ? new Date(weekStart) : undefined,
    },
    include: { slots: true },
  });

  return NextResponse.json({ plan });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.weeklyPlan.findFirst({ where: { id: planId, tenantId: tu.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.weeklyPlan.delete({ where: { id: planId } });
  return NextResponse.json({ ok: true });
}
