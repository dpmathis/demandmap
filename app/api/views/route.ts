import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ views: [] });

  const views = await prisma.savedView.findMany({
    where: { tenantId: tu.tenantId },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ views });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { name, config } = body as { name?: string; config?: unknown };
  if (!name || !config) {
    return NextResponse.json({ error: "name and config required" }, { status: 400 });
  }

  const view = await prisma.savedView.create({
    data: {
      tenantId: tu.tenantId,
      userId: tu.id,
      name,
      config: config as object,
    },
  });

  return NextResponse.json({ view }, { status: 201 });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const existing = await prisma.savedView.findUnique({ where: { id } });
  if (!existing || existing.tenantId !== tu.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await prisma.savedView.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
