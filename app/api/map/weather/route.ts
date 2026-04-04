import { NextResponse } from "next/server";

const OPEN_METEO_URL =
  `https://api.open-meteo.com/v1/forecast` +
  `?latitude=40.7128&longitude=-74.006` +
  `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m` +
  `&hourly=temperature_2m,precipitation_probability,weather_code,wind_speed_10m` +
  `&forecast_days=2&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America/New_York`;

function weatherDescription(code: number): string {
  if (code === 0) return "Clear sky";
  if (code <= 3) return "Partly cloudy";
  if (code <= 48) return "Foggy";
  if (code <= 55) return "Drizzle";
  if (code <= 65) return "Rain";
  if (code <= 75) return "Snow";
  if (code <= 82) return "Rain showers";
  if (code === 95) return "Thunderstorm";
  return "Unknown";
}

function weatherIcon(code: number): string {
  if (code === 0) return "clear";
  if (code <= 3) return "cloudy";
  if (code <= 48) return "fog";
  if (code <= 67) return "rain";
  if (code <= 77) return "snow";
  if (code <= 82) return "rain";
  return "thunder";
}

export async function GET() {
  try {
    const res = await fetch(OPEN_METEO_URL, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return NextResponse.json({ error: "Weather API error" }, { status: 502 });

    const data = await res.json();
    const currentHourIdx = data.hourly.time.findIndex(
      (t: string) => t === data.current.time.slice(0, 13) + ":00"
    );
    const startIdx = Math.max(0, currentHourIdx + 1);

    return NextResponse.json({
      current: {
        temp: Math.round(data.current.temperature_2m),
        feelsLike: Math.round(data.current.apparent_temperature),
        humidity: data.current.relative_humidity_2m,
        description: weatherDescription(data.current.weather_code),
        icon: weatherIcon(data.current.weather_code),
        windSpeed: Math.round(data.current.wind_speed_10m),
        precipitation: data.current.precipitation,
      },
      forecast: data.hourly.time.slice(startIdx, startIdx + 8).map((t: string, i: number) => {
        const idx = startIdx + i;
        return {
          dt: Math.floor(new Date(t).getTime() / 1000),
          temp: Math.round(data.hourly.temperature_2m[idx]),
          pop: data.hourly.precipitation_probability[idx],
          icon: weatherIcon(data.hourly.weather_code[idx]),
        };
      }),
    }, {
      headers: { "Cache-Control": "public, s-maxage=900, stale-while-revalidate=300" },
    });
  } catch {
    return NextResponse.json({ error: "Failed to fetch weather" }, { status: 502 });
  }
}
