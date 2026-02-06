import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/supabase/route";
import { getOAuthToken } from "@/lib/supabase/tokens";

export async function GET() {
  const { supabase, user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const result = await getOAuthToken(supabase, user.id, "todoist");
  const token = result?.access_token;
  if (!token) {
    return NextResponse.json({ error: "Missing Todoist token" }, { status: 401 });
  }

  const apiResponse = await fetch("https://api.todoist.com/rest/v2/projects", {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    console.error("Todoist projects fetch failed", {
      status: apiResponse.status,
      detail,
    });
    return NextResponse.json(
      { error: "Todoist projects fetch failed", detail },
      { status: apiResponse.status === 429 ? 429 : 500 }
    );
  }

  const data = (await apiResponse.json()) as Array<{
    id: string;
    name: string;
  }>;

  return NextResponse.json({ items: data });
}
