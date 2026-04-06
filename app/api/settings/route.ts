import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "No tenant" }, { status: 404 });

  return NextResponse.json({
    tenant: {
      id: tu.tenant.id,
      name: tu.tenant.name,
      slug: tu.tenant.slug,
      defaultVertical: tu.tenant.defaultVertical,
    },
    role: tu.role,
  });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "No tenant" }, { status: 404 });
  if (tu.role !== "admin") return NextResponse.json({ error: "Admin only" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { name, slug, defaultVertical } = body as {
    name?: string;
    slug?: string;
    defaultVertical?: string;
  };

  const updates: Record<string, string> = {};
  if (name) updates.name = name.trim();
  if (defaultVertical) updates.defaultVertical = defaultVertical;

  if (slug) {
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 50);
    const existing = await prisma.tenant.findUnique({ where: { slug: cleanSlug } });
    if (existing && existing.id !== tu.tenantId) {
      return NextResponse.json({ error: "Slug already taken" }, { status: 409 });
    }
    updates.slug = cleanSlug;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  const tenant = await prisma.tenant.update({
    where: { id: tu.tenantId },
    data: updates,
  });

  return NextResponse.json({ tenant });
}
