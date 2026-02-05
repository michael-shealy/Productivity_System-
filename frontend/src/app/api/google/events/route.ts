import { NextResponse } from "next/server";
import { normalizeGoogleEvent } from "@/lib/contracts";

function getCookieValue(cookieHeader: string | null, name: string) {
  return cookieHeader?.match(new RegExp(`${name}=([^;]+)`))?.[1];
}

export async function GET(request: Request) {
  const token = getCookieValue(request.headers.get("cookie"), "google_access_token");
  if (!token) {
    return NextResponse.json({ error: "Missing Google token" }, { status: 401 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const timeMin = startOfMonth.toISOString();
  const timeMax = endOfMonth.toISOString();

  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
  });

  const { searchParams } = new URL(request.url);
  const calendarIdsParam = searchParams.get("calendarIds");
  const calendarIds = calendarIdsParam
    ? calendarIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
    : ["primary"];

  const responses = await Promise.all(
    calendarIds.map(async (calendarId) => {
      const apiResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId
        )}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!apiResponse.ok) {
        const detail = await apiResponse.text();
        console.error("Calendar fetch failed", {
          status: apiResponse.status,
          calendarId,
          detail,
        });
        return { calendarId, error: detail, items: [] as Array<Record<string, unknown>> };
      }

      const data = (await apiResponse.json()) as {
        items?: Array<Record<string, unknown>>;
      };
      return { calendarId, items: data.items ?? [] };
    })
  );

  const items = responses.flatMap((response) =>
    response.items.map((event) => normalizeGoogleEvent(event as any, response.calendarId))
  );

  return NextResponse.json({ items, calendars: calendarIds });
}

export async function POST(request: Request) {
  const token = getCookieValue(request.headers.get("cookie"), "google_access_token");
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
  const token = getCookieValue(request.headers.get("cookie"), "google_access_token");
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
  const token = getCookieValue(request.headers.get("cookie"), "google_access_token");
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
