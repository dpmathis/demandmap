import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

type Params = { params: Promise<{ id: string; stopId: string }> };

export async function DELETE(_req: Request, { params }: Params) {
  const { id: routeId, stopId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const route = await prisma.route.findFirst({ where: { id: routeId, tenantId: tu.tenantId } });
  if (!route) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.routeStop.deleteMany({ where: { id: stopId, routeId } });
  return NextResponse.json({ ok: true });
}
