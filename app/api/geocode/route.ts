import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/app/lib/auth-guard";

export async function GET(req: NextRequest) {
  const { error } = await requireAuth();
  if (error) return error;

  const q = req.nextUrl.searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const encoded = encodeURIComponent(`${q}, New York, NY`);
  const url =
    `https://nominatim.openstreetmap.org/search` +
    `?q=${encoded}` +
    `&format=jsonv2` +
    `&limit=5` +
    `&countrycodes=us` +
    `&viewbox=-74.27,40.92,-73.68,40.49` +
    `&bounded=1`;

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
      headers: { "User-Agent": "NYC-DemandMap/1.0" },
    });
    if (!res.ok) return NextResponse.json({ results: [] });

    const data = await res.json();
    const results = data.map((r: { display_name: string; lat: string; lon: string; type: string }) => ({
      name: r.display_name.split(",").slice(0, 3).join(","),
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      type: r.type,
    }));

    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
