import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/app/lib/db/prisma";
import { requireAuth } from "@/app/lib/auth-guard";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ geoid: string }> }
) {
  const { error } = await requireAuth();
  if (error) return error;

  const { geoid } = await params;

  const rows = await prisma.blockHourlyDemand.findMany({
    where: { censusBlockGeoid: geoid },
    select: { timeWindow: true, demandScore: true },
  });

  const windows: Record<string, number | null> = {};
  for (const r of rows) {
    windows[r.timeWindow] = r.demandScore;
  }

  return NextResponse.json({ geoid, windows });
}
