import { NextResponse } from "next/server";

/**
 * Receives Web Vitals reports from clients. We don't persist these yet —
 * just log to Vercel's stdout so they show up in the Vercel function logs.
 * Easy to upgrade to a real time-series store later (Tinybird, Axiom, Neon
 * vitals table).
 */
export async function POST(request: Request) {
  try {
    const data = await request.json();
    if (typeof data !== "object" || data === null) {
      return new NextResponse(null, { status: 204 });
    }
    console.log(
      JSON.stringify({
        type: "web-vital",
        name: data.name,
        value: data.value,
        rating: data.rating,
        path: data.path,
        isNative: !!data.isNative,
        ts: new Date().toISOString(),
      }),
    );
  } catch {
    // ignore malformed payloads
  }
  // sendBeacon expects 2xx without body
  return new NextResponse(null, { status: 204 });
}

export const dynamic = "force-dynamic";
