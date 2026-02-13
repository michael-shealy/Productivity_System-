export type TaskContract = {
  id: string;
  title: string;
  source: "todoist";
  status: "active" | "completed";
  priority: number;
  createdAt?: string;
  due?: {
    date?: string;
    dateTime?: string;
    timezone?: string | null;
  };
  labels: string[];
  projectId?: string | null;
  sectionId?: string | null;
  parentId?: string | null;
  url?: string;
  raw: Record<string, unknown>;
};

export type CalendarEventContract = {
  id: string;
  title: string;
  source: "google";
  status: "confirmed" | "tentative" | "cancelled" | "unknown";
  colorId?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  location?: string;
  htmlLink?: string;
  calendarId: string;
  raw: Record<string, unknown>;
};

type TodoistTaskApi = {
  id: string;
  content: string;
  description?: string;
  project_id?: string;
  section_id?: string | null;
  parent_id?: string | null;
  labels?: string[];
  priority?: number;
  url?: string;
  added_at?: string;
  due?: {
    date?: string;
    datetime?: string;
    timezone?: string | null;
  } | null;
};

type TodoistCompletedTaskApi = {
  id?: string;
  task_id?: string;
  content: string;
  project_id?: string;
  section_id?: string | null;
  parent_id?: string | null;
  labels?: string[];
  priority?: number;
  url?: string;
  completed_at?: string;
  due?: {
    date?: string;
    datetime?: string;
    timezone?: string | null;
  } | null;
};

type GoogleEventApi = {
  id: string;
  status?: "confirmed" | "tentative" | "cancelled";
  summary?: string;
  location?: string;
  htmlLink?: string;
  colorId?: string;
  start?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
  end?: {
    date?: string;
    dateTime?: string;
    timeZone?: string;
  };
};

export function normalizeTodoistTask(task: TodoistTaskApi): TaskContract {
  return {
    id: task.id,
    title: task.content,
    source: "todoist",
    status: "active",
    priority: task.priority ?? 1,
    createdAt: task.added_at,
    due: task.due
      ? {
          date: task.due.date,
          dateTime: task.due.datetime,
          timezone: task.due.timezone,
        }
      : undefined,
    labels: task.labels ?? [],
    projectId: task.project_id ?? null,
    sectionId: task.section_id ?? null,
    parentId: task.parent_id ?? null,
    url: task.url,
    raw: task as unknown as Record<string, unknown>,
  };
}

export function normalizeCompletedTodoistTask(
  task: TodoistCompletedTaskApi
): TaskContract {
  const taskId = task.id ?? task.task_id ?? "";
  return {
    id: taskId,
    title: task.content,
    source: "todoist",
    status: "completed",
    priority: task.priority ?? 1,
    createdAt: task.completed_at,
    due: task.due
      ? {
          date: task.due.date,
          dateTime: task.due.datetime,
          timezone: task.due.timezone,
        }
      : undefined,
    labels: task.labels ?? [],
    projectId: task.project_id ?? null,
    sectionId: task.section_id ?? null,
    parentId: task.parent_id ?? null,
    url: task.url,
    raw: task as unknown as Record<string, unknown>,
  };
}

export function normalizeGoogleEvent(
  event: GoogleEventApi,
  calendarId: string
): CalendarEventContract {
  return {
    id: event.id,
    title: event.summary ?? "Untitled event",
    source: "google",
    status: event.status ?? "unknown",
    colorId: event.colorId,
    start: event.start,
    end: event.end,
    location: event.location,
    htmlLink: event.htmlLink,
    calendarId,
    raw: event as unknown as Record<string, unknown>,
  };

}
