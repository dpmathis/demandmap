import { NextResponse } from "next/server";
import { getNYCClosures } from "@/app/lib/external/nyc-closures";
import { requireAuth } from "@/app/lib/auth-guard";

export async function GET() {
  const { error } = await requireAuth();
  if (error) return error;

  const data = await getNYCClosures();
  return NextResponse.json(data, {
    headers: {
      "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300",
    },
  });
}
