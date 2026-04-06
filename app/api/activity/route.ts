import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "50", 10);
  const cursor = req.nextUrl.searchParams.get("cursor");

  const logs = await prisma.activityLog.findMany({
    where: {
      tenantId: tu.tenantId,
      ...(cursor ? { createdAt: { lt: new Date(cursor) } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: Math.min(limit, 100),
  });

  return NextResponse.json({
    logs,
    nextCursor: logs.length > 0 ? logs[logs.length - 1].createdAt : null,
  });
}
