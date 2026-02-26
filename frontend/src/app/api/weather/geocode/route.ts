import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/supabase/route";

export async function GET(request: Request) {
  const { user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q");

  if (!q || q.trim().length < 2) {
    return NextResponse.json({ results: [] });
  }

  const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
  url.searchParams.set("name", q.trim());
  url.searchParams.set("count", "5");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  try {
    const res = await fetch(url.toString());
    if (!res.ok) {
      return NextResponse.json({ results: [] });
    }
    const data = await res.json();
    const results = Array.isArray(data.results)
      ? data.results.map(
          (r: {
            name: string;
            latitude: number;
            longitude: number;
            country?: string;
            admin1?: string;
          }) => ({
            name: r.name,
            latitude: r.latitude,
            longitude: r.longitude,
            country: r.country ?? "",
            admin1: r.admin1 ?? "",
          })
        )
      : [];
    return NextResponse.json({ results });
  } catch {
    return NextResponse.json({ results: [] });
  }
}
