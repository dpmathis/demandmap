import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface RouteStop {
  geoid: string;
  ntaName: string | null;
  borough: string | null;
  timeWindow: string;
  demandScore: number | null;
}

export interface TopBlock {
  geoid: string;
  ntaName: string | null;
  borough: string | null;
  demandScore: number | null;
  compositeScore: number | null;
  totalJobs: number | null;
  nearestSubwayMeters: number | null;
  specialtyCount500m: number | null;
}

export interface WeatherSummary {
  temp: number;
  description: string;
  windSpeed: number;
  precipitation: number;
}

export interface AISuggestion {
  geoid: string;
  ntaName: string;
  borough: string;
  timeWindow: string;
  demandScore: number;
  reasoning: string;
  warnings: string[];
}

export async function getRouteSuggestion(params: {
  vertical: string;
  currentStops: RouteStop[];
  topBlocks: TopBlock[];
  weather: WeatherSummary | null;
  timeWindow: string;
}): Promise<AISuggestion> {
  const { vertical, currentStops, topBlocks, weather, timeWindow } = params;

  const verticalLabel: Record<string, string> = {
    coffee: "coffee / beverage truck",
    food_truck: "food truck",
    retail: "retail pop-up",
    political: "political canvass",
    events: "event planning",
    custom: "mobile vendor",
  };

  const currentStopsText = currentStops.length
    ? currentStops
        .map((s, i) => `  ${i + 1}. ${s.ntaName ?? s.geoid} (${s.timeWindow}) — demand ${s.demandScore ?? "?"}/100`)
        .join("\n")
    : "  (no stops yet)";

  const topBlocksText = topBlocks
    .slice(0, 8)
    .map(
      (b) =>
        `  - ${b.ntaName ?? b.geoid} (${b.borough ?? "NYC"}): demand ${b.demandScore ?? "?"}/100, composite ${b.compositeScore ?? "?"}/100, jobs ${b.totalJobs ?? "?"}, subway ${b.nearestSubwayMeters != null ? Math.round(b.nearestSubwayMeters) + "m" : "?"}, specialty competitors within 500m: ${b.specialtyCount500m ?? "?"}`
    )
    .join("\n");

  const weatherText = weather
    ? `${weather.temp}°F, ${weather.description}, wind ${weather.windSpeed}mph, precip ${weather.precipitation}in`
    : "unknown";

  const systemPrompt = `You are a route optimization assistant for ${verticalLabel[vertical] ?? "mobile vendor"} operators in New York City.
Given a route's current stops and data about candidate locations, suggest the single best next stop.
Respond ONLY with valid JSON matching this schema exactly:
{
  "geoid": "string (from the candidate list)",
  "ntaName": "string",
  "borough": "string",
  "timeWindow": "string (one of: 07-09, 09-11, 11-13, 13-15, 15-17, 17-19, 19-21)",
  "demandScore": number,
  "reasoning": "1-2 sentences explaining why this is the best next stop",
  "warnings": ["array of 0-2 short warning strings, or empty array"]
}`;

  const userPrompt = `Current route stops:
${currentStopsText}

Suggested time window: ${timeWindow}

Top candidate locations by demand score:
${topBlocksText}

Weather: ${weatherText}

Pick the best next stop from the candidates. Avoid neighborhoods already in the route. Consider demand, competition gaps, transit access, and weather.`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 512,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");

  return JSON.parse(jsonMatch[0]) as AISuggestion;
}
