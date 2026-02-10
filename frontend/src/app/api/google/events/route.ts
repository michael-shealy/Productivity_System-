import { NextResponse } from "next/server";
import { normalizeGoogleEvent } from "@/lib/contracts";
import { getRouteUser } from "@/lib/supabase/route";
import { getOAuthToken } from "@/lib/supabase/tokens";
import { fetchGoogleCalendarEvents } from "@/lib/google-calendar";

async function getGoogleToken() {
  const { supabase, user } = await getRouteUser();
  if (!user) return null;
  const result = await getOAuthToken(supabase, user.id, "google");
  return result?.access_token ?? null;
}

export async function GET(request: Request) {
  const token = await getGoogleToken();
  if (!token) {
    return NextResponse.json({ error: "Missing Google token" }, { status: 401 });
  }

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
  const token = await getGoogleToken();
  if (!token) {
    return NextResponse.json({ error: "Missing Google token" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    summary?: string;
    description?: string;
    location?: string;
    start?: { dateTime?: string; date?: string; timeZone?: string };
    end?: { dateTime?: string; date?: string; timeZone?: string };
    calendarId?: string;
    colorId?: string;
  };

  if (!payload.summary || !payload.start || !payload.end) {
    return NextResponse.json(
      { error: "Missing summary/start/end" },
      { status: 400 }
    );
  }

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
        start: payload.start,
        end: payload.end,
        colorId: payload.colorId,
      }),
    }
  );

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    console.error("Calendar create failed", {
      status: apiResponse.status,
      calendarId,
      detail,
    });
    return NextResponse.json(
      { error: "Calendar create failed", detail },
      { status: apiResponse.status === 429 ? 429 : 500 }
    );
  }

  const data = (await apiResponse.json()) as Record<string, unknown>;
  const item = normalizeGoogleEvent(data as any, calendarId);
  return NextResponse.json({ item });
}

export async function PATCH(request: Request) {
  const token = await getGoogleToken();
  if (!token) {
    return NextResponse.json({ error: "Missing Google token" }, { status: 401 });
  }

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
    console.error("Calendar update failed", {
      status: apiResponse.status,
      calendarId,
      detail,
    });
    return NextResponse.json(
      { error: "Calendar update failed", detail },
      { status: apiResponse.status === 429 ? 429 : 500 }
    );
  }

  const data = (await apiResponse.json()) as Record<string, unknown>;
  const item = normalizeGoogleEvent(data as any, calendarId);
  return NextResponse.json({ item });
}

export async function DELETE(request: Request) {
  const token = await getGoogleToken();
  if (!token) {
    return NextResponse.json({ error: "Missing Google token" }, { status: 401 });
  }

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
    console.error("Calendar delete failed", {
      status: apiResponse.status,
      calendarId,
      detail,
    });
    return NextResponse.json(
      { error: "Calendar delete failed", detail },
      { status: apiResponse.status === 429 ? 429 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
