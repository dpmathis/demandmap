import { NextResponse } from "next/server";
import { createClient } from "@/app/lib/supabase/server";

/**
 * Verify that the request has a valid Supabase session.
 * Returns the authenticated user, or a 401 NextResponse if unauthenticated.
 */
export async function requireAuth() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null as null, error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  }

  return { user, error: null as null };
}
