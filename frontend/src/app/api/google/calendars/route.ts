import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/supabase/route";
import { getOAuthToken } from "@/lib/supabase/tokens";

export async function GET() {
  const { supabase, user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await getOAuthToken(supabase, user.id, "google");
  const token = result?.access_token;
  if (!token) {
    return NextResponse.json({ error: "Missing Google token" }, { status: 401 });
  }

  const apiResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    console.error("Calendar list fetch failed", {
      status: apiResponse.status,
      detail,
    });
    return NextResponse.json(
      { error: "Calendar list fetch failed", detail },
      { status: apiResponse.status === 429 ? 429 : 500 }
    );
  }

  const data = (await apiResponse.json()) as {
    items?: Array<{ id: string; summary: string; primary?: boolean }>;
  };

  const items =
    data.items?.map((item) => ({
      id: item.id,
      name: item.summary,
      primary: !!item.primary,
    })) ?? [];

  return NextResponse.json({ items });
}
