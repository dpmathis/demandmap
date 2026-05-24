import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json().catch(() => ({}));
  const { platform, token, appVersion, osVersion } = body as {
    platform?: string;
    token?: string;
    appVersion?: string;
    osVersion?: string;
  };

  if (platform !== "ios" && platform !== "android") {
    return NextResponse.json({ error: "platform must be ios or android" }, { status: 400 });
  }
  if (!token || typeof token !== "string" || token.length < 8) {
    return NextResponse.json({ error: "token missing or malformed" }, { status: 400 });
  }

  const record = await prisma.deviceToken.upsert({
    where: { platform_token: { platform, token } },
    update: {
      tenantId: tu.tenantId,
      userId: tu.authId,
      appVersion,
      osVersion,
      lastSeenAt: new Date(),
    },
    create: {
      tenantId: tu.tenantId,
      userId: tu.authId,
      platform,
      token,
      appVersion,
      osVersion,
    },
  });

  return NextResponse.json({ id: record.id });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { platform, token } = body as { platform?: string; token?: string };
  if (!platform || !token) {
    return NextResponse.json({ error: "platform and token required" }, { status: 400 });
  }

  await prisma.deviceToken.deleteMany({
    where: { platform, token, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
