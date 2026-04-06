import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ plans: [] });

  const plans = await prisma.weeklyPlan.findMany({
    where: { tenantId: tu.tenantId },
    include: { slots: true },
    orderBy: { weekStart: "desc" },
  });

  return NextResponse.json({ plans });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "No workspace found. Complete onboarding first." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { name, weekStart } = body as { name?: string; weekStart?: string };

  // Default to the Monday of the current week
  const now = new Date();
  const day = now.getDay(); // 0=Sun..6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setDate(now.getDate() + diff);
  monday.setHours(0, 0, 0, 0);

  const ws = weekStart ? new Date(weekStart) : monday;
  const label = ws.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const plan = await prisma.weeklyPlan.create({
    data: {
      tenantId: tu.tenantId,
      name: name ?? `Week of ${label}`,
      weekStart: ws,
      status: "draft",
    },
    include: { slots: true },
  });

  return NextResponse.json({ plan }, { status: 201 });
}
