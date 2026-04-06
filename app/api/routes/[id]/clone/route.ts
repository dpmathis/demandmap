import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";
import { logActivity } from "@/app/lib/activity";

type Params = { params: Promise<{ id: string }> };

export async function POST(_req: Request, { params }: Params) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const source = await prisma.route.findFirst({
    where: { id, tenantId: tu.tenantId },
    include: { stops: { orderBy: { sortOrder: "asc" } } },
  });
  if (!source) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const clone = await prisma.route.create({
    data: {
      tenantId: tu.tenantId,
      name: `${source.name} (copy)`,
      vertical: source.vertical,
      date: new Date(),
      status: "draft",
      notes: source.notes,
      stops: {
        create: source.stops.map((s) => ({
          censusBlockGeoid: s.censusBlockGeoid,
          timeWindow: s.timeWindow,
          sortOrder: s.sortOrder,
          notes: s.notes,
          lat: s.lat,
          lng: s.lng,
        })),
      },
    },
    include: { stops: { orderBy: { sortOrder: "asc" } } },
  });

  logActivity({ tenantId: tu.tenantId, userId: user.id, userName: tu.name, action: "cloned", entity: "route", entityId: clone.id, entityName: clone.name, metadata: { sourceId: id, sourceName: source.name } });
  return NextResponse.json({ route: clone }, { status: 201 });
}
