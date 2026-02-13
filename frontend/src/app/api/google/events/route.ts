import { NextResponse } from "next/server";
import { normalizeGoogleEvent } from "@/lib/contracts";
import { requireProviderToken, apiErrorResponse } from "@/lib/api-helpers";
import { fetchGoogleCalendarEvents } from "@/lib/google-calendar";

export async function GET(request: Request) {
  const auth = await requireProviderToken("google");
  if (auth.error) return auth.error;
  const token = auth.token;

  const { searchParams } = new URL(request.url);

  // Support custom date range via query params, default to current month
  let timeMin: string;
  let timeMax: string;
  if (searchParams.get("timeMin") && searchParams.get("timeMax")) {
    timeMin = searchParams.get("timeMin")!;
    timeMax = searchParams.get("timeMax")!;
  } else {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    timeMin = startOfMonth.toISOString();
    timeMax = endOfMonth.toISOString();
  }

  const calendarIdsParam = searchParams.get("calendarIds");
  const calendarIds = calendarIdsParam
    ? calendarIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : ["primary"];

  const items = await fetchGoogleCalendarEvents(token, timeMin, timeMax, calendarIds);

  return NextResponse.json({ items, calendars: calendarIds });
}

export async function POST(request: Request) {
  const auth = await requireProviderToken("google");
  if (auth.error) return auth.error;
  const token = auth.token;

  const payload = (await request.json()) as {
    summary?: string;
    description?: string;
    location?: string;
    // From AI tool calls we often receive plain ISO strings for start/end.
    // Support both the string form and the full Google-style object.
    start?: { dateTime?: string; date?: string; timeZone?: string } | string;
    end?: { dateTime?: string; date?: string; timeZone?: string } | string;
    calendarId?: string;
    colorId?: string;
  };

  if (!payload.summary || !payload.start || !payload.end) {
    return NextResponse.json(
      { error: "Missing summary/start/end" },
      { status: 400 }
    );
  }

  const normalizedStart =
    typeof payload.start === "string"
      ? { dateTime: payload.start }
      : payload.start;
  const normalizedEnd =
    typeof payload.end === "string"
      ? { dateTime: payload.end }
      : payload.end;

  const calendarId = payload.calendarId ?? "primary";
  const apiResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: payload.summary,
        description: payload.description,
        location: payload.location,
        start: normalizedStart,
        end: normalizedEnd,
        colorId: payload.colorId,
      }),
    }
  );

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    return apiErrorResponse("Calendar create failed", apiResponse.status, detail);
  }

  const data = (await apiResponse.json()) as Record<string, unknown>;
  const item = normalizeGoogleEvent(data as any, calendarId);
  return NextResponse.json({ item });
}

export async function PATCH(request: Request) {
  const auth = await requireProviderToken("google");
  if (auth.error) return auth.error;
  const token = auth.token;

  const payload = (await request.json()) as {
    id?: string;
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    calendarId?: string;
    colorId?: string;
  };

  if (!payload.id) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  const calendarId = payload.calendarId ?? "primary";
  const apiResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(payload.id)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        summary: payload.summary,
        description: payload.description,
        location: payload.location,
        start: payload.start,
        end: payload.end,
        colorId: payload.colorId,
      }),
    }
  );

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    return apiErrorResponse("Calendar update failed", apiResponse.status, detail);
  }

  const data = (await apiResponse.json()) as Record<string, unknown>;
  const item = normalizeGoogleEvent(data as any, calendarId);
  return NextResponse.json({ item });
}

export async function DELETE(request: Request) {
  const auth = await requireProviderToken("google");
  if (auth.error) return auth.error;
  const token = auth.token;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const calendarId = searchParams.get("calendarId") ?? "primary";
  if (!id) {
    return NextResponse.json({ error: "Missing event id" }, { status: 400 });
  }

  const apiResponse = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
      calendarId
    )}/events/${encodeURIComponent(id)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    }
  );

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    return apiErrorResponse("Calendar delete failed", apiResponse.status, detail);
  }

  return NextResponse.json({ ok: true });
}
