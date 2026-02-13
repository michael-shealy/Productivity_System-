import { NextResponse } from "next/server";
import { requireProviderToken, apiErrorResponse } from "@/lib/api-helpers";
import { TODOIST_API_BASE } from "@/lib/todoist";

export async function GET() {
  const auth = await requireProviderToken("todoist");
  if (auth.error) return auth.error;
  const token = auth.token;

  const apiResponse = await fetch(`${TODOIST_API_BASE}/projects`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    return apiErrorResponse("Todoist projects fetch failed", apiResponse.status, detail);
  }

  const data = (await apiResponse.json()) as {
    results: Array<{ id: string; name: string }>;
  };

  return NextResponse.json({ items: data.results });
}
