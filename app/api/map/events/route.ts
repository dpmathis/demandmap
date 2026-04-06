import { NextResponse } from "next/server";
import { getNYCEvents } from "@/app/lib/external/nyc-events";
import { requireAuth } from "@/app/lib/auth-guard";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const data = await getNYCEvents();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=600",
    },
  });
}
