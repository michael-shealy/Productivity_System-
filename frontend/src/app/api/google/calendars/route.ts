import { NextResponse } from "next/server";
import { requireProviderToken, apiErrorResponse } from "@/lib/api-helpers";

export async function GET() {
  const auth = await requireProviderToken("google");
  if (auth.error) return auth.error;
  const token = auth.token;

  const apiResponse = await fetch(
    "https://www.googleapis.com/calendar/v3/users/me/calendarList",
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    return apiErrorResponse("Calendar list fetch failed", apiResponse.status, detail);
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
