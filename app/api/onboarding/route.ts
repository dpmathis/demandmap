import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getOrCreateTenant } from "@/app/lib/db/tenant";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const { name, orgName, vertical } = body as {
    name?: string;
    orgName?: string;
    vertical?: string;
  };

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
