import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { requireAuth } from "@/app/lib/auth-guard";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export async function POST(request: Request) {
  const { error } = await requireAuth();
  if (error) return error;

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: "Invalid body" }, { status: 400 });

  const { geoid, ntaName, borough, demandScore, timeWindow, competitorCount } = body as {
    geoid?: string;
    ntaName?: string | null;
    borough?: string | null;
    demandScore?: number | null;
    timeWindow?: string;
    competitorCount?: number | null;
  };

  if (!geoid || !timeWindow) {
    return NextResponse.json({ error: "geoid and timeWindow required" }, { status: 400 });
  }

  const prompt = `Block in ${ntaName ?? "NYC"}, ${borough ?? "NYC"} at time window ${timeWindow}:
- Demand score: ${demandScore ?? "unknown"}/100
- Nearby competitors (500m): ${competitorCount ?? "unknown"}

Write ONE short sentence (max 20 words) with a sharp, actionable observation for a mobile vendor about this block at this time. No preamble, just the insight.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 80,
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content[0].type === "text" ? message.content[0].text.trim() : "";
    return NextResponse.json({ insight: text });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "AI error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
