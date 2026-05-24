import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { getSubscriptionView } from "@/app/lib/db/subscription";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const tu = await getTenantUser(user.id);
  if (!tu) {
    return NextResponse.json({ error: "No tenant" }, { status: 404 });
  }

  // Fetch subscription in parallel with the rest of the response shape
  const subscription = await getSubscriptionView(tu.tenantId);

  return NextResponse.json({
    user: {
      id: tu.id,
      authId: tu.authId,
      email: tu.email,
      name: tu.name,
      role: tu.role,
    },
    tenant: {
      id: tu.tenant.id,
      name: tu.tenant.name,
      slug: tu.tenant.slug,
      defaultVertical: tu.tenant.defaultVertical,
    },
    subscription,
  });
}
