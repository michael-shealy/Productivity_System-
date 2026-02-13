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
import { GET } from "./route";

const mockGetRouteUser = vi.mocked(getRouteUser);
const mockGetOAuthToken = vi.mocked(getOAuthToken);

beforeEach(() => {
  vi.restoreAllMocks();
  const mockSupabase = {} as any;
  mockGetRouteUser.mockResolvedValue({
    supabase: mockSupabase,
    user: { id: "user-1" } as any,
  });
  mockGetOAuthToken.mockResolvedValue({ access_token: "test-token" });
});

describe("GET /api/todoist/projects", () => {
  it("fetches projects from api/v1/projects and parses { results: [...] }", async () => {
    const mockProjects = [
      { id: "p1", name: "Inbox" },
      { id: "p2", name: "Work" },
    ];

    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ results: mockProjects }), { status: 200 })
    );

    const response = await GET();
    const body = await response.json();

    // Verify correct URL
    const fetchCall = vi.mocked(global.fetch).mock.calls[0];
    expect(fetchCall[0]).toBe(`${TODOIST_API_BASE}/projects`);

    // Verify response
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toEqual({ id: "p1", name: "Inbox" });
    expect(body.items[1]).toEqual({ id: "p2", name: "Work" });
  });
});
