import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";
import { getTenantUser } from "@/app/lib/db/tenant";
import { getSubscriptionView } from "@/app/lib/db/subscription";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const tu = await getTenantUser(user.id);
  if (!tu) {
    return NextResponse.json({
      subscription: {
        tier: "free",
        status: "none",
        currentPeriodEnd: null,
        trialEnd: null,
        isInTrial: false,
        isActive: false,
      },
    });
  }

  const view = await getSubscriptionView(tu.tenantId);
  return NextResponse.json({ subscription: view });
}
