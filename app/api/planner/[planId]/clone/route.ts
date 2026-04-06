import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

type Params = { params: Promise<{ planId: string }> };

export async function POST(request: Request, { params }: Params) {
  const { planId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const source = await prisma.weeklyPlan.findFirst({
    where: { id: planId, tenantId: tu.tenantId },
    include: { slots: true },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { weekStart, name } = body as { weekStart?: string; name?: string };

  // Default: clone to next week
  const targetWeek = weekStart
    ? new Date(weekStart)
    : new Date(source.weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);

  const label = targetWeek.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const clone = await prisma.weeklyPlan.create({
    data: {
      tenantId: tu.tenantId,
      name: name ?? `Week of ${label}`,
      weekStart: targetWeek,
      status: "draft",
      slots: {
        create: source.slots.map((s) => ({
          routeId: s.routeId,
          dayOfWeek: s.dayOfWeek,
          timeWindow: s.timeWindow,
          assignedTo: s.assignedTo,
          notes: s.notes,
        })),
      },
    },
    include: { slots: true },
  });

  return NextResponse.json({ plan: clone }, { status: 201 });
}
