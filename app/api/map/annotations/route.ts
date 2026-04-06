import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const annotations = await prisma.mapAnnotation.findMany({
    where: {
      tenantId: tu.tenantId,
      OR: [{ expiresAt: null }, { expiresAt: { gte: new Date() } }],
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ annotations });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const { lat, lng, label, category, color, notes, expiresAt } = body as {
    lat: number;
    lng: number;
    label: string;
    category?: string;
    color?: string;
    notes?: string;
    expiresAt?: string;
  };

  if (!lat || !lng || !label) {
    return NextResponse.json({ error: "lat, lng, and label are required" }, { status: 400 });
  }

  const annotation = await prisma.mapAnnotation.create({
    data: {
      tenantId: tu.tenantId,
      userId: user.id,
      userName: tu.name,
      lat,
      lng,
      label,
      category: category ?? "note",
      color: color ?? "#14b8a6",
      notes: notes ?? null,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    },
  });

  return NextResponse.json({ annotation }, { status: 201 });
}
