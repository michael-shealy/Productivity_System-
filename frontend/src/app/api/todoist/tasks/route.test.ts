import { describe, it, expect, vi, beforeEach } from "vitest";
import { TODOIST_API_BASE } from "@/lib/todoist";

// Mock Supabase route helpers
vi.mock("@/lib/supabase/route", () => ({
  getRouteUser: vi.fn(),
}));

vi.mock("@/lib/supabase/tokens", () => ({
  getOAuthToken: vi.fn(),
}));

import { getRouteUser } from "@/lib/supabase/route";
import { getOAuthToken } from "@/lib/supabase/tokens";
import { GET, POST, PATCH, DELETE } from "./route";

const mockGetRouteUser = vi.mocked(getRouteUser);
const mockGetOAuthToken = vi.mocked(getOAuthToken);

function mockAuthenticatedUser() {
  const mockSupabase = {} as any;
  mockGetRouteUser.mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "user-1" } as any,
  });
  mockGetOAuthToken.mockResolvedValue({ access_token: "test-token" });
}

beforeEach(() => {
  vi.restoreAllMocks();
  mockAuthenticatedUser();
});

describe("GET /api/todoist/tasks", () => {
  it("fetches active tasks from api/v1/tasks and parses { results: [...] }", async () => {
    const mockTasks = [
      { id: "1", content: "Task 1", added_at: "2026-02-10T00:00:00Z" },
      { id: "2", content: "Task 2", added_at: "2026-02-11T00:00:00Z" },
    ];

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ results: mockTasks }), { status: 200 })
    );

    const request = new Request("http://localhost:3000/api/todoist/tasks");
    const response = await GET(request);
    const body = await response.json();

    // Verify correct URL was called
    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe(`${TODOIST_API_BASE}/tasks`);

    // Verify normalized items
    expect(body.items).toHaveLength(2);
    expect(body.items[0].id).toBe("1");
    expect(body.items[0].title).toBe("Task 1");
    expect(body.items[0].source).toBe("todoist");
  });

  it("fetches completed tasks from api/v1/tasks/completed/by_completion_date", async () => {
    // First call: active tasks
    vi.spyOn(global, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ results: [] }), { status: 200 })
      )
      // Second call: completed tasks
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [
              { id: "99", content: "Completed task", completed_at: "2026-02-13T12:00:00Z" },
            ],
          }),
          { status: 200 }
        )
      );

    const request = new Request(
      "http://localhost:3000/api/todoist/tasks?includeCompletedToday=true"
    );
    const response = await GET(request);
    const body = await response.json();

    // Verify completed tasks URL
    const secondFetchCall = vi.mocked(global.fetch).mock.calls[1];
    expect(secondFetchCall[0]).toContain(
      `${TODOIST_API_BASE}/tasks/completed/by_completion_date?since=`
    );

    expect(body.completedToday).toHaveLength(1);
    expect(body.completedToday[0].id).toBe("99");
    expect(body.completedToday[0].status).toBe("completed");
  });
});

describe("POST /api/todoist/tasks", () => {
  it("creates a task at api/v1/tasks", async () => {
    const createdTask = { id: "new-1", content: "New task", added_at: "2026-02-13T00:00:00Z" };

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(createdTask), { status: 200 })
    );

    const request = new Request("http://localhost:3000/api/todoist/tasks", {
      method: "POST",
      body: JSON.stringify({ content: "New task" }),
    });
    const response = await POST(request);
    const body = await response.json();

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe(`${TODOIST_API_BASE}/tasks`);
    expect(fetchCall[1]?.method).toBe("POST");
    expect(body.item.title).toBe("New task");
  });
});

describe("PATCH /api/todoist/tasks", () => {
  it("closes a task at api/v1/tasks/{id}/close", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );

    const request = new Request("http://localhost:3000/api/todoist/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id: "task-1", action: "close" }),
    });
    const response = await PATCH(request);
    const body = await response.json();

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe(`${TODOIST_API_BASE}/tasks/task-1/close`);
    expect(body.ok).toBe(true);
  });

  it("reopens a task at api/v1/tasks/{id}/reopen", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );

    const request = new Request("http://localhost:3000/api/todoist/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id: "task-2", action: "reopen" }),
    });
    const response = await PATCH(request);

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe(`${TODOIST_API_BASE}/tasks/task-2/reopen`);
    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it("updates a task at api/v1/tasks/{id}", async () => {
    const updatedTask = { id: "task-3", content: "Updated", added_at: "2026-02-13T00:00:00Z" };

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(updatedTask), { status: 200 })
    );

    const request = new Request("http://localhost:3000/api/todoist/tasks", {
      method: "PATCH",
      body: JSON.stringify({ id: "task-3", content: "Updated" }),
    });
    const response = await PATCH(request);
    const body = await response.json();

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe(`${TODOIST_API_BASE}/tasks/task-3`);
    expect(body.item.title).toBe("Updated");
  });
});

describe("DELETE /api/todoist/tasks", () => {
  it("deletes a task at api/v1/tasks/{id}", async () => {
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 204 })
    );

    const request = new Request(
      "http://localhost:3000/api/todoist/tasks?id=task-del-1",
      { method: "DELETE" }
    );
    const response = await DELETE(request);
    const body = await response.json();

    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe(`${TODOIST_API_BASE}/tasks/task-del-1`);
    expect(fetchCall[1]?.method).toBe("DELETE");
    expect(body.ok).toBe(true);
  });
});
