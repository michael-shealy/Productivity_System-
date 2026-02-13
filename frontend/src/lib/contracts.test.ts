import { describe, it, expect } from "vitest";
import {
  normalizeTodoistTask,
  normalizeCompletedTodoistTask,
} from "./contracts";

describe("normalizeTodoistTask", () => {
  it("normalizes a v1 API task with all fields", () => {
    const apiTask = {
      id: "123",
      content: "Buy groceries",
      description: "Milk, eggs, bread",
      project_id: "proj-1",
      section_id: "sec-1",
      parent_id: null,
      labels: ["errands", "shopping"],
      priority: 3,
      url: "https://todoist.com/app/task/123",
      added_at: "2026-02-10T08:00:00Z",
      due: {
        date: "2026-02-14",
        datetime: "2026-02-14T10:00:00Z",
        timezone: "America/New_York",
      },
    };

    const result = normalizeTodoistTask(apiTask);

    expect(result).toEqual({
      id: "123",
      title: "Buy groceries",
      source: "todoist",
      status: "active",
      priority: 3,
      createdAt: "2026-02-10T08:00:00Z",
      due: {
        date: "2026-02-14",
        dateTime: "2026-02-14T10:00:00Z",
        timezone: "America/New_York",
      },
      labels: ["errands", "shopping"],
      projectId: "proj-1",
      sectionId: "sec-1",
      parentId: null,
      url: "https://todoist.com/app/task/123",
      raw: apiTask,
    });
  });

  it("handles minimal fields (no due, no labels)", () => {
    const apiTask = {
      id: "456",
      content: "Quick note",
    };

    const result = normalizeTodoistTask(apiTask);

    expect(result.id).toBe("456");
    expect(result.title).toBe("Quick note");
    expect(result.status).toBe("active");
    expect(result.priority).toBe(1);
    expect(result.createdAt).toBeUndefined();
    expect(result.due).toBeUndefined();
    expect(result.labels).toEqual([]);
    expect(result.projectId).toBeNull();
  });

  it("preserves raw object", () => {
    const apiTask = {
      id: "789",
      content: "Test",
      some_new_field: "unexpected",
    };

    const result = normalizeTodoistTask(apiTask);
    expect(result.raw).toEqual(apiTask);
  });
});

describe("normalizeCompletedTodoistTask", () => {
  it("normalizes a completed task with completed_at", () => {
    const apiTask = {
      id: "100",
      content: "Done task",
      completed_at: "2026-02-13T15:30:00Z",
      project_id: "proj-2",
    };

    const result = normalizeCompletedTodoistTask(apiTask);

    expect(result.id).toBe("100");
    expect(result.status).toBe("completed");
    expect(result.createdAt).toBe("2026-02-13T15:30:00Z");
  });

  it("falls back to task_id when id is missing", () => {
    const apiTask = {
      task_id: "200",
      content: "Legacy completed task",
    };

    const result = normalizeCompletedTodoistTask(apiTask);
    expect(result.id).toBe("200");
  });

  it("falls back to empty string when both id and task_id are missing", () => {
    const apiTask = {
      content: "No ID task",
    };

    const result = normalizeCompletedTodoistTask(apiTask);
    expect(result.id).toBe("");
  });
});
