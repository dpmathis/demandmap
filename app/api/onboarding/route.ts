import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getOrCreateTenant, getTenantUser } from "@/app/lib/db/tenant";
import { prisma } from "@/app/lib/db/prisma";

export async function GET() {
  // Returns whether the current user is an invited user (has invitedToTenantId metadata)
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ invited: false });

  const invitedToTenantId = user.user_metadata?.invitedToTenantId as string | undefined;
  if (!invitedToTenantId) return NextResponse.json({ invited: false });

  const tenant = await prisma.tenant.findUnique({ where: { id: invitedToTenantId } });
  return NextResponse.json({ invited: !!tenant, tenantName: tenant?.name ?? null });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Check if already onboarded
  const existing = await getTenantUser(user.id);
  if (existing) return NextResponse.json({ tenantId: existing.tenantId, ok: true });

  const body = await request.json().catch(() => ({}));
  const { name, orgName, vertical } = body as {
    name?: string;
    orgName?: string;
    vertical?: string;
  };

  // Invited user — join existing tenant instead of creating one
  const invitedToTenantId = user.user_metadata?.invitedToTenantId as string | undefined;
  if (invitedToTenantId) {
    const tenant = await prisma.tenant.findUnique({ where: { id: invitedToTenantId } });
    if (!tenant) {
      return NextResponse.json({ error: "Invite is no longer valid" }, { status: 404 });
    }
    const tenantUser = await prisma.tenantUser.create({
      data: {
        tenantId: invitedToTenantId,
        authId: user.id,
        email: user.email ?? "",
        name: name ?? null,
        role: "operator",
      },
    });
    return NextResponse.json({ tenantId: tenantUser.tenantId, ok: true });
  }

  // New user — create their own tenant
  try {
    const tenantUser = await getOrCreateTenant(user.id, user.email ?? "", {
      name,
      orgName,
      vertical,
    });
    return NextResponse.json({ tenantId: tenantUser.tenantId, ok: true });
  } catch (err) {
    console.error("Onboarding error:", err);
    return NextResponse.json({ error: "Failed to create workspace" }, { status: 500 });
  }
}
