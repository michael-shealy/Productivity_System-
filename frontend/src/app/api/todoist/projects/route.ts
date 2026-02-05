import { NextResponse } from "next/server";

function getCookieValue(cookieHeader: string | null, name: string) {
  return cookieHeader?.match(new RegExp(`${name}=([^;]+)`))?.[1];
}

export async function GET(request: Request) {
  const token = getCookieValue(request.headers.get("cookie"), "todoist_access_token");
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
