import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

/** GET: Get notification preferences */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let prefs = await prisma.notificationPreference.findUnique({
    where: { tenantId_userId: { tenantId: tu.tenantId, userId: tu.authId } },
  });

  if (!prefs) {
    prefs = await prisma.notificationPreference.create({
      data: { tenantId: tu.tenantId, userId: tu.authId },
    });
  }

  return NextResponse.json({ preferences: prefs });
}

/** PUT: Update notification preferences */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { weatherAlerts, closureAlerts, demandAlerts, systemAlerts } = body as {
    weatherAlerts?: boolean;
    closureAlerts?: boolean;
    demandAlerts?: boolean;
    systemAlerts?: boolean;
  };

  const prefs = await prisma.notificationPreference.upsert({
    where: { tenantId_userId: { tenantId: tu.tenantId, userId: tu.authId } },
    update: {
      ...(weatherAlerts !== undefined && { weatherAlerts }),
      ...(closureAlerts !== undefined && { closureAlerts }),
      ...(demandAlerts !== undefined && { demandAlerts }),
      ...(systemAlerts !== undefined && { systemAlerts }),
    },
    create: {
      tenantId: tu.tenantId,
      userId: tu.authId,
      weatherAlerts: weatherAlerts ?? true,
      closureAlerts: closureAlerts ?? true,
      demandAlerts: demandAlerts ?? true,
      systemAlerts: systemAlerts ?? true,
    },
  });

  return NextResponse.json({ preferences: prefs });
}
