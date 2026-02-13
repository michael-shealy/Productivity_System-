import { describe, it, expect } from "vitest";
import { TODOIST_API_BASE } from "./todoist";

describe("TODOIST_API_BASE", () => {
  it("points to the v1 API", () => {
    expect(TODOIST_API_BASE).toBe("https://api.todoist.com/api/v1");
  });
});
