import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";
import { logActivity } from "@/app/lib/activity";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ routes: [] });

  const routes = await prisma.route.findMany({
    where: { tenantId: tu.tenantId },
    include: { stops: { orderBy: { sortOrder: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({ routes });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "No workspace found. Complete onboarding first." }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { name, vertical, date } = body as { name?: string; vertical?: string; date?: string };

  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const route = await prisma.route.create({
    data: {
      tenantId: tu.tenantId,
      name: name ?? `Route – ${today}`,
      vertical: vertical ?? tu.tenant.defaultVertical,
      date: date ? new Date(date) : new Date(),
      status: "draft",
    },
    include: { stops: true },
  });

  logActivity({ tenantId: tu.tenantId, userId: user.id, userName: tu.name, action: "created", entity: "route", entityId: route.id, entityName: route.name });
  return NextResponse.json({ route }, { status: 201 });
}
