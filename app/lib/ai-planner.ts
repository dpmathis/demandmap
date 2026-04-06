import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export interface RouteSummary {
  id: string;
  name: string;
  vertical: string;
  stopCount: number;
  avgDemand: number | null;
  boroughs: string[];
  timeWindows: string[];
}

export interface WeatherDay {
  day: number; // 0=Mon..6=Sun
  description: string;
  riskLevel: "low" | "moderate" | "high";
}

export interface PlannerSuggestion {
  routeId: string;
  dayOfWeek: number;
  timeWindow: string;
  reasoning: string;
}

export interface PlannerResponse {
  suggestions: PlannerSuggestion[];
  rationale: string;
}

export async function getWeeklyPlanSuggestion(params: {
  routes: RouteSummary[];
  weather: WeatherDay[];
  teamSize: number;
  vertical: string;
}): Promise<PlannerResponse> {
  const { routes, weather, teamSize, vertical } = params;

  if (routes.length === 0) {
    return { suggestions: [], rationale: "No routes available to schedule." };
  }

  const routesText = routes
    .map(
      (r) =>
        `  - id=${r.id} "${r.name}" | ${r.stopCount} stops | avg demand ${r.avgDemand?.toFixed(0) ?? "?"}/100 | ${r.boroughs.join(", ") || "NYC"} | windows: ${r.timeWindows.join(", ") || "any"}`
    )
    .join("\n");

  const weatherText = weather
    .map(
      (w) =>
        `  Day ${w.day} (${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][w.day]}): ${w.description}, risk=${w.riskLevel}`
    )
    .join("\n");

  const systemPrompt = `You are a weekly scheduling assistant for a ${vertical} mobile vendor operator in New York City.
Given available routes, the weather forecast, and team size, schedule routes across a 7-day week (Mon=0..Sun=6) and time windows.
Each time window is 2 hours: 07-09, 09-11, 11-13, 13-15, 15-17, 17-19, 19-21.
Constraints:
- Distribute workload evenly across ${teamSize} team member(s); max ${teamSize * 3} slots per day.
- Prefer high-demand routes on low-risk weather days.
- Avoid scheduling outdoor-heavy routes during high-risk weather.
- Vary boroughs across the week when possible.
- Reuse routes across days if fewer routes than slots.

Respond ONLY with valid JSON matching this schema:
{
  "suggestions": [
    { "routeId": "string", "dayOfWeek": 0-6, "timeWindow": "07-09" | "09-11" | "11-13" | "13-15" | "15-17" | "17-19" | "19-21", "reasoning": "short 1-sentence reason" }
  ],
  "rationale": "2-3 sentence overall strategy summary"
}`;

  const userPrompt = `Available routes:
${routesText}

Weather forecast for the week:
${weatherText}

Team size: ${teamSize}

Produce a balanced weekly plan. Generate 10-14 slots total (spread across the week).`;

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = message.content[0].type === "text" ? message.content[0].text : "";
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");

  return JSON.parse(jsonMatch[0]) as PlannerResponse;
}
