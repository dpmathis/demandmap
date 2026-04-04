import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

type Params = { params: Promise<{ id: string }> };

async function getRoute(routeId: string, tenantId: string) {
  return prisma.route.findFirst({
    where: { id: routeId, tenantId },
    include: {
      stops: {
        orderBy: { sortOrder: "asc" },
        include: { censusBlock: { select: { ntaName: true, borough: true, nearestSubwayMeters: true } } },
      },
    },
  });
}

export async function GET(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const route = await getRoute(id, tu.tenantId);
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ route });
}

export async function PUT(request: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.route.findFirst({ where: { id, tenantId: tu.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json().catch(() => ({}));
  const { name, vertical, status, notes } = body as {
    name?: string;
    vertical?: string;
    status?: string;
    notes?: string;
  };

  const route = await prisma.route.update({
    where: { id },
    data: { name, vertical, status, notes },
    include: { stops: { orderBy: { sortOrder: "asc" } } },
  });

  return NextResponse.json({ route });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const existing = await prisma.route.findFirst({ where: { id, tenantId: tu.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.route.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
