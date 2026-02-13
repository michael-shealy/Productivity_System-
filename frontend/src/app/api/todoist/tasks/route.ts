import { NextResponse } from "next/server";
import { normalizeCompletedTodoistTask, normalizeTodoistTask } from "@/lib/contracts";
import { getRouteUser } from "@/lib/supabase/route";
import { getOAuthToken } from "@/lib/supabase/tokens";
import { TODOIST_API_BASE } from "@/lib/todoist";

async function getTodoistToken() {
  const { supabase, user } = await getRouteUser();
  if (!user) return null;
  const result = await getOAuthToken(supabase, user.id, "todoist");
  return result?.access_token ?? null;
}

export async function GET(request: Request) {
  const token = await getTodoistToken();
  if (!token) {
    return NextResponse.json({ error: "Missing Todoist token" }, { status: 401 });
  }

  const apiResponse = await fetch(`${TODOIST_API_BASE}/tasks`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    console.error("Todoist fetch failed", {
      status: apiResponse.status,
      detail,
    });
    return NextResponse.json(
      { error: "Todoist fetch failed", detail },
      { status: apiResponse.status === 429 ? 429 : 500 }
    );
  }

  const data = (await apiResponse.json()) as { results: Array<Record<string, unknown>> };
  const items = data.results.map((task) => normalizeTodoistTask(task as any));

  const { searchParams } = new URL(request.url);
  const includeCompletedToday = searchParams.get("includeCompletedToday") === "true";
  if (!includeCompletedToday) {
    return NextResponse.json({ items });
  }

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const since = startOfDay.toISOString();
  let completedToday: ReturnType<typeof normalizeCompletedTodoistTask>[] = [];

  try {
    const completedResponse = await fetch(
      `${TODOIST_API_BASE}/tasks/completed/by_completion_date?since=${encodeURIComponent(
        since
      )}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (completedResponse.ok) {
      const completedData = (await completedResponse.json()) as {
        items?: Array<Record<string, unknown>>;
      };
      completedToday =
        completedData.items?.map((task) => normalizeCompletedTodoistTask(task as any)) ??
        [];
    } else {
      const detail = await completedResponse.text();
      console.error("Todoist completed fetch failed", {
        status: completedResponse.status,
        detail,
      });
    }
  } catch (error) {
    console.error("Todoist completed fetch failed", error);
  }

  return NextResponse.json({ items, completedToday });
}

export async function POST(request: Request) {
  const token = await getTodoistToken();
  if (!token) {
    return NextResponse.json({ error: "Missing Todoist token" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    content?: string;
    description?: string;
    due_string?: string;
    priority?: number;
    labels?: string[];
    project_id?: string;
    section_id?: string;
    parent_id?: string;
  };

  if (!payload.content) {
    return NextResponse.json({ error: "Missing content" }, { status: 400 });
  }

  const apiResponse = await fetch(`${TODOIST_API_BASE}/tasks`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    console.error("Todoist create failed", {
      status: apiResponse.status,
      detail,
    });
    return NextResponse.json(
      { error: "Todoist create failed", detail },
      { status: apiResponse.status === 429 ? 429 : 500 }
    );
  }

  const data = (await apiResponse.json()) as Record<string, unknown>;
  const item = normalizeTodoistTask(data as any);
  return NextResponse.json({ item });
}

export async function PATCH(request: Request) {
  const token = await getTodoistToken();
  if (!token) {
    return NextResponse.json({ error: "Missing Todoist token" }, { status: 401 });
  }

  const payload = (await request.json()) as {
    id?: string;
    action?: "close" | "reopen";
    content?: string;
    description?: string;
    due_string?: string;
    priority?: number;
    labels?: string[];
    project_id?: string;
    section_id?: string;
    parent_id?: string;
  };

  if (!payload.id) {
    return NextResponse.json({ error: "Missing task id" }, { status: 400 });
  }

  if (payload.action === "close" || payload.action === "reopen") {
    const apiResponse = await fetch(
      `${TODOIST_API_BASE}/tasks/${payload.id}/${payload.action}`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }
    );

    if (!apiResponse.ok) {
      const detail = await apiResponse.text();
      console.error("Todoist update failed", {
        status: apiResponse.status,
        detail,
        action: payload.action,
      });
      return NextResponse.json(
        { error: "Todoist update failed", detail },
        { status: apiResponse.status === 429 ? 429 : 500 }
      );
    }

    return NextResponse.json({ ok: true });
  }

  const { id, action, ...updatePayload } = payload;
  const apiResponse = await fetch(`${TODOIST_API_BASE}/tasks/${id}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(updatePayload),
  });

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    console.error("Todoist update failed", {
      status: apiResponse.status,
      detail,
    });
    return NextResponse.json(
      { error: "Todoist update failed", detail },
      { status: apiResponse.status === 429 ? 429 : 500 }
    );
  }

  const text = await apiResponse.text();
  if (!text) {
    return NextResponse.json({ ok: true });
  }
  const data = JSON.parse(text) as Record<string, unknown>;
  const item = normalizeTodoistTask(data as any);
  return NextResponse.json({ item });
}

export async function DELETE(request: Request) {
  const token = await getTodoistToken();
  if (!token) {
    return NextResponse.json({ error: "Missing Todoist token" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing task id" }, { status: 400 });
  }

  const apiResponse = await fetch(`${TODOIST_API_BASE}/tasks/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!apiResponse.ok) {
    const detail = await apiResponse.text();
    console.error("Todoist delete failed", {
      status: apiResponse.status,
      detail,
    });
    return NextResponse.json(
      { error: "Todoist delete failed", detail },
      { status: apiResponse.status === 429 ? 429 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
