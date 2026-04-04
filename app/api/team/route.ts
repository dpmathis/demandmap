import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { createAdminClient } from "@/app/lib/supabase/admin";
import { getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) return NextResponse.json({ members: [] });

  const members = await prisma.tenantUser.findMany({
    where: { tenantId: tu.tenantId },
    orderBy: { createdAt: "asc" },
  });

  // Get route counts per member
  const routeCounts = await prisma.route.groupBy({
    by: ["assignedTo"],
    where: { tenantId: tu.tenantId, assignedTo: { not: null } },
    _count: { id: true },
  });
  const countMap = Object.fromEntries(
    routeCounts.map((r) => [r.assignedTo!, r._count.id])
  );

  return NextResponse.json({
    members: members.map((m) => ({ ...m, routeCount: countMap[m.id] ?? 0 })),
    tenantName: tu.tenant.name,
  });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu || tu.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const { email } = await request.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  // Check if already a member
  const existing = await prisma.tenantUser.findFirst({
    where: { tenantId: tu.tenantId, email },
  });
  if (existing) return NextResponse.json({ error: "Already a team member" }, { status: 409 });

  // Send Supabase invite
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://demandmap.vercel.app"}/onboarding`,
    data: { invitedToTenantId: tu.tenantId },
  });

  if (error) {
    console.error("Invite error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, message: `Invite sent to ${email}` });
}
