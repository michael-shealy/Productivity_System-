import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/supabase/route";
import { normalizeWeatherData } from "@/lib/weather";

export async function GET(request: Request) {
  const { user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const lat = searchParams.get("lat");
  const lng = searchParams.get("lng");
  const name = searchParams.get("name") ?? "Unknown";

  if (!lat || !lng) {
    return NextResponse.json(
      { error: "lat and lng query params required" },
      { status: 400 }
    );
  }

  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", lat);
  url.searchParams.set("longitude", lng);
  url.searchParams.set("current", "temperature_2m,weather_code");
  url.searchParams.set(
    "daily",
    "temperature_2m_max,temperature_2m_min,weather_code,precipitation_probability_max,sunrise,sunset"
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("forecast_days", "3");
  url.searchParams.set("timezone", "auto");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: "Open-Meteo API error", detail: text },
        { status: 502 }
      );
    }
    const raw = await res.json();
    const weather = normalizeWeatherData(raw, {
      name,
      latitude: parseFloat(lat),
      longitude: parseFloat(lng),
    });
    return NextResponse.json(weather);
  } catch (err) {
    const detail = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: "Failed to fetch weather", detail },
      { status: 502 }
    );
  }
}
