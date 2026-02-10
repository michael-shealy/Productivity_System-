import { normalizeGoogleEvent, type CalendarEventContract } from "@/lib/contracts";

/**
 * Fetch Google Calendar events for a date range across one or more calendars.
 * Reusable by both the API route GET handler and the AI chat agentic loop.
 */
export async function fetchGoogleCalendarEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  calendarIds: string[] = ["primary"]
): Promise<CalendarEventContract[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
  });

  const responses = await Promise.all(
    calendarIds.map(async (calendarId) => {
      const apiResponse = await fetch(
        `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(
          calendarId
        )}/events?${params.toString()}`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!apiResponse.ok) {
        const detail = await apiResponse.text();
        console.error("Calendar fetch failed", {
          status: apiResponse.status,
          calendarId,
          detail,
        });
        return { calendarId, items: [] as Array<Record<string, unknown>> };
      }

      const data = (await apiResponse.json()) as {
        items?: Array<Record<string, unknown>>;
      };
      return { calendarId, items: data.items ?? [] };
    })
  );

  return responses.flatMap((response) =>
    response.items.map((event) => normalizeGoogleEvent(event as any, response.calendarId))
  );
}
