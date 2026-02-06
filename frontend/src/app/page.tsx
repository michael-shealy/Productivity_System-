"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CalendarEventContract, TaskContract } from "@/lib/contracts";
import type { Habit, HabitSession } from "@/lib/habits";
import type { Goal } from "@/lib/goals";
import { buildBriefingContext } from "@/lib/ai";
import { useAIBriefing } from "@/lib/useAIBriefing";
import { createClient } from "@/lib/supabase/client";
import {
  loadIdentityMetrics,
  saveIdentityMetrics,
  loadMorningFlow,
  saveMorningFlow,
  deleteMorningFlow,
  loadFocus3,
  saveFocus3,
  deleteFocus3,
  loadGoals,
  loadHabits,
  loadHabitSessions,
  loadAIBriefing as _loadAIBriefing,
} from "@/lib/supabase/data";
import type { SupabaseClient, User } from "@supabase/supabase-js";

export default function Home() {
  const [todoistTasks, setTodoistTasks] = useState<TaskContract[]>([]);
  const [completedTodayTasks, setCompletedTodayTasks] = useState<TaskContract[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitSessions, setHabitSessions] = useState<HabitSession[]>([]);
  const [habitLoading, setHabitLoading] = useState(false);
  const [habitError, setHabitError] = useState<string | null>(null);
  const [habitSource, setHabitSource] = useState("export_1770248675244");
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
  const [habitLogInputs, setHabitLogInputs] = useState<
    Record<string, { amount: string; note: string }>
  >({});
  const [habitEditId, setHabitEditId] = useState<string | null>(null);
  const [habitEditInputs, setHabitEditInputs] = useState<
    Record<
      string,
      { title: string; kind: "check" | "amount"; count: string; period: string; type: string }
    >
  >({});
  const [habitDetailView, setHabitDetailView] = useState<
    "day" | "week" | "month" | "year"
  >("week");
  const [habitMonthFocusByHabit, setHabitMonthFocusByHabit] = useState<
    Record<string, string | null>
  >({});
  const [habitSeriesPageByHabit, setHabitSeriesPageByHabit] = useState<
    Record<string, number>
  >({});
  const [morningFlowStatus, setMorningFlowStatus] = useState<
    "idle" | "in_progress" | "complete"
  >("idle");
  const [morningFlowSteps, setMorningFlowSteps] = useState({
    briefing: false,
    focus: false,
    identity: false,
    habits: false,
  });
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventContract[]>(
    []
  );
  const [todoistError, setTodoistError] = useState<string | null>(null);
  const [calendarError, setCalendarError] = useState<string | null>(null);
  const [todoistLoading, setTodoistLoading] = useState(false);
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [todoistCreateLoading, setTodoistCreateLoading] = useState(false);
  const [calendarCreateLoading, setCalendarCreateLoading] = useState(false);
  const [todoistProjects, setTodoistProjects] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [googleCalendars, setGoogleCalendars] = useState<
    Array<{ id: string; name: string; primary: boolean }>
  >([]);
  const [selectedCalendarIds, setSelectedCalendarIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<"practice" | "tasks">("practice");
  const [identityMetrics, setIdentityMetrics] = useState({
    morningGrounding: false,
    embodiedMovement: false,
    nutritionalAwareness: false,
    presentConnection: false,
    curiositySpark: false,
  });
  const [focus3Snapshot, setFocus3Snapshot] = useState<
    Array<{ id: string; label: string; type: string }>
  >([]);
  const [focus3SnapshotDate, setFocus3SnapshotDate] = useState("");
  const [focus3Editing, setFocus3Editing] = useState(false);
  const [focus3Draft, setFocus3Draft] = useState<Array<{ label: string; type: string }>>([]);
  const [focus3OverrideDate, setFocus3OverrideDate] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [taskEditForm, setTaskEditForm] = useState({
    content: "",
    description: "",
    due_string: "",
    priority: "1",
    labels: "",
    project_id: "",
    section_id: "",
    parent_id: "",
  });
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [eventEditForm, setEventEditForm] = useState({
    summary: "",
    description: "",
    location: "",
    start: "",
    end: "",
    calendarId: "",
    colorId: "",
  });

  const [newTaskContent, setNewTaskContent] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskDueString, setNewTaskDueString] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("1");
  const [newTaskLabels, setNewTaskLabels] = useState("");
  const [newTaskProjectId, setNewTaskProjectId] = useState("");
  const [newTaskSectionId, setNewTaskSectionId] = useState("");
  const [newTaskParentId, setNewTaskParentId] = useState("");

  const [newEventTitle, setNewEventTitle] = useState("");
  const [newEventStart, setNewEventStart] = useState("");
  const [newEventEnd, setNewEventEnd] = useState("");
  const [newEventLocation, setNewEventLocation] = useState("");
  const [newEventColor, setNewEventColor] = useState("");

  const hasTodoist = todoistTasks.length > 0;
  const hasCalendar = calendarEvents.length > 0;
  const identityScore = Object.values(identityMetrics).filter(Boolean).length;

  const formatEventTime = (event: CalendarEventContract) => {
    if (!event.start?.dateTime) return "All day";
    const date = new Date(event.start.dateTime);
    if (Number.isNaN(date.getTime())) return "All day";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  const calendarNameById = useMemo(() => {
    const map = new Map<string, string>();
    googleCalendars.forEach((calendar) => {
      map.set(calendar.id, calendar.name);
    });
    return map;
  }, [googleCalendars]);

  const calendarColorMap: Record<string, string> = {
    "1": "bg-indigo-500/20 border-indigo-400/40 text-indigo-200",
    "2": "bg-emerald-500/20 border-emerald-400/40 text-emerald-200",
    "3": "bg-purple-500/20 border-purple-400/40 text-purple-200",
    "4": "bg-rose-500/20 border-rose-400/40 text-rose-200",
    "5": "bg-amber-500/20 border-amber-400/40 text-amber-200",
    "6": "bg-orange-500/20 border-orange-400/40 text-orange-200",
    "7": "bg-sky-500/20 border-sky-400/40 text-sky-200",
    "8": "bg-zinc-500/20 border-zinc-400/40 text-zinc-200",
    "9": "bg-blue-500/20 border-blue-400/40 text-blue-200",
    "10": "bg-green-500/20 border-green-400/40 text-green-200",
    "11": "bg-red-500/20 border-red-400/40 text-red-200",
  };

  const calendarColorClasses = Object.values(calendarColorMap);

  const habitStyleVariants = [
    {
      card: "border-amber-900/50 bg-amber-500/10 text-amber-100",
      bar: "bg-amber-300/80",
    },
    {
      card: "border-indigo-900/50 bg-indigo-500/10 text-indigo-100",
      bar: "bg-indigo-300/80",
    },
    {
      card: "border-emerald-900/50 bg-emerald-500/10 text-emerald-100",
      bar: "bg-emerald-300/80",
    },
    {
      card: "border-rose-900/50 bg-rose-500/10 text-rose-100",
      bar: "bg-rose-300/80",
    },
    {
      card: "border-sky-900/50 bg-sky-500/10 text-sky-100",
      bar: "bg-sky-300/80",
    },
    {
      card: "border-violet-900/50 bg-violet-500/10 text-violet-100",
      bar: "bg-violet-300/80",
    },
  ];

  const getHabitStyle = (habitId: string) => {
    const hash = Array.from(habitId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return habitStyleVariants[hash % habitStyleVariants.length];
  };

  const getFallbackCalendarColor = (calendarId: string) => {
    if (!calendarId) {
      return "border-zinc-800 bg-zinc-950/40 text-zinc-200";
    }
    const hash = Array.from(calendarId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const index = hash % calendarColorClasses.length;
    return calendarColorClasses[index];
  };

  const getEventColorClass = (event: CalendarEventContract) => {
    if (event.colorId && calendarColorMap[event.colorId]) {
      return calendarColorMap[event.colorId];
    }
    return getFallbackCalendarColor(event.calendarId);
  };

  const getWeekStartKey = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return toDateKey(start);
  };

  const getMonthKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

  const getYearKey = (date: Date) => `${date.getFullYear()}`;

  const toLocalDateTimeInputValue = (value?: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const offsetMs = parsed.getTimezoneOffset() * 60000;
    const local = new Date(parsed.getTime() - offsetMs);
    return local.toISOString().slice(0, 16);
  };

  const toDateKey = (date: Date) =>
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
      date.getDate()
    ).padStart(2, "0")}`;

  const eventDateKey = (event: CalendarEventContract) => {
    const raw = event.start?.dateTime ?? event.start?.date;
    if (!raw) return null;
    const parsed = event.start?.dateTime ? new Date(raw) : new Date(`${raw}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return toDateKey(parsed);
  };

  const sortedTasks = useMemo(() => {
    if (!hasTodoist) return [];
    return [...todoistTasks].sort((a, b) => {
      const aDate = a.due?.dateTime ?? a.due?.date;
      const bDate = b.due?.dateTime ?? b.due?.date;
      if (!aDate && !bDate) return 0;
      if (!aDate) return 1;
      if (!bDate) return -1;
      const dateDiff = new Date(aDate).getTime() - new Date(bDate).getTime();
      if (dateDiff !== 0) return dateDiff;
      return (b.priority ?? 1) - (a.priority ?? 1);
    });
  }, [hasTodoist, todoistTasks]);

  const today = new Date();
  const todayKey = toDateKey(today);

  const dueTodayTasks = useMemo(() => {
    if (!hasTodoist) return [];
    return sortedTasks.filter((task) => {
      const raw = task.due?.dateTime ?? task.due?.date;
      if (!raw) return false;
      const parsed = task.due?.dateTime ? new Date(raw) : new Date(`${raw}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return false;
      return toDateKey(parsed) === todayKey;
    });
  }, [hasTodoist, sortedTasks, todayKey]);

  const focusTasks = hasTodoist
    ? dueTodayTasks.length
      ? dueTodayTasks
      : sortedTasks.slice(0, 3)
    : [
        { id: "sample-1", title: "Finalize weekly priorities" } as TaskContract,
        { id: "sample-2", title: "Review internship prep notes" } as TaskContract,
        { id: "sample-3", title: "Plan weekend social check-in" } as TaskContract,
      ];

  const remainingTasks = hasTodoist
    ? sortedTasks
        .filter((task) => !focusTasks.find((focus) => focus.id === task.id))
        .slice(0, 3)
    : [
        { id: "sample-4", title: "Grocery list + meal plan" } as TaskContract,
        { id: "sample-5", title: "Read 10 pages (curiosity)" } as TaskContract,
        { id: "sample-6", title: "Confirm Boston conference logistics" } as TaskContract,
      ];

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventContract[]>();
    calendarEvents.forEach((event) => {
      const key = eventDateKey(event);
      if (!key) return;
      const existing = map.get(key) ?? [];
      existing.push(event);
      map.set(key, existing);
    });
    return map;
  }, [calendarEvents]);

  const todayEvents = useMemo(() => {
    const items = eventsByDate.get(todayKey) ?? [];
    return [...items].sort((a, b) => {
      const aRaw = a.start?.dateTime ?? a.start?.date ?? "";
      const bRaw = b.start?.dateTime ?? b.start?.date ?? "";
      return new Date(aRaw).getTime() - new Date(bRaw).getTime();
    });
  }, [eventsByDate, todayKey]);

  const todayAgendaEvents = useMemo(() => {
    return todayEvents.filter((event) => {
      const calendarName = calendarNameById.get(event.calendarId) ?? "";
      return calendarName !== "Todoist";
    });
  }, [todayEvents, calendarNameById]);

  const focusAreas = [
    {
      id: "weight",
      label: "Weight loss & nutrition",
      keywords: [
        "calorie",
        "weight",
        "run",
        "meal",
        "protein",
        "gym",
        "workout",
        "exercise",
        "walk",
        "mobility",
        "steps",
      ],
    },
    {
      id: "technical",
      label: "Technical skills",
      keywords: [
        "python",
        "causal",
        "a/b",
        "ab test",
        "experiment",
        "model",
        "ml",
        "ai",
        "data",
        "coding",
        "vibe",
        "project",
      ],
    },
    {
      id: "curiosity",
      label: "Curiosity & learning",
      keywords: ["read", "reading", "article", "newsletter", "book", "curiosity"],
    },
    {
      id: "relationship",
      label: "Relationship & connection",
      keywords: ["wedding", "fiance", "fiancée", "date", "coffee", "family", "friend"],
    },
    {
      id: "mba",
      label: "graduate program engagement",
      keywords: ["class", "case", "assignment", "mba", "lecture", "exam", "homework"],
    },
  ];

  const cleanFocusTitle = (title: string) => {
    let cleaned = title.replace(/\s*\(([^)]*)\)\s*/g, (match, inner) => {
      if (
        /due|tues|tue|thurs|thu|monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekly|daily|recurring/i.test(
          inner
        )
      ) {
        return " ";
      }
      return match;
    });
    cleaned = cleaned.replace(/\s*-\s*(due|recurring|repeat).*$/i, "");
    cleaned = cleaned.replace(/\s*—\s*(due|recurring|repeat).*$/i, "");
    cleaned = cleaned.replace(/\s{2,}/g, " ").trim();
    return cleaned || title.trim();
  };

  const identityQuestions: Array<{
    key: keyof typeof identityMetrics;
    label: string;
    helper: string;
  }> = [
    {
      key: "morningGrounding",
      label: "Did I start my day connected to my values?",
      helper: "Morning grounding",
    },
    {
      key: "embodiedMovement",
      label: "Did I move in a way that felt good in my body?",
      helper: "Embodied movement",
    },
    {
      key: "nutritionalAwareness",
      label: "Did I make intentional food choices, even if imperfect?",
      helper: "Nutritional awareness",
    },
    {
      key: "presentConnection",
      label: "Did I have one moment of genuine presence?",
      helper: "Present connection",
    },
    {
      key: "curiositySpark",
      label: "Did one thing make me genuinely curious?",
      helper: "Curiosity spark",
    },
  ];

  const inferFocusAreas = (title: string) => {
    const lower = title.toLowerCase();
    return focusAreas
      .filter((area) => area.keywords.some((keyword) => lower.includes(keyword)))
      .map((area) => area.id);
  };

  const focusCandidates = [
    ...dueTodayTasks.map((task) => ({
      id: `task-${task.id}`,
      label: cleanFocusTitle(task.title),
      type: task.status === "completed" ? "Completed task" : "Task",
      status: task.status,
      areas: inferFocusAreas(task.title),
    })),
    ...completedTodayTasks.map((task) => ({
      id: `completed-${task.id}`,
      label: cleanFocusTitle(task.title),
      type: "Completed task",
      status: task.status,
      areas: inferFocusAreas(task.title),
    })),
    ...todayEvents.map((event) => ({
      id: `event-${event.id}`,
      label: cleanFocusTitle(event.title ?? "Untitled event"),
      type: "Event",
      areas: inferFocusAreas(event.title ?? ""),
    })),
  ];

  const focusAreaCounts = focusCandidates.reduce<Record<string, number>>(
    (acc, item) => {
      item.areas.forEach((area) => {
        acc[area] = (acc[area] ?? 0) + 1;
      });
      return acc;
    },
    {}
  );

  const selectFocus3 = () => {
    if (!focusCandidates.length) {
      return [
        { id: "focus-1", label: "Morning grounding", type: "Identity" },
        { id: "focus-2", label: "Embodied movement", type: "Identity" },
        { id: "focus-3", label: "Curiosity spark", type: "Identity" },
      ];
    }
    const seen = new Set<string>();
    const uniqueCandidates = focusCandidates.filter((item) => {
      const key = item.label.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    const selections = uniqueCandidates.slice(0, 3).map((item) => ({
      id: item.id,
      label: item.label,
      type: item.type,
    }));
    while (selections.length < 3) {
      const fallbackId = selections.length + 1;
      selections.push({
        id: `focus-${fallbackId}`,
        label:
          fallbackId === 1
            ? "Morning grounding"
            : fallbackId === 2
              ? "Embodied movement"
              : "Curiosity spark",
        type: "Identity",
      });
    }
    return selections.slice(0, 3);
  };

  useEffect(() => {
    const hasRealFocus = focus3Snapshot.some((item) => !item.id.startsWith("focus-"));
    const uniqueCandidateCount = new Set(
      focusCandidates.map((item) => item.label.toLowerCase())
    ).size;
    if (focus3OverrideDate === todayKey) {
      return;
    }
    const shouldRefresh =
      focus3SnapshotDate !== todayKey ||
      (!hasRealFocus && focusCandidates.length > 0) ||
      focus3Snapshot.length === 0 ||
      (focus3Snapshot.length < 3 && uniqueCandidateCount >= 3);
    if (shouldRefresh) {
      setFocus3SnapshotDate(todayKey);
      setFocus3Snapshot(selectFocus3());
    }
  }, [focusCandidates, focus3OverrideDate, focus3Snapshot, focus3SnapshotDate, todayKey]);

  const focusThemes = focusAreas
    .filter((area) => (focusAreaCounts[area.id] ?? 0) > 0)
    .map((area) => area.label)
    .slice(0, 3);

  const briefingCopy = (() => {
    const taskCount = dueTodayTasks.length + completedTodayTasks.length;
    const eventCount = todayEvents.length;
    if (taskCount === 0 && eventCount === 0) {
      return "Today is intentionally light. Start with identity, then pick one meaningful task.";
    }
    if (taskCount > 0 && eventCount > 0) {
      return `You have ${taskCount} tasks due today and ${eventCount} events scheduled. Start with identity, then move into execution.`;
    }
    if (taskCount > 0) {
      return `You have ${taskCount} tasks due today. Start with identity, then move into execution.`;
    }
    return `You have ${eventCount} events scheduled today. Start with identity, then move into execution.`;
  })();

  const monthDays = useMemo(() => {
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1);
    const startOffset = firstDay.getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    return {
      year,
      month,
      startOffset,
      daysInMonth,
    };
  }, [today]);

  const monthLabel = today.toLocaleDateString([], { month: "long", year: "numeric" });

  const connectTodoist = () => {
    window.location.href = "/api/todoist/auth/start";
  };

  const connectGoogle = () => {
    window.location.href = "/api/google/auth/start";
  };

  const loadTodoist = useCallback(async (silent = false) => {
    setTodoistLoading(true);
    setTodoistError(null);
    try {
      const response = await fetch("/api/todoist/tasks?includeCompletedToday=true");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (silent && response.status === 401) return;
        if (response.status === 401) {
          throw new Error("Todoist not connected. Click Connect Todoist.");
        }
        if (response.status === 429) {
          throw new Error("Todoist rate limit hit. Try again in a minute.");
        }
        throw new Error(payload.detail ?? payload.error ?? "Todoist fetch failed");
      }
      const payload = (await response.json()) as {
        items: TaskContract[];
        completedToday?: TaskContract[];
      };
      setTodoistTasks(payload.items ?? []);
      const filteredCompleted =
        payload.completedToday?.filter((task) => {
          const raw = task.due?.dateTime ?? task.due?.date;
          if (!raw) return false;
          const parsed = task.due?.dateTime ? new Date(raw) : new Date(`${raw}T00:00:00`);
          if (Number.isNaN(parsed.getTime())) return false;
          return toDateKey(parsed) === todayKey;
        }) ?? [];
      setCompletedTodayTasks(filteredCompleted);
    } catch (error) {
      if (!silent) {
        setTodoistError(
          error instanceof Error ? error.message : "Todoist fetch failed"
        );
      }
    } finally {
      setTodoistLoading(false);
    }
  }, []);

  const loadTodoistProjects = useCallback(async (silent = false) => {
    try {
      const response = await fetch("/api/todoist/projects");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (silent && response.status === 401) return;
        if (response.status === 401) {
          throw new Error("Todoist not connected. Click Connect Todoist.");
        }
        if (response.status === 429) {
          throw new Error("Todoist rate limit hit. Try again in a minute.");
        }
        throw new Error(payload.detail ?? payload.error ?? "Todoist projects fetch failed");
      }
      const payload = (await response.json()) as {
        items: Array<{ id: string; name: string }>;
      };
      setTodoistProjects(payload.items ?? []);
    } catch (error) {
      if (!silent) {
        setTodoistError(
          error instanceof Error
            ? error.message
            : "Todoist projects fetch failed"
        );
      }
    }
  }, []);

  const loadGoogleCalendars = useCallback(async (silent = false) => {
    // #region agent log
    void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId: "H1",
        location: "page.tsx:loadGoogleCalendars:entry",
        message: "Entering loadGoogleCalendars",
        data: {
          silent,
          selectedCalendarIdsLength: selectedCalendarIds.length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    try {
      const response = await fetch("/api/google/calendars");
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (silent && response.status === 401) return;
        if (response.status === 401) {
          throw new Error("Google Calendar not connected. Click Connect Google.");
        }
        if (response.status === 429) {
          throw new Error("Google Calendar rate limit hit. Try again shortly.");
        }
        throw new Error(payload.detail ?? payload.error ?? "Calendar list failed");
      }
      const payload = (await response.json()) as {
        items: Array<{ id: string; name: string; primary: boolean }>;
      };
      const calendars = payload.items ?? [];
      setGoogleCalendars(calendars);
      let nextSelectedIds = selectedCalendarIds;
      if (!selectedCalendarIds.length) {
        const defaultNames = new Set([
          "Personal Calendar",
          "Personal Event",
          "user@example.com",
          "Holidays Calendar",
        ]);
        const defaults = calendars
          .filter((item) => defaultNames.has(item.name))
          .map((item) => item.id);
        nextSelectedIds = defaults.length ? defaults : calendars.map((item) => item.id);
        setSelectedCalendarIds(nextSelectedIds);
      }
      // #region agent log
      void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "H2",
          location: "page.tsx:loadGoogleCalendars:afterFetch",
          message: "Loaded Google calendars and computed selected ids",
          data: {
            calendarCount: calendars.length,
            selectedCalendarIdsBefore: selectedCalendarIds,
            selectedCalendarIdsAfter: nextSelectedIds,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
    } catch (error) {
      if (!silent) {
        setCalendarError(
          error instanceof Error ? error.message : "Calendar list failed"
        );
      }
    }
  }, [selectedCalendarIds.length]);

  const loadCalendar = useCallback(
    async (silent = false) => {
      // #region agent log
      void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "debug-session",
          runId: "pre-fix",
          hypothesisId: "H3",
          location: "page.tsx:loadCalendar:entry",
          message: "Entering loadCalendar",
          data: {
            silent,
            selectedCalendarIds,
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      setCalendarLoading(true);
      setCalendarError(null);
      try {
        const calendarParam = selectedCalendarIds.length
          ? `?calendarIds=${encodeURIComponent(selectedCalendarIds.join(","))}`
          : "";
        const response = await fetch(`/api/google/events${calendarParam}`);
        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));
          if (silent && response.status === 401) return;
        if (response.status === 401) {
          throw new Error("Google Calendar not connected. Click Connect Google.");
        }
        if (response.status === 429) {
          throw new Error("Google Calendar rate limit hit. Try again shortly.");
        }
        throw new Error(payload.detail ?? payload.error ?? "Calendar fetch failed");
        }
        const payload = (await response.json()) as {
          items: CalendarEventContract[];
        };
        setCalendarEvents(payload.items ?? []);
        // #region agent log
        void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "H3",
            location: "page.tsx:loadCalendar:afterFetch",
            message: "Loaded calendar events",
            data: {
              responseStatus: response.status,
              calendarParam,
              itemsCount: payload.items?.length ?? 0,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
      } catch (error) {
        if (!silent) {
          setCalendarError(
            error instanceof Error ? error.message : "Calendar fetch failed"
          );
        }
      } finally {
        setCalendarLoading(false);
      }
    },
    [selectedCalendarIds]
  );

  const loadHabitHistory = useCallback(async () => {
    setHabitLoading(true);
    setHabitError(null);
    try {
      const payload = await fetchHabitsFromApi();
      setHabits(payload.habits ?? []);
      setHabitSessions(payload.habitSessions ?? []);
      setHabitSource(payload.source ?? "export_1770248675244");
      saveHabitsToStorage(payload);
    } catch (error) {
      setHabitError(error instanceof Error ? error.message : "Habit import failed");
    } finally {
      setHabitLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTodoist(true);
    loadTodoistProjects(true);
    loadGoogleCalendars(true);
    loadCalendar(true);
  }, [loadTodoist, loadTodoistProjects, loadGoogleCalendars, loadCalendar]);

  useEffect(() => {
    const cached = loadHabitsFromStorage();
    if (cached) {
      setHabits(cached.habits ?? []);
      setHabitSessions(cached.habitSessions ?? []);
      setHabitSource(cached.source ?? "export_1770248675244");
    }
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem("morningFlowStatus");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as { date: string; status: string };
        if (parsed.date === todayKey) {
          if (
            parsed.status === "idle" ||
            parsed.status === "in_progress" ||
            parsed.status === "complete"
          ) {
            setMorningFlowStatus(parsed.status);
          }
        }
      } catch {
        localStorage.removeItem("morningFlowStatus");
      }
    }
  }, [todayKey]);

  useEffect(() => {
    const cached = localStorage.getItem("morningFlowSteps");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          date: string;
          steps: typeof morningFlowSteps;
        };
        if (parsed.date === todayKey && parsed.steps) {
          setMorningFlowSteps(parsed.steps);
        }
      } catch {
        localStorage.removeItem("morningFlowSteps");
      }
    }
  }, [todayKey]);

  useEffect(() => {
    localStorage.setItem(
      "morningFlowStatus",
      JSON.stringify({ date: todayKey, status: morningFlowStatus })
    );
  }, [morningFlowStatus, todayKey]);

  useEffect(() => {
    localStorage.setItem(
      "morningFlowSteps",
      JSON.stringify({ date: todayKey, steps: morningFlowSteps })
    );
  }, [morningFlowSteps, todayKey]);

  useEffect(() => {
    const cached = localStorage.getItem("identityCheck");
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          date: string;
          metrics: typeof identityMetrics;
        };
        if (parsed.date === todayKey && parsed.metrics) {
          setIdentityMetrics(parsed.metrics);
        }
      } catch {
        localStorage.removeItem("identityCheck");
      }
    }
  }, [todayKey]);

  useEffect(() => {
    const cached = localStorage.getItem("focus3Override");
    if (!cached) return;
    try {
      const parsed = JSON.parse(cached) as {
        date: string;
        items: Array<{ id: string; label: string; type: string }>;
      };
      if (parsed.date === todayKey && parsed.items?.length) {
        setFocus3Snapshot(parsed.items);
        setFocus3OverrideDate(parsed.date);
      }
    } catch {
      localStorage.removeItem("focus3Override");
    }
  }, [todayKey]);

  useEffect(() => {
    localStorage.setItem(
      "identityCheck",
      JSON.stringify({ date: todayKey, metrics: identityMetrics })
    );
  }, [identityMetrics, todayKey]);

  useEffect(() => {
    if (selectedCalendarIds.length) {
      loadCalendar(true);
    }
  }, [selectedCalendarIds, loadCalendar]);

  const createTodoistTask = async () => {
    if (!newTaskContent.trim()) {
      setTodoistError("Task title is required.");
      return;
    }
    setTodoistCreateLoading(true);
    setTodoistError(null);
    const labels = newTaskLabels
      .split(",")
      .map((label) => label.trim())
      .filter(Boolean);
    const priority = Number.parseInt(newTaskPriority, 10);

    try {
      const payload = {
        content: newTaskContent.trim(),
        description: newTaskDescription.trim() || undefined,
        due_string: newTaskDueString.trim() || undefined,
        priority: Number.isNaN(priority) ? undefined : priority,
        labels: labels.length ? labels : undefined,
        project_id: newTaskProjectId.trim() || undefined,
        section_id: newTaskSectionId.trim() || undefined,
        parent_id: newTaskParentId.trim() || undefined,
      };

      const response = await fetch("/api/todoist/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Todoist not connected. Click Connect Todoist.");
        }
        if (response.status === 429) {
          throw new Error("Todoist rate limit hit. Try again in a minute.");
        }
        throw new Error(payload.detail ?? payload.error ?? "Todoist create failed");
      }
      setNewTaskContent("");
      setNewTaskDescription("");
      setNewTaskDueString("");
      setNewTaskPriority("1");
      setNewTaskLabels("");
      setNewTaskProjectId("");
      setNewTaskSectionId("");
      setNewTaskParentId("");
      await loadTodoist();
    } catch (error) {
      setTodoistError(
        error instanceof Error ? error.message : "Todoist create failed"
      );
    } finally {
      setTodoistCreateLoading(false);
    }
  };

  const createCalendarEvent = async () => {
    if (!newEventTitle.trim() || !newEventStart || !newEventEnd) {
      setCalendarError("Event title, start, and end are required.");
      return;
    }
    setCalendarCreateLoading(true);
    setCalendarError(null);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const startIso = new Date(newEventStart).toISOString();
    const endIso = new Date(newEventEnd).toISOString();
    try {
      const response = await fetch("/api/google/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          summary: newEventTitle.trim(),
          location: newEventLocation.trim() || undefined,
          start: { dateTime: startIso, timeZone },
          end: { dateTime: endIso, timeZone },
          calendarId: selectedCalendarIds[0] ?? "primary",
          colorId: newEventColor || undefined,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Google Calendar not connected. Click Connect Google.");
        }
        if (response.status === 429) {
          throw new Error("Google Calendar rate limit hit. Try again shortly.");
        }
        throw new Error(payload.detail ?? payload.error ?? "Calendar create failed");
      }
      setNewEventTitle("");
      setNewEventStart("");
      setNewEventEnd("");
      setNewEventLocation("");
      await loadCalendar();
    } catch (error) {
      setCalendarError(
        error instanceof Error ? error.message : "Calendar create failed"
      );
    } finally {
      setCalendarCreateLoading(false);
    }
  };

  const updateTodoistTask = async (task: TaskContract) => {
    setEditingTaskId(task.id);
    setTaskEditForm({
      content: task.title,
      description: (task.raw?.description as string) ?? "",
      due_string: task.due?.dateTime ?? task.due?.date ?? "",
      priority: String(task.priority ?? 1),
      labels: task.labels?.join(", ") ?? "",
      project_id: task.projectId ?? "",
      section_id: task.sectionId ?? "",
      parent_id: task.parentId ?? "",
    });
  };

  const saveTodoistTaskEdits = async () => {
    if (!editingTaskId) return;
    setTodoistError(null);
    const payload = {
      id: editingTaskId,
      content: taskEditForm.content.trim(),
      description: taskEditForm.description.trim() || undefined,
      due_string: taskEditForm.due_string.trim() || undefined,
      priority: Number.parseInt(taskEditForm.priority, 10),
      labels: taskEditForm.labels
        .split(",")
        .map((label) => label.trim())
        .filter(Boolean),
      project_id: taskEditForm.project_id || undefined,
      section_id: taskEditForm.section_id || undefined,
      parent_id: taskEditForm.parent_id || undefined,
    };
    try {
      const response = await fetch("/api/todoist/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Todoist not connected. Click Connect Todoist.");
        }
        if (response.status === 429) {
          throw new Error("Todoist rate limit hit. Try again in a minute.");
        }
        throw new Error(body.detail ?? body.error ?? "Todoist update failed");
      }
      setEditingTaskId(null);
      await loadTodoist();
    } catch (error) {
      setTodoistError(
        error instanceof Error ? error.message : "Todoist update failed"
      );
    }
  };

  const cancelTodoistTaskEdits = () => {
    setEditingTaskId(null);
  };

  const completeTodoistTask = async (taskId: string) => {
    setTodoistError(null);
    try {
      const response = await fetch("/api/todoist/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: taskId, action: "close" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Todoist not connected. Click Connect Todoist.");
        }
        if (response.status === 429) {
          throw new Error("Todoist rate limit hit. Try again in a minute.");
        }
        throw new Error(payload.detail ?? payload.error ?? "Todoist update failed");
      }
      await loadTodoist();
    } catch (error) {
      setTodoistError(
        error instanceof Error ? error.message : "Todoist update failed"
      );
    }
  };

  const deleteTodoistTask = async (taskId: string) => {
    setTodoistError(null);
    try {
      const response = await fetch(
        `/api/todoist/tasks?id=${encodeURIComponent(taskId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Todoist not connected. Click Connect Todoist.");
        }
        if (response.status === 429) {
          throw new Error("Todoist rate limit hit. Try again in a minute.");
        }
        throw new Error(payload.detail ?? payload.error ?? "Todoist delete failed");
      }
      await loadTodoist();
    } catch (error) {
      setTodoistError(
        error instanceof Error ? error.message : "Todoist delete failed"
      );
    }
  };

  const updateCalendarEvent = async (event: CalendarEventContract) => {
    setEditingEventId(event.id);
    setEventEditForm({
      summary: event.title ?? "",
      description: (event.raw?.description as string) ?? "",
      location: event.location ?? "",
      start:
        toLocalDateTimeInputValue(event.start?.dateTime) ||
        (event.start?.date ? `${event.start.date}T09:00` : ""),
      end:
        toLocalDateTimeInputValue(event.end?.dateTime) ||
        (event.end?.date ? `${event.end.date}T10:00` : ""),
      calendarId: event.calendarId,
      colorId: event.colorId ?? "",
    });
  };

  const saveCalendarEventEdits = async () => {
    if (!editingEventId) return;
    setCalendarError(null);
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    try {
      const response = await fetch("/api/google/events", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingEventId,
          calendarId: eventEditForm.calendarId || "primary",
          summary: eventEditForm.summary.trim(),
          description: eventEditForm.description.trim() || undefined,
          location: eventEditForm.location.trim() || undefined,
          start: eventEditForm.start
            ? { dateTime: new Date(eventEditForm.start).toISOString(), timeZone }
            : undefined,
          end: eventEditForm.end
            ? { dateTime: new Date(eventEditForm.end).toISOString(), timeZone }
            : undefined,
          colorId: eventEditForm.colorId || undefined,
        }),
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Google Calendar not connected. Click Connect Google.");
        }
        if (response.status === 429) {
          throw new Error("Google Calendar rate limit hit. Try again shortly.");
        }
        throw new Error(body.detail ?? body.error ?? "Calendar update failed");
      }
      setEditingEventId(null);
      await loadCalendar();
    } catch (error) {
      setCalendarError(
        error instanceof Error ? error.message : "Calendar update failed"
      );
    }
  };

  const cancelCalendarEventEdits = () => {
    setEditingEventId(null);
  };

  const deleteCalendarEvent = async (event: CalendarEventContract) => {
    setCalendarError(null);
    try {
      const response = await fetch(
        `/api/google/events?id=${encodeURIComponent(
          event.id
        )}&calendarId=${encodeURIComponent(event.calendarId)}`,
        { method: "DELETE" }
      );
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        if (response.status === 401) {
          throw new Error("Google Calendar not connected. Click Connect Google.");
        }
        if (response.status === 429) {
          throw new Error("Google Calendar rate limit hit. Try again shortly.");
        }
        throw new Error(payload.detail ?? payload.error ?? "Calendar delete failed");
      }
      await loadCalendar();
    } catch (error) {
      setCalendarError(
        error instanceof Error ? error.message : "Calendar delete failed"
      );
    }
  };

  const habitSessionsById = useMemo(() => {
    const map = new Map<string, HabitSession[]>();
    habitSessions.forEach((session) => {
      const existing = map.get(session.habitId) ?? [];
      existing.push(session);
      map.set(session.habitId, existing);
    });
    return map;
  }, [habitSessions]);

  const activeHabits = useMemo(
    () => habits.filter((habit) => !habit.archivedAt),
    [habits]
  );

  const last7Days = useMemo(() => {
    const days: string[] = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(toDateKey(date));
    }
    return days;
  }, []);

  const habitStats = useMemo(() => {
    return activeHabits.map((habit) => {
      const sessions = habitSessionsById.get(habit.id) ?? [];
      const totalsByDay = new Map<string, number>();
      const totalsByWeek = new Map<string, number>();
      const totalsByMonth = new Map<string, number>();
      const totalsByYear = new Map<string, number>();
      const weekdayTotals = Array.from({ length: 7 }, () => 0);
      const weekdaySuccess = Array.from({ length: 7 }, () => 0);
      const monthTotals = new Map<string, number>();
      const monthSuccess = new Map<string, number>();
      let earliestSession: Date | null = null;

      sessions.forEach((session) => {
        const raw = session.createdAt;
        if (!raw) return;
        const parsed = new Date(raw);
        if (Number.isNaN(parsed.getTime())) return;
        if (!earliestSession || parsed < earliestSession) {
          earliestSession = parsed;
        }
        const dayKey = toDateKey(parsed);
        const weekKey = getWeekStartKey(parsed);
        const monthKey = getMonthKey(parsed);
        const yearKey = getYearKey(parsed);
        const amount = habit.kind === "amount" ? session.amount ?? 0 : 1;
        totalsByDay.set(dayKey, (totalsByDay.get(dayKey) ?? 0) + amount);
        totalsByWeek.set(weekKey, (totalsByWeek.get(weekKey) ?? 0) + amount);
        totalsByMonth.set(monthKey, (totalsByMonth.get(monthKey) ?? 0) + amount);
        totalsByYear.set(yearKey, (totalsByYear.get(yearKey) ?? 0) + amount);
        weekdayTotals[parsed.getDay()] += amount;
        monthTotals.set(monthKey, (monthTotals.get(monthKey) ?? 0) + amount);
      });

      const isDaily = habit.period.toLowerCase().includes("day");
      const target = habit.count || 1;
      const successDayKeys = new Set<string>();
      const successWeekKeys = new Set<string>();

      totalsByDay.forEach((value, key) => {
        if (isDaily) {
          if (habit.kind === "amount" ? value >= target : value >= 1) {
            successDayKeys.add(key);
            const parsed = new Date(`${key}T00:00:00`);
            if (!Number.isNaN(parsed.getTime())) {
              weekdaySuccess[parsed.getDay()] += 1;
            }
          }
        } else if (value > 0) {
          successDayKeys.add(key);
        }
      });

      totalsByWeek.forEach((value, key) => {
        if (!isDaily) {
          if (habit.kind === "amount" ? value >= target : value >= target) {
            successWeekKeys.add(key);
          }
        }
      });

      const startDate =
        habit.createdAt && !Number.isNaN(new Date(habit.createdAt).getTime())
          ? new Date(habit.createdAt)
          : earliestSession ?? new Date();
      startDate.setHours(0, 0, 0, 0);
      const todayDate = new Date();
      todayDate.setHours(0, 0, 0, 0);

      const countDaysBetween = (start: Date, end: Date) => {
        const diff = end.getTime() - start.getTime();
        return Math.max(1, Math.floor(diff / 86400000) + 1);
      };

      const countWeeksBetween = (start: Date, end: Date) => {
        const startWeek = new Date(start);
        startWeek.setDate(startWeek.getDate() - startWeek.getDay());
        const endWeek = new Date(end);
        endWeek.setDate(endWeek.getDate() - endWeek.getDay());
        const diff = endWeek.getTime() - startWeek.getTime();
        return Math.max(1, Math.floor(diff / (7 * 86400000)) + 1);
      };

      const countMonthsBetween = (start: Date, end: Date) => {
        return (
          (end.getFullYear() - start.getFullYear()) * 12 +
          (end.getMonth() - start.getMonth()) +
          1
        );
      };

      const countYearsBetween = (start: Date, end: Date) => {
        return end.getFullYear() - start.getFullYear() + 1;
      };

      const successMonths = new Set<string>();
      const successYears = new Set<string>();
      (isDaily ? successDayKeys : successWeekKeys).forEach((key) => {
        const parsed = new Date(`${key}T00:00:00`);
        if (Number.isNaN(parsed.getTime())) return;
        successMonths.add(getMonthKey(parsed));
        successYears.add(getYearKey(parsed));
        const monthKey = getMonthKey(parsed);
        monthSuccess.set(monthKey, (monthSuccess.get(monthKey) ?? 0) + 1);
      });

      const successDaysCount = successDayKeys.size;
      const successWeeksCount = successWeekKeys.size;
      const successMonthsCount = successMonths.size;
      const successYearsCount = successYears.size;

      const totalPeriods = isDaily
        ? countDaysBetween(startDate, todayDate)
        : countWeeksBetween(startDate, todayDate);
      const successPeriods = isDaily ? successDaysCount : successWeeksCount;
      const adherencePercent =
        totalPeriods > 0 ? Math.round((successPeriods / totalPeriods) * 100) : 0;

      const last365Start = new Date(todayDate);
      last365Start.setDate(last365Start.getDate() - 364);
      const currentYearStart = new Date(todayDate.getFullYear(), 0, 1);

      const countSuccessInRange = (
        keys: Set<string>,
        rangeStart: Date,
        rangeEnd: Date
      ) => {
        let count = 0;
        keys.forEach((key) => {
          const parsed = new Date(`${key}T00:00:00`);
          if (Number.isNaN(parsed.getTime())) return;
          if (parsed >= rangeStart && parsed <= rangeEnd) {
            count += 1;
          }
        });
        return count;
      };

      const totalLast365 = isDaily
        ? countDaysBetween(
            startDate > last365Start ? startDate : last365Start,
            todayDate
          )
        : countWeeksBetween(
            startDate > last365Start ? startDate : last365Start,
            todayDate
          );
      const totalCurrentYear = isDaily
        ? countDaysBetween(
            startDate > currentYearStart ? startDate : currentYearStart,
            todayDate
          )
        : countWeeksBetween(
            startDate > currentYearStart ? startDate : currentYearStart,
            todayDate
          );

      const successLast365 = isDaily
        ? countSuccessInRange(successDayKeys, last365Start, todayDate)
        : countSuccessInRange(
            successWeekKeys,
            new Date(getWeekStartKey(last365Start) + "T00:00:00"),
            todayDate
          );
      const successCurrentYear = isDaily
        ? countSuccessInRange(successDayKeys, currentYearStart, todayDate)
        : countSuccessInRange(
            successWeekKeys,
            new Date(getWeekStartKey(currentYearStart) + "T00:00:00"),
            todayDate
          );

      const adherenceLast365 =
        totalLast365 > 0 ? Math.round((successLast365 / totalLast365) * 100) : 0;
      const adherenceCurrentYear =
        totalCurrentYear > 0 ? Math.round((successCurrentYear / totalCurrentYear) * 100) : 0;

      const currentWeekKey = getWeekStartKey(todayDate);
      const currentWeekSuccess = isDaily
        ? Array.from(successDayKeys).some((key) => {
            const parsed = new Date(`${key}T00:00:00`);
            if (Number.isNaN(parsed.getTime())) return false;
            return getWeekStartKey(parsed) === currentWeekKey;
          })
        : successWeekKeys.has(currentWeekKey);

      const getActiveStreak = () => {
        if (isDaily) {
          let streak = 0;
          const cursor = new Date(todayDate);
          while (true) {
            const key = toDateKey(cursor);
            if (!successDayKeys.has(key)) break;
            streak += 1;
            cursor.setDate(cursor.getDate() - 1);
          }
          return streak;
        }
        let streak = 0;
        const cursor = new Date(todayDate);
        cursor.setDate(cursor.getDate() - cursor.getDay());
        while (true) {
          const key = toDateKey(cursor);
          if (!successWeekKeys.has(key)) break;
          streak += 1;
          cursor.setDate(cursor.getDate() - 7);
        }
        return streak;
      };

      const getLongestStreak = () => {
        if (isDaily) {
          let longest = 0;
          let current = 0;
          const cursor = new Date(startDate);
          while (cursor <= todayDate) {
            const key = toDateKey(cursor);
            if (successDayKeys.has(key)) {
              current += 1;
              longest = Math.max(longest, current);
            } else {
              current = 0;
            }
            cursor.setDate(cursor.getDate() + 1);
          }
          return longest;
        }
        let longest = 0;
        let current = 0;
        const cursor = new Date(startDate);
        cursor.setDate(cursor.getDate() - cursor.getDay());
        while (cursor <= todayDate) {
          const key = toDateKey(cursor);
          if (successWeekKeys.has(key)) {
            current += 1;
            longest = Math.max(longest, current);
          } else {
            current = 0;
          }
          cursor.setDate(cursor.getDate() + 7);
        }
        return longest;
      };

      const last7 = last7Days.map((key) => totalsByDay.get(key) ?? 0);
      const sumLast7 = last7.reduce((acc, value) => acc + value, 0);

      return {
        habit,
        last7,
        sumLast7,
        activeStreak: getActiveStreak(),
        longestStreak: getLongestStreak(),
        adherencePercent,
        adherenceLast365,
        adherenceCurrentYear,
        currentWeekSuccess,
        weekdayTotals,
        weekdaySuccess,
        monthTotals,
        monthSuccess,
        successDaysCount,
        successWeeksCount,
        successMonthsCount,
        successYearsCount,
        totalsByDay,
        totalsByWeek,
        totalsByMonth,
        totalsByYear,
        isDaily,
        startDate,
        totalDays: countDaysBetween(startDate, todayDate),
        totalWeeks: countWeeksBetween(startDate, todayDate),
        totalMonths: countMonthsBetween(startDate, todayDate),
        totalYears: countYearsBetween(startDate, todayDate),
      };
    });
  }, [activeHabits, habitSessionsById, last7Days]);

  const habitSummary = useMemo(() => {
    if (!habitStats.length) {
      return {
        todayCount: 0,
        weekCount: 0,
        total: 0,
        bestHabit: null as null | {
          title: string;
          adherenceLast365: number;
        },
      };
    }
    const todayKey = toDateKey(new Date());
    const todayCount = habitStats.filter((stat) =>
      stat.isDaily
        ? stat.totalsByDay.get(todayKey) !== undefined
        : stat.totalsByWeek.get(getWeekStartKey(new Date())) !== undefined
    ).length;
    const weekCount = habitStats.filter((stat) => stat.currentWeekSuccess).length;
    const bestHabit = habitStats
      .slice()
      .sort((a, b) => {
        if (b.adherenceLast365 !== a.adherenceLast365) {
          return b.adherenceLast365 - a.adherenceLast365;
        }
        return b.activeStreak - a.activeStreak;
      })[0];
    return {
      todayCount,
      weekCount,
      total: habitStats.length,
      bestHabit: bestHabit
        ? {
            title: bestHabit.habit.title,
            adherenceLast365: bestHabit.adherenceLast365,
          }
        : null,
    };
  }, [habitStats]);

  const aiBriefingContext = useMemo(() => {
    if (!habitStats.length && !dueTodayTasks.length && !todayAgendaEvents.length) {
      return null;
    }
    return buildBriefingContext({
      goals: activeGoals(),
      dueTodayTasks,
      completedTodayTasks,
      todayAgendaEvents,
      habitStats,
      identityScore,
      focusThemes,
      focus3Snapshot,
      morningFlowStatus,
    });
  }, [
    habitStats,
    dueTodayTasks,
    completedTodayTasks,
    todayAgendaEvents,
    identityScore,
    focusThemes,
    focus3Snapshot,
    morningFlowStatus,
  ]);

  const aiBriefing = useAIBriefing(aiBriefingContext);

  const morningFlowStepCount = Object.values(morningFlowSteps).filter(Boolean).length;
  const morningFlowTotalSteps = Object.keys(morningFlowSteps).length;
  const morningFlowComplete = morningFlowStepCount === morningFlowTotalSteps;

  const resetMorningFlow = () => {
    setMorningFlowStatus("idle");
    setMorningFlowSteps({
      briefing: false,
      focus: false,
      identity: false,
      habits: false,
    });
    localStorage.removeItem("morningFlowStatus");
    localStorage.removeItem("morningFlowSteps");
  };

  const saveFocus3Override = () => {
    const trimmed = focus3Draft
      .map((item) => ({
        label: item.label.trim(),
        type: item.type.trim() || "Focus",
      }))
      .filter((item) => item.label.length > 0)
      .slice(0, 3);
    while (trimmed.length < 3) {
      trimmed.push({ label: "Focus anchor", type: "Identity" });
    }
    const nextItems = trimmed.map((item, index) => ({
      id: `manual-${index + 1}-${todayKey}`,
      label: item.label,
      type: item.type,
    }));
    setFocus3Snapshot(nextItems);
    setFocus3OverrideDate(todayKey);
    localStorage.setItem(
      "focus3Override",
      JSON.stringify({ date: todayKey, items: nextItems })
    );
    setFocus3Editing(false);
  };

  const resetFocus3Override = () => {
    localStorage.removeItem("focus3Override");
    setFocus3OverrideDate(null);
    setFocus3SnapshotDate("");
  };

  const scrollToSection = (id: string) => {
    const node = document.getElementById(id);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const practiceInsights = useMemo(() => {
    const items: Array<{ id: string; title: string; body: string; why: string[] }> = [];
    if (morningFlowStatus === "idle") {
      items.push({
        id: "grounding-start",
        title: "Start with a 60‑second grounding",
        body: "A minimum morning reset sets the identity tone before tasks.",
        why: ["Morning flow is not started yet today."],
      });
    }
    if (identityScore > 0 && identityScore < 3) {
      items.push({
        id: "identity-minimum",
        title: "Aim for a 3/5 identity check",
        body: "Minimums still count, and 3‑5 is a strong day.",
        why: [`You are at ${identityScore}/5 identity checks so far.`],
      });
    }
    if (habitSummary.total > 0) {
      const percent = Math.round((habitSummary.weekCount / habitSummary.total) * 100);
      if (percent < 70) {
        items.push({
          id: "minimums-week",
          title: "Lean on minimums to protect rhythm",
          body: "A small check‑in keeps the practice alive without pressure.",
          why: [
            `This week you touched ${habitSummary.weekCount}/${habitSummary.total} practices.`,
          ],
        });
      } else {
        items.push({
          id: "steady-week",
          title: "Keep the steady rhythm",
          body: "70–80% consistency is the target in Phase 1.",
          why: [
            `This week you touched ${habitSummary.weekCount}/${habitSummary.total} practices.`,
          ],
        });
      }
    }
    if (focusThemes.length > 0) {
      items.push({
        id: "focus-themes",
        title: "Let one focus area lead today",
        body: "Pick one practice that matches the season you are in.",
        why: [`Recent focus themes: ${focusThemes.join(", ")}.`],
      });
    }
    return items.slice(0, 4);
  }, [focusThemes, habitSummary.total, habitSummary.weekCount, identityScore, morningFlowStatus]);

  const logHabitForToday = (habitId: string, amountOverride?: number) => {
    const habit = habits.find((item) => item.id === habitId);
    if (!habit) {
      setHabitError("Habit not found.");
      return;
    }
    if (habit.kind === "check") {
      const todayKeyCheck = toDateKey(new Date());
      const alreadyLogged = habitSessions.some((session) => {
        if (session.habitId !== habit.id) return false;
        const parsed = new Date(session.createdAt);
        if (Number.isNaN(parsed.getTime())) return false;
        return toDateKey(parsed) === todayKeyCheck;
      });
      if (alreadyLogged) {
        setHabitError("This habit is already logged for today.");
        return;
      }
    }
    const input = habitLogInputs[habit.id] ?? { amount: "", note: "" };
    const amount =
      typeof amountOverride === "number"
        ? amountOverride
        : habit.kind === "amount"
          ? Number.parseFloat(input.amount || "0")
          : 1;
    if (
      habit.kind === "amount" &&
      amountOverride === undefined &&
      (Number.isNaN(amount) || amount <= 0)
    ) {
      setHabitError("Enter a valid amount.");
      return;
    }
    if (habit.kind === "amount" && amountOverride !== undefined && amount === 0) {
      setHabitError("Amount cannot be zero.");
      return;
    }
    const nowIso = new Date().toISOString();
    const newSession: HabitSession = {
      id: `local-${Date.now()}`,
      habitId: habit.id,
      duration: null,
      amount: habit.kind === "amount" ? amount : 1,
      data: input.note.trim() || null,
      createdAt: nowIso,
      finishedAt: nowIso,
    };
    const nextSessions = [newSession, ...habitSessions];
    setHabitSessions(nextSessions);
    saveHabitsToStorage({
      habits,
      habitSessions: nextSessions,
      source: habitSource,
    });
    setHabitLogInputs((prev) => ({
      ...prev,
      [habit.id]: { amount: "", note: "" },
    }));
    setHabitError(null);
  };

  const removeLatestHabitSessionForToday = (habitId: string) => {
    const todayKeyCheck = toDateKey(new Date());
    let latestIndex = -1;
    let latestTime = 0;
    habitSessions.forEach((session, index) => {
      if (session.habitId !== habitId) return;
      const parsed = new Date(session.createdAt);
      if (Number.isNaN(parsed.getTime())) return;
      if (toDateKey(parsed) !== todayKeyCheck) return;
      if (parsed.getTime() >= latestTime) {
        latestTime = parsed.getTime();
        latestIndex = index;
      }
    });
    if (latestIndex === -1) {
      setHabitError("No log to undo for today.");
      return;
    }
    const nextSessions = habitSessions.filter((_, index) => index !== latestIndex);
    setHabitSessions(nextSessions);
    saveHabitsToStorage({
      habits,
      habitSessions: nextSessions,
      source: habitSource,
    });
    setHabitError(null);
  };

  const saveHabitEdits = (habitId: string) => {
    const input = habitEditInputs[habitId];
    if (!input) return;
    const count = Number.parseInt(input.count, 10);
    if (Number.isNaN(count) || count <= 0) {
      setHabitError("Enter a valid target count.");
      return;
    }
    const nextHabits = habits.map((habit) =>
      habit.id === habitId
        ? {
            ...habit,
            title: input.title.trim() || habit.title,
            kind: input.kind,
            count,
            period: input.period,
            type: input.type,
          }
        : habit
    );
    setHabits(nextHabits);
    saveHabitsToStorage({
      habits: nextHabits,
      habitSessions,
      source: habitSource,
    });
    setHabitEditId(null);
    setHabitError(null);
  };

  const getHabitSeries = (
    habit: Habit,
    maps: {
      totalsByDay: Map<string, number>;
      totalsByWeek: Map<string, number>;
      totalsByMonth: Map<string, number>;
      totalsByYear: Map<string, number>;
    },
    view: "day" | "week" | "month" | "year",
    pageIndex: number,
    pageSize: number,
    totalPeriodsByView: number
  ) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const series: Array<{ label: string; value: number }> = [];
    const offset = pageIndex * pageSize;

    const startDate =
      habit.createdAt && !Number.isNaN(new Date(habit.createdAt).getTime())
        ? new Date(habit.createdAt)
        : new Date(now);
    startDate.setHours(0, 0, 0, 0);

    if (view === "day") {
      for (let i = pageSize - 1; i >= 0; i -= 1) {
        const idx = totalPeriodsByView - 1 - (offset + i);
        if (idx < 0) continue;
        const date = new Date(startDate);
        date.setDate(date.getDate() + idx);
        const key = toDateKey(date);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        series.push({ label, value: maps.totalsByDay.get(key) ?? 0 });
      }
      return series;
    }

    if (view === "week") {
      const weekStart = new Date(startDate);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      for (let i = pageSize - 1; i >= 0; i -= 1) {
        const idx = totalPeriodsByView - 1 - (offset + i);
        if (idx < 0) continue;
        const date = new Date(weekStart);
        date.setDate(date.getDate() + idx * 7);
        const key = toDateKey(date);
        const label = `${date.getMonth() + 1}/${date.getDate()}`;
        series.push({ label, value: maps.totalsByWeek.get(key) ?? 0 });
      }
      return series;
    }

    if (view === "month") {
      const monthStart = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
      for (let i = pageSize - 1; i >= 0; i -= 1) {
        const idx = totalPeriodsByView - 1 - (offset + i);
        if (idx < 0) continue;
        const date = new Date(monthStart);
        date.setMonth(date.getMonth() + idx);
        const key = getMonthKey(date);
        series.push({ label: key, value: maps.totalsByMonth.get(key) ?? 0 });
      }
      return series;
    }

    const yearStart = startDate.getFullYear();
    for (let i = pageSize - 1; i >= 0; i -= 1) {
      const idx = totalPeriodsByView - 1 - (offset + i);
      if (idx < 0) continue;
      const label = `${yearStart + idx}`;
      series.push({ label, value: maps.totalsByYear.get(label) ?? 0 });
    }
    return series;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-slate-950 to-indigo-950 font-sans text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-8">
        {activeTab === "practice" && morningFlowStatus !== "complete" && (
          <section className="rounded-2xl border border-indigo-900/50 bg-zinc-900/90 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">
                  Morning flow
                </p>
                <h2 className="text-xl font-semibold">Begin your daily reset</h2>
                <p className="mt-1 text-sm text-zinc-300">
                  Ground, choose focus, check identity, then log a minimum practice.
                </p>
              </div>
              <div className="rounded-full border border-indigo-800/60 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
                {morningFlowStepCount}/{morningFlowTotalSteps} steps
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {morningFlowStatus === "idle" && (
                <button
                  type="button"
                  onClick={() => setMorningFlowStatus("in_progress")}
                  className="rounded-full bg-indigo-500 px-4 py-2 text-xs font-medium text-white hover:bg-indigo-400"
                >
                  Start morning flow
                </button>
              )}
              {morningFlowStatus === "in_progress" && (
                <button
                  type="button"
                  onClick={() => setMorningFlowStatus("in_progress")}
                  className="rounded-full border border-indigo-700/60 px-4 py-2 text-xs text-indigo-200"
                >
                  Resume flow
                </button>
              )}
              {morningFlowStatus === "in_progress" && (
                <button
                  type="button"
                  onClick={() => {
                    if (!morningFlowComplete) return;
                    setMorningFlowStatus("complete");
                  }}
                  className={`rounded-full px-4 py-2 text-xs font-medium text-white ${
                    morningFlowComplete
                      ? "bg-emerald-500 hover:bg-emerald-400"
                      : "bg-emerald-500/30 text-emerald-200"
                  }`}
                  disabled={!morningFlowComplete}
                >
                  Mark flow complete
                </button>
              )}
            </div>
            {morningFlowStatus === "in_progress" && (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {[
                  {
                    id: "briefing",
                    label: "Read the morning briefing",
                    helper: "Understand the day’s constraints and values reminder.",
                    target: "#morning-briefing",
                  },
                  {
                    id: "focus",
                    label: "Set Focus 3",
                    helper: "Pick what matters most, not what is loudest.",
                    target: "#focus-3",
                  },
                  {
                    id: "identity",
                    label: "Complete the identity check",
                    helper: "3–5 checks is a strong day.",
                    target: "#identity-check",
                  },
                  {
                    id: "habits",
                    label: "Log a minimum practice",
                    helper: "Log one small habit check-in to keep momentum.",
                    target: "#habit-checkin",
                  },
                ].map((step) => {
                  const isDone = morningFlowSteps[step.id as keyof typeof morningFlowSteps];
                  return (
                    <div
                      key={step.id}
                      className="rounded-xl border border-indigo-900/50 bg-indigo-500/10 px-3 py-3 text-sm text-indigo-100"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-medium">{step.label}</p>
                          <p className="mt-1 text-xs text-indigo-100/80">{step.helper}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setMorningFlowSteps((prev) => ({
                              ...prev,
                              [step.id]: !isDone,
                            }))
                          }
                          className={`rounded-full border px-2 py-1 text-[11px] ${
                            isDone
                              ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                              : "border-indigo-700/60 text-indigo-200"
                          }`}
                        >
                          {isDone ? "Done" : "Mark done"}
                        </button>
                      </div>
                      <div className="mt-2">
                        <button
                          type="button"
                          onClick={() => scrollToSection(step.target.replace("#", ""))}
                          className="text-[11px] text-indigo-200 underline-offset-2 hover:underline"
                        >
                          Jump to section
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        <header className="flex flex-col gap-2">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400">
            Daily System
          </p>
          <h1 className="text-3xl font-semibold tracking-tight">
            Morning Briefing + Plan
          </h1>
          <p className="text-sm text-zinc-400">
            Calm, goal-aligned, and ready for check-ins anytime today.
          </p>
          {activeTab === "practice" && (
            <div>
              <button
                type="button"
                onClick={resetMorningFlow}
                className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:text-white"
              >
                Reset morning flow
              </button>
            </div>
          )}
        </header>

        <div className="flex w-full items-center justify-start">
          <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950/40 p-1 text-sm">
            <button
              type="button"
              onClick={() => setActiveTab("practice")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === "practice"
                  ? "bg-indigo-500/20 text-indigo-200"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Practice
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("tasks")}
              className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                activeTab === "tasks"
                  ? "bg-emerald-500/20 text-emerald-200"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              Tasks
            </button>
          </div>
        </div>

        {activeTab === "practice" && (
          <>
            <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div
                id="morning-briefing"
                className="rounded-2xl border border-indigo-900/50 bg-zinc-900/80 p-5 shadow-sm backdrop-blur"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Morning Briefing</h2>
                  <div className="flex items-center gap-2">
                    {aiBriefing.briefing && (
                      <button
                        type="button"
                        onClick={aiBriefing.refresh}
                        disabled={aiBriefing.loading}
                        className="rounded-full border border-indigo-700/60 px-3 py-1 text-xs text-indigo-200 hover:text-white disabled:opacity-50"
                      >
                        {aiBriefing.loading ? "Generating..." : "Refresh"}
                      </button>
                    )}
                  </div>
                </div>
                {aiBriefing.loading && !aiBriefing.briefing ? (
                  <div className="mt-3 space-y-3 animate-pulse">
                    <div className="h-4 w-3/4 rounded bg-indigo-500/20" />
                    <div className="h-4 w-1/2 rounded bg-indigo-500/20" />
                    <div className="h-10 rounded-xl bg-indigo-500/10" />
                    <div className="h-16 rounded-xl bg-zinc-950/40" />
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-zinc-300">
                      {aiBriefing.briefing?.headline ?? briefingCopy}
                    </p>
                    <div className="mt-4 rounded-xl bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
                      {aiBriefing.briefing?.valuesFocus ??
                        "Values focus: presence, grounded confidence, relationship care."}
                    </div>
                    <div className="mt-3 rounded-xl border border-indigo-900/50 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-300">
                      <p className="font-semibold text-indigo-200">Why this briefing</p>
                      <ul className="mt-2 space-y-1">
                        {(
                          aiBriefing.briefing?.whyBullets ?? [
                            `${dueTodayTasks.length} tasks are due today tied to your operational commitments.`,
                            `${todayAgendaEvents.length} events shape the day\u2019s constraints and themes.`,
                            "Primary focus areas are prioritized over productivity volume.",
                          ]
                        ).map((bullet, i) => (
                          <li key={`why-${i}`}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                    {aiBriefing.error && (
                      <div className="mt-3 rounded-xl border border-amber-900/50 bg-amber-500/10 px-4 py-2 text-xs text-amber-200">
                        AI briefing unavailable — showing default view. ({aiBriefing.error})
                      </div>
                    )}
                  </>
                )}
              </div>
              <div
                id="focus-3"
                className="rounded-2xl border border-emerald-900/50 bg-zinc-900/80 p-5 shadow-sm backdrop-blur"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-lg font-semibold">Focus 3</h2>
                    <p className="text-sm text-zinc-300">
                      Choose what matters most today, not what is loudest.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!focus3Editing && (
                      <button
                        type="button"
                        onClick={() => {
                          setFocus3Draft(
                            (focus3Snapshot.length ? focus3Snapshot : selectFocus3()).map(
                              (item) => ({ label: item.label, type: item.type })
                            )
                          );
                          setFocus3Editing(true);
                        }}
                        className="rounded-full border border-emerald-700/60 px-3 py-1 text-xs text-emerald-200 hover:text-white"
                      >
                        Edit focus 3
                      </button>
                    )}
                    {!focus3Editing && focus3OverrideDate === todayKey && (
                      <button
                        type="button"
                        onClick={resetFocus3Override}
                        className="rounded-full border border-zinc-800 px-3 py-1 text-xs text-zinc-300 hover:text-white"
                      >
                        Reset to auto
                      </button>
                    )}
                  </div>
                </div>
                {focus3Editing ? (
                  <div className="mt-3 space-y-2 text-sm text-zinc-200">
                    {[0, 1, 2].map((index) => (
                      <div
                        key={`focus3-edit-${index}`}
                        className="rounded-lg border border-emerald-900/50 bg-emerald-500/10 px-3 py-2"
                      >
                        <div className="grid gap-2 sm:grid-cols-[2fr_1fr]">
                          <input
                            className="w-full rounded-lg border border-emerald-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                            placeholder={`Focus ${index + 1}`}
                            value={focus3Draft[index]?.label ?? ""}
                            onChange={(event) =>
                              setFocus3Draft((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  label: event.target.value,
                                  type: next[index]?.type ?? "Focus",
                                };
                                return next;
                              })
                            }
                          />
                          <input
                            className="w-full rounded-lg border border-emerald-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                            placeholder="Type (e.g., Task, Identity)"
                            value={focus3Draft[index]?.type ?? ""}
                            onChange={(event) =>
                              setFocus3Draft((prev) => {
                                const next = [...prev];
                                next[index] = {
                                  label: next[index]?.label ?? "",
                                  type: event.target.value,
                                };
                                return next;
                              })
                            }
                          />
                        </div>
                      </div>
                    ))}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveFocus3Override}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-400"
                      >
                        Save focus 3
                      </button>
                      <button
                        type="button"
                        onClick={() => setFocus3Editing(false)}
                        className="rounded-full border border-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:text-white"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                    {focus3Snapshot.map((item) => (
                      <li
                        key={item.id}
                        className="rounded-lg border border-emerald-900/50 bg-emerald-500/10 px-3 py-2"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{item.label}</span>
                          <span className="text-[11px] text-emerald-300">
                            {item.type}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>

          <section className="rounded-2xl border border-indigo-900/40 bg-zinc-900/80 p-5 shadow-sm backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Insights</h2>
                <p className="text-sm text-zinc-300">
                  Calm, explainable nudges tied to your identity practices.
                </p>
              </div>
              <span className="rounded-full border border-indigo-900/50 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
                {aiBriefing.briefing?.insights ? "AI-assisted" : "Explainable only"}
              </span>
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {(() => {
                const displayInsights = aiBriefing.briefing?.insights ?? practiceInsights;
                if (displayInsights.length === 0) {
                  return (
                    <div className="rounded-xl border border-dashed border-indigo-900/60 bg-zinc-950/40 px-3 py-3 text-sm text-zinc-400">
                      No insights yet. Add a few check-ins to activate suggestions.
                    </div>
                  );
                }
                return displayInsights.map((insight) => (
                  <div
                    key={insight.id}
                    className="rounded-xl border border-indigo-900/50 bg-indigo-500/10 px-3 py-3 text-sm text-indigo-100"
                  >
                    <p className="font-medium">{insight.title}</p>
                    <p className="mt-1 text-xs text-indigo-100/80">{insight.body}</p>
                    <div className="mt-2 rounded-lg border border-indigo-900/60 bg-zinc-950/40 px-2 py-2 text-[11px] text-zinc-300">
                      <p className="font-semibold text-indigo-200">Why this</p>
                      <ul className="mt-1 space-y-1">
                        {insight.why.map((reason, index) => (
                          <li key={`${insight.id}-why-${index}`}>{reason}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </section>

            <section className="rounded-2xl border border-indigo-900/40 bg-zinc-900/80 p-5 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Daily Identity Check</h2>
                  <p className="text-sm text-zinc-300">
                    Success is showing up as who you&apos;re becoming.
                  </p>
                </div>
                <div className="rounded-full border border-indigo-900/50 bg-indigo-500/10 px-3 py-1 text-sm text-indigo-200">
                  {identityScore}/5 today
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {identityQuestions.map((question) => {
                  const isActive = identityMetrics[question.key];
                  return (
                    <button
                      key={question.key}
                      type="button"
                      onClick={() =>
                        setIdentityMetrics((prev) => ({
                          ...prev,
                          [question.key]: !prev[question.key],
                        }))
                      }
                      className={`rounded-xl border px-3 py-3 text-left text-sm transition ${
                        isActive
                          ? "border-indigo-700/60 bg-indigo-500/10 text-indigo-100"
                          : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-indigo-800/60"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="font-medium">{question.label}</span>
                        <span
                          className={`text-[11px] ${
                            isActive ? "text-indigo-200" : "text-zinc-500"
                          }`}
                        >
                          {question.helper}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 text-xs text-zinc-400">
                A strong day is 3–5 checks. Minimums still count.
              </p>
            </section>

            <section
              id="habit-checkin"
              className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm backdrop-blur"
            >
              <h2 className="text-lg font-semibold">Habit Check‑in</h2>
              <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-sm text-zinc-300">
                <p>
                  Pattern-first tracking that reinforces showing up, not perfection.
                </p>
                <button
                  type="button"
                  onClick={loadHabitHistory}
                  className="rounded-full bg-amber-500 px-4 py-2 text-xs font-medium text-white hover:bg-amber-400"
                  disabled={habitLoading}
                >
                  {habitLoading ? "Loading..." : "Load habit history"}
                </button>
              </div>
              <p className="mt-2 text-xs text-zinc-400">
                Minimum practice = one quick habit check-in (or a small amount entry) to keep
                identity momentum.
              </p>
              {habitError && (
                <p className="mt-2 text-xs text-rose-400">{habitError}</p>
              )}
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-3 text-xs text-zinc-200">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Overall habit momentum
                  </p>
                  <span className="text-[11px] text-zinc-400">
                    Today {habitSummary.todayCount}/{habitSummary.total}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-zinc-900/70">
                  <div
                    className="h-full rounded-full bg-emerald-400/70"
                    style={{
                      width: habitSummary.total
                        ? `${Math.round(
                            (habitSummary.todayCount / habitSummary.total) * 100
                          )}%`
                        : "0%",
                    }}
                  />
                </div>
                <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400">
                  <span>
                    Weekly {habitSummary.weekCount}/{habitSummary.total}
                  </span>
                  {habitSummary.bestHabit && (
                    <span>
                      Most consistent: {habitSummary.bestHabit.title} ·{" "}
                      {habitSummary.bestHabit.adherenceLast365}% last 365 days
                    </span>
                  )}
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-zinc-900/70">
                  <div
                    className="h-full rounded-full bg-indigo-400/70"
                    style={{
                      width: habitSummary.total
                        ? `${Math.round(
                            (habitSummary.weekCount / habitSummary.total) * 100
                          )}%`
                        : "0%",
                    }}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="rounded-xl border border-amber-900/40 bg-zinc-950/40 px-3 py-3 text-xs text-zinc-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Weekly practice review
                  </p>
                  <p className="mt-2 text-sm text-amber-100">
                    {habitSummary.total === 0
                      ? "Load history to see weekly patterns."
                      : `Week-to-date: ${habitSummary.weekCount}/${habitSummary.total} practices touched.`}
                  </p>
                  {habitSummary.bestHabit && (
                    <p className="mt-2 text-[11px] text-amber-100/80">
                      Most consistent: {habitSummary.bestHabit.title} ·{" "}
                      {habitSummary.bestHabit.adherenceLast365}% last 365 days
                    </p>
                  )}
                </div>
                <div className="rounded-xl border border-emerald-900/40 bg-zinc-950/40 px-3 py-3 text-xs text-zinc-200">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Minimums are valid
                  </p>
                  <p className="mt-2 text-sm text-emerald-100">
                    70–80% consistency is the target. Minimums protect identity momentum.
                  </p>
                  <p className="mt-2 text-[11px] text-emerald-100/80">
                    Choose the minimum version when energy is low.
                  </p>
                </div>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {habitStats.length === 0 && (
                  <div className="rounded-lg border border-dashed border-amber-900/50 bg-zinc-950/40 px-3 py-3 text-xs text-zinc-400">
                    No habit history loaded yet.
                  </div>
                )}
                {habitStats.map(
                  ({
                    habit,
                    last7,
                    sumLast7,
                    adherenceLast365,
                    adherenceCurrentYear,
                    weekdayTotals,
                    weekdaySuccess,
                    monthTotals,
                    monthSuccess,
                    successDaysCount,
                    successWeeksCount,
                    successMonthsCount,
                    successYearsCount,
                    isDaily,
                    totalsByDay,
                    totalsByWeek,
                    totalsByMonth,
                    totalsByYear,
                    startDate,
                    totalDays,
                    totalWeeks,
                    totalMonths,
                    totalYears,
                  }) => {
                    const isExpanded = expandedHabitId === habit.id;
                    const habitStyle = getHabitStyle(habit.id);
                    const pageSize = 8;
                    const viewKey = `${habit.id}-${habitDetailView}`;
                    const pageIndex = habitSeriesPageByHabit[viewKey] ?? 0;
                    const totalPeriodsByView =
                      habitDetailView === "day"
                        ? totalDays
                        : habitDetailView === "week"
                          ? totalWeeks
                          : habitDetailView === "month"
                            ? totalMonths
                            : totalYears;
                    const totalPages = Math.max(1, Math.ceil(totalPeriodsByView / pageSize));
                    const clampPage = Math.min(pageIndex, totalPages - 1);
                    const periodSeries = getHabitSeries(
                      habit,
                      { totalsByDay, totalsByWeek, totalsByMonth, totalsByYear },
                      habitDetailView,
                      clampPage,
                      pageSize,
                      totalPeriodsByView
                    );
                    const maxValue = Math.max(1, ...periodSeries.map((item) => item.value));
                    return (
                      <div
                        key={habit.id}
                        className={`rounded-lg border px-3 py-3 text-sm ${habitStyle.card}`}
                      >
                        <button
                          type="button"
                          className="w-full text-left"
                          onClick={() =>
                            setExpandedHabitId((prev) => (prev === habit.id ? null : habit.id))
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="font-medium">{habit.title}</p>
                              <p className="text-xs text-amber-100/80">
                                Goal: {habit.count} · {habit.period}
                              </p>
                            </div>
                            <div className="text-right text-[11px] text-amber-200">
                              <p>
                                {habit.kind === "amount"
                                  ? `${sumLast7} last 7 days`
                                  : `${sumLast7} check-ins (7 days)`}
                              </p>
                              <p>{adherenceLast365}% last 365 days</p>
                              <p>{adherenceCurrentYear}% {new Date().getFullYear()}</p>
                            </div>
                          </div>
                          <div className="mt-3 flex items-center gap-1">
                            {last7.map((value, index) => (
                              <span
                                key={`${habit.id}-day-${index}`}
                                className={`h-2 w-6 rounded-full ${
                              value > 0 ? habitStyle.bar : "bg-zinc-900/70"
                                }`}
                              />
                            ))}
                          </div>
                          <p className="mt-2 text-[11px] text-amber-100/70">
                            {habit.kind === "amount"
                              ? `${sumLast7} in last 7 days`
                              : `${sumLast7} check-ins`}
                          </p>
                        </button>
                        <div className={`mt-3 rounded-lg border bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 ${habitStyle.card}`}>
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="text-[11px] font-semibold text-zinc-200/80">
                              Log today
                            </p>
                            <button
                              type="button"
                                onClick={() => logHabitForToday(habit.id)}
                                className={`rounded-full px-3 py-1 text-[11px] font-medium text-white ${habitStyle.bar}`}
                            >
                              Log
                            </button>
                          </div>
                          <div className="mt-2 grid gap-2 sm:grid-cols-3">
                            {habit.kind === "amount" ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:text-white"
                                    onClick={() => removeLatestHabitSessionForToday(habit.id)}
                                  >
                                    −
                                  </button>
                                  <input
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                    placeholder="Amount"
                                    value={habitLogInputs[habit.id]?.amount ?? ""}
                                    onChange={(event) =>
                                      setHabitLogInputs((prev) => ({
                                        ...prev,
                                        [habit.id]: {
                                          amount: event.target.value,
                                          note: prev[habit.id]?.note ?? "",
                                        },
                                      }))
                                    }
                                  />
                                  <button
                                    type="button"
                                    className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:text-white"
                                    onClick={() => logHabitForToday(habit.id, 1)}
                                  >
                                    +
                                  </button>
                                </div>
                                <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-400">
                                  Use +/- for quick logs. Type for bigger entries.
                                </div>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:text-white"
                                onClick={() =>
                                  habitSessions.some((session) => {
                                    if (session.habitId !== habit.id) return false;
                                    const parsed = new Date(session.createdAt);
                                    if (Number.isNaN(parsed.getTime())) return false;
                                    return toDateKey(parsed) === toDateKey(new Date());
                                  })
                                    ? removeLatestHabitSessionForToday(habit.id)
                                    : logHabitForToday(habit.id)
                                }
                              >
                                {habitSessions.some((session) => {
                                  if (session.habitId !== habit.id) return false;
                                  const parsed = new Date(session.createdAt);
                                  if (Number.isNaN(parsed.getTime())) return false;
                                  return toDateKey(parsed) === toDateKey(new Date());
                                })
                                  ? "Undo check"
                                  : "Check habit (one tap)"}
                              </button>
                            )}
                          </div>
                        </div>
                        {(isExpanded || expandedHabitId !== null) && (
                          <div className="mt-4 space-y-3 text-xs text-zinc-200">
                            <div className="grid gap-2 sm:grid-cols-2">
                              <div className="rounded-md border border-amber-900/40 bg-zinc-950/40 px-3 py-2">
                                <p className="text-[11px] text-amber-100/80">Last 7 days</p>
                                <p className="text-sm font-medium">
                                  {habit.kind === "amount"
                                    ? `${sumLast7} total`
                                    : `${sumLast7} check-ins`}
                                </p>
                              </div>
                              <div className="rounded-md border border-amber-900/40 bg-zinc-950/40 px-3 py-2">
                                <p className="text-[11px] text-amber-100/80">
                                  Consistency (365d)
                                </p>
                                <p className="text-sm font-medium">
                                  {adherenceLast365}% of {isDaily ? "days" : "weeks"}
                                </p>
                              </div>
                              <div className="rounded-md border border-amber-900/40 bg-zinc-950/40 px-3 py-2">
                                <p className="text-[11px] text-amber-100/80">
                                  Consistency ({new Date().getFullYear()})
                                </p>
                                <p className="text-sm font-medium">
                                  {adherenceCurrentYear}% of {isDaily ? "days" : "weeks"}
                                </p>
                              </div>
                              <div className="rounded-md border border-amber-900/40 bg-zinc-950/40 px-3 py-2">
                                <p className="text-[11px] text-amber-100/80">
                                  Successful periods
                                </p>
                                <p className="text-sm font-medium">
                                  {isDaily
                                    ? `${successDaysCount} days`
                                    : `${successWeeksCount} weeks`}
                                </p>
                              </div>
                            </div>

                            <div className="rounded-md border border-zinc-900/40 bg-zinc-950/40 px-3 py-2">
                              <p className="text-[11px] text-amber-100/80">Tracking span</p>
                              <p className="mt-1 text-sm font-medium">
                                {isDaily ? totalDays : totalWeeks}{" "}
                                {isDaily ? "days tracked" : "weeks tracked"}
                              </p>
                            </div>

                            <div className="rounded-md border border-zinc-900/40 bg-zinc-950/40 px-3 py-2 sm:col-span-2">
                              <div className="flex items-center justify-between">
                                <p className="text-[11px] text-amber-100/80">Edit habit</p>
                                <button
                                  type="button"
                                  className="text-[11px] text-amber-200 hover:text-amber-100"
                                  onClick={() => {
                                    setHabitEditId(habit.id);
                                    setHabitEditInputs((prev) => ({
                                      ...prev,
                                      [habit.id]: {
                                        title: habit.title,
                                        kind: habit.kind,
                                        count: String(habit.count),
                                        period: habit.period,
                                        type: habit.type,
                                      },
                                    }));
                                  }}
                                >
                                  Edit
                                </button>
                              </div>
                              {habitEditId === habit.id && (
                                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                  <input
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                    value={habitEditInputs[habit.id]?.title ?? ""}
                                    onChange={(event) =>
                                      setHabitEditInputs((prev) => ({
                                        ...prev,
                                        [habit.id]: {
                                          ...(prev[habit.id] ?? {
                                            title: habit.title,
                                            kind: habit.kind,
                                            count: String(habit.count),
                                            period: habit.period,
                                            type: habit.type,
                                          }),
                                          title: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                  <input
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                    value={habitEditInputs[habit.id]?.type ?? ""}
                                    onChange={(event) =>
                                      setHabitEditInputs((prev) => ({
                                        ...prev,
                                        [habit.id]: {
                                          ...(prev[habit.id] ?? {
                                            title: habit.title,
                                            kind: habit.kind,
                                            count: String(habit.count),
                                            period: habit.period,
                                            type: habit.type,
                                          }),
                                          type: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                  <select
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                    value={habitEditInputs[habit.id]?.kind ?? habit.kind}
                                    onChange={(event) =>
                                      setHabitEditInputs((prev) => ({
                                        ...prev,
                                        [habit.id]: {
                                          ...(prev[habit.id] ?? {
                                            title: habit.title,
                                            kind: habit.kind,
                                            count: String(habit.count),
                                            period: habit.period,
                                            type: habit.type,
                                          }),
                                          kind: event.target.value as "check" | "amount",
                                        },
                                      }))
                                    }
                                  >
                                    <option value="check">Check</option>
                                    <option value="amount">Amount</option>
                                  </select>
                                  <input
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                    value={habitEditInputs[habit.id]?.count ?? String(habit.count)}
                                    onChange={(event) =>
                                      setHabitEditInputs((prev) => ({
                                        ...prev,
                                        [habit.id]: {
                                          ...(prev[habit.id] ?? {
                                            title: habit.title,
                                            kind: habit.kind,
                                            count: String(habit.count),
                                            period: habit.period,
                                            type: habit.type,
                                          }),
                                          count: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                  <input
                                    className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                    value={habitEditInputs[habit.id]?.period ?? habit.period}
                                    onChange={(event) =>
                                      setHabitEditInputs((prev) => ({
                                        ...prev,
                                        [habit.id]: {
                                          ...(prev[habit.id] ?? {
                                            title: habit.title,
                                            kind: habit.kind,
                                            count: String(habit.count),
                                            period: habit.period,
                                            type: habit.type,
                                          }),
                                          period: event.target.value,
                                        },
                                      }))
                                    }
                                  />
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      className="rounded-full bg-amber-500 px-3 py-1 text-[11px] font-medium text-white hover:bg-amber-400"
                                      onClick={() => saveHabitEdits(habit.id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-full border border-zinc-800 px-3 py-1 text-[11px] text-zinc-300 hover:text-white"
                                      onClick={() => setHabitEditId(null)}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            <div className="rounded-md border border-amber-900/40 bg-zinc-950/40 px-3 py-2">
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[11px] text-amber-100/80">
                                  {habit.kind === "amount"
                                    ? "Amount frequency"
                                    : "Success frequency"}
                                </p>
                                <div className="flex items-center gap-1 text-[10px]">
                                  {(["day", "week", "month", "year"] as const).map((view) => (
                                    <button
                                      key={`${habit.id}-${view}`}
                                      type="button"
                                      onClick={() => setHabitDetailView(view)}
                                      className={`rounded-full border px-2 py-1 ${
                                        habitDetailView === view
                                          ? "border-amber-400/60 bg-amber-400/20 text-amber-100"
                                          : "border-zinc-800 text-zinc-400"
                                      }`}
                                    >
                                      {view}
                                    </button>
                                  ))}
                                </div>
                              </div>
                              <div className="mt-3 flex items-end gap-2">
                                {periodSeries.map((item, index) => {
                                  const rawValue = item.value;
                                  const height = Math.max(
                                    8,
                                    Math.round((rawValue / maxValue) * 60)
                                  );
                                  return (
                                    <div
                                      key={`${habit.id}-series-${index}`}
                                      className="flex flex-1 flex-col items-center gap-1"
                                      title={`${item.label}: ${rawValue}`}
                                    >
                                      <span className="text-[10px] text-amber-100/80">
                                        {rawValue}
                                      </span>
                                      <div
                                        className={`w-full rounded-full ${habitStyle.bar}`}
                                        style={{ height }}
                                      />
                                      <span className="text-[10px] text-zinc-400">
                                        {habitDetailView === "day"
                                          ? item.label
                                          : habitDetailView === "month"
                                            ? item.label
                                          : habitDetailView === "year"
                                              ? item.label
                                              : item.label}
                                      </span>
                                    </div>
                                  );
                                })}
                              </div>
                              {totalPages > 1 && (
                                <div className="mt-3 flex items-center justify-between text-[10px] text-zinc-400">
                                  <button
                                    type="button"
                                    className="rounded-full border border-zinc-800 px-2 py-1 hover:text-white"
                                    onClick={() =>
                                      setHabitSeriesPageByHabit((prev) => ({
                                        ...prev,
                                        [viewKey]: Math.min(clampPage + 1, totalPages - 1),
                                      }))
                                    }
                                    disabled={clampPage >= totalPages - 1}
                                  >
                                    Older
                                  </button>
                                  <span>
                                    Page {clampPage + 1} of {totalPages}
                                  </span>
                                  <button
                                    type="button"
                                    className="rounded-full border border-zinc-800 px-2 py-1 hover:text-white"
                                    onClick={() =>
                                      setHabitSeriesPageByHabit((prev) => ({
                                        ...prev,
                                        [viewKey]: Math.max(clampPage - 1, 0),
                                      }))
                                    }
                                    disabled={clampPage === 0}
                                  >
                                    Newer
                                  </button>
                                </div>
                              )}
                            </div>

                            {habitDetailView === "month" && (
                              <div className="rounded-md border border-amber-900/40 bg-zinc-950/40 px-3 py-3">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <p className="text-[11px] text-amber-100/80">
                                    Month detail (tap a day)
                                  </p>
                                  <span className="text-[10px] text-zinc-400">
                                    {monthLabel}
                                  </span>
                                </div>
                                <div className="mt-3 grid grid-cols-7 gap-2 text-[10px] text-zinc-400">
                                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                                    <span key={`${habit.id}-month-${day}-${index}`} className="text-center">
                                      {day}
                                    </span>
                                  ))}
                                </div>
                                <div className="mt-2 grid grid-cols-7 gap-2 text-[10px] text-zinc-200">
                                  {Array.from({ length: monthDays.startOffset }).map((_, index) => (
                                    <div key={`${habit.id}-month-empty-${index}`} className="h-10" />
                                  ))}
                                  {Array.from({ length: monthDays.daysInMonth }).map((_, index) => {
                                    const dayNumber = index + 1;
                                    const dateKey = `${monthDays.year}-${String(
                                      monthDays.month + 1
                                    ).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
                                    const value = totalsByDay.get(dateKey) ?? 0;
                                    const isSelected =
                                      (habitMonthFocusByHabit[habit.id] ?? null) === dateKey;
                                    return (
                                      <button
                                        key={`${habit.id}-month-${dateKey}`}
                                        type="button"
                                        onClick={() =>
                                          setHabitMonthFocusByHabit((prev) => ({
                                            ...prev,
                                            [habit.id]: dateKey,
                                          }))
                                        }
                                        className={`flex h-10 flex-col items-center justify-center rounded-md border px-1 ${
                                          isSelected
                                            ? "border-amber-400/70 bg-amber-400/10"
                                            : "border-zinc-800 bg-zinc-950/40"
                                        }`}
                                      >
                                        <span className="font-semibold">{dayNumber}</span>
                                        <span className="text-[9px] text-amber-100/80">
                                          {value > 0 ? value : ""}
                                        </span>
                                      </button>
                                    );
                                  })}
                                </div>
                                <div className="mt-3 rounded-md border border-zinc-900/40 bg-zinc-950/40 px-3 py-2 text-[11px] text-zinc-200">
                                  {habitMonthFocusByHabit[habit.id] ? (
                                    <>
                                      <p className="text-[11px] text-amber-100/80">
                                        {habitMonthFocusByHabit[habit.id]}
                                      </p>
                                      {habitSessions.filter((session) => {
                                        if (session.habitId !== habit.id) return false;
                                        const parsed = new Date(session.createdAt);
                                        if (Number.isNaN(parsed.getTime())) return false;
                                        return (
                                          toDateKey(parsed) === habitMonthFocusByHabit[habit.id]
                                        );
                                      }).length === 0 ? (
                                        <p className="mt-1 text-zinc-400">No sessions logged.</p>
                                      ) : (
                                        <div className="mt-1 space-y-1">
                                          {habitSessions
                                            .filter((session) => {
                                              if (session.habitId !== habit.id) return false;
                                              const parsed = new Date(session.createdAt);
                                              if (Number.isNaN(parsed.getTime())) return false;
                                              return (
                                                toDateKey(parsed) ===
                                                habitMonthFocusByHabit[habit.id]
                                              );
                                            })
                                            .map((session) => {
                                              const time = new Date(session.createdAt).toLocaleTimeString(
                                                [],
                                                { hour: "2-digit", minute: "2-digit" }
                                              );
                                              const amount =
                                                habit.kind === "amount"
                                                  ? session.amount ?? 0
                                                  : 1;
                                              return (
                                                <div
                                                  key={session.id}
                                                  className="flex items-center justify-between"
                                                >
                                                  <span>{time}</span>
                                                  <span className="text-amber-100/80">
                                                    {habit.kind === "amount"
                                                      ? amount
                                                      : "check-in"}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                        </div>
                                      )}
                                    </>
                                  ) : (
                                    <p className="text-zinc-400">
                                      Select a day to see the practice details.
                                    </p>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  }
                )}
              </div>
            </section>
          </>
        )}

        {activeTab === "tasks" && (
          <>
            <section className="grid gap-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">
                    Tasks ({hasTodoist ? dueTodayTasks.length : 12})
                  </h2>
                  <span className="text-xs text-zinc-400">
                    {hasTodoist ? "Live from Todoist" : "Grouped for low stress"}
                  </span>
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Due Today
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-zinc-200">
                      {focusTasks.map((task) => (
                        <li
                          key={task.id}
                          className="rounded-lg border border-indigo-900/50 bg-indigo-500/10 px-3 py-2"
                        >
                          {editingTaskId === task.id ? (
                            <div className="mt-2 grid gap-2 text-xs text-zinc-200">
                              <input
                                className="w-full rounded-lg border border-indigo-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                value={taskEditForm.content}
                                onChange={(event) =>
                                  setTaskEditForm((prev) => ({
                                    ...prev,
                                    content: event.target.value,
                                  }))
                                }
                              />
                              <input
                                className="w-full rounded-lg border border-indigo-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                placeholder="Description"
                                value={taskEditForm.description}
                                onChange={(event) =>
                                  setTaskEditForm((prev) => ({
                                    ...prev,
                                    description: event.target.value,
                                  }))
                                }
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  className="w-full rounded-lg border border-indigo-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                  placeholder="Due (e.g., tomorrow 5pm)"
                                  value={taskEditForm.due_string}
                                  onChange={(event) =>
                                    setTaskEditForm((prev) => ({
                                      ...prev,
                                      due_string: event.target.value,
                                    }))
                                  }
                                />
                                <input
                                  className="w-full rounded-lg border border-indigo-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                  placeholder="Priority (1-4)"
                                  value={taskEditForm.priority}
                                  onChange={(event) =>
                                    setTaskEditForm((prev) => ({
                                      ...prev,
                                      priority: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <input
                                className="w-full rounded-lg border border-indigo-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                placeholder="Labels (comma)"
                                value={taskEditForm.labels}
                                onChange={(event) =>
                                  setTaskEditForm((prev) => ({
                                    ...prev,
                                    labels: event.target.value,
                                  }))
                                }
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <select
                                  className="w-full rounded-lg border border-indigo-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                  value={taskEditForm.project_id}
                                  onChange={(event) =>
                                    setTaskEditForm((prev) => ({
                                      ...prev,
                                      project_id: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Project (optional)</option>
                                  {todoistProjects.map((project) => (
                                    <option key={project.id} value={project.id}>
                                      {project.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="w-full rounded-lg border border-indigo-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                  placeholder="Section ID"
                                  value={taskEditForm.section_id}
                                  onChange={(event) =>
                                    setTaskEditForm((prev) => ({
                                      ...prev,
                                      section_id: event.target.value,
                                    }))
                                  }
                                />
                                <input
                                  className="w-full rounded-lg border border-indigo-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                  placeholder="Parent ID"
                                  value={taskEditForm.parent_id}
                                  onChange={(event) =>
                                    setTaskEditForm((prev) => ({
                                      ...prev,
                                      parent_id: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400"
                                  onClick={saveTodoistTaskEdits}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-indigo-900/50 px-3 py-2 text-xs text-zinc-200 hover:text-white"
                                  onClick={cancelTodoistTaskEdits}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{task.title}</span>
                              <div className="flex items-center gap-2 text-[11px] text-indigo-300">
                                <span>P{task.priority ?? 1}</span>
                                {hasTodoist && (
                                  <>
                                    <button
                                      type="button"
                                      className="text-[11px] text-indigo-200 hover:text-indigo-100"
                                      onClick={() => updateTodoistTask(task)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="text-[11px] text-emerald-200 hover:text-emerald-100"
                                      onClick={() => completeTodoistTask(task.id)}
                                    >
                                      Complete
                                    </button>
                                    <button
                                      type="button"
                                      className="text-[11px] text-rose-200 hover:text-rose-100"
                                      onClick={() => deleteTodoistTask(task.id)}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="mt-1 text-[11px] text-zinc-400">
                            {task.due?.dateTime ?? task.due?.date ?? "No due date"} ·{" "}
                            {task.projectId
                              ? todoistProjects.find((p) => p.id === task.projectId)
                                  ?.name ?? "Project"
                              : "Inbox"}
                          </div>
                        </li>
                      ))}
                      {hasTodoist && focusTasks.length === 0 && (
                        <li className="rounded-lg border border-dashed border-indigo-900/40 bg-zinc-950/30 px-3 py-2 text-xs text-zinc-400">
                          No tasks due today.
                        </li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Remaining Tasks
                    </p>
                    <ul className="mt-2 space-y-2 text-sm text-zinc-200">
                      {remainingTasks.map((task) => (
                        <li
                          key={task.id}
                          className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2"
                        >
                          {editingTaskId === task.id ? (
                            <div className="mt-2 grid gap-2 text-xs text-zinc-200">
                              <input
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                value={taskEditForm.content}
                                onChange={(event) =>
                                  setTaskEditForm((prev) => ({
                                    ...prev,
                                    content: event.target.value,
                                  }))
                                }
                              />
                              <input
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                placeholder="Description"
                                value={taskEditForm.description}
                                onChange={(event) =>
                                  setTaskEditForm((prev) => ({
                                    ...prev,
                                    description: event.target.value,
                                  }))
                                }
                              />
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                  placeholder="Due (e.g., tomorrow 5pm)"
                                  value={taskEditForm.due_string}
                                  onChange={(event) =>
                                    setTaskEditForm((prev) => ({
                                      ...prev,
                                      due_string: event.target.value,
                                    }))
                                  }
                                />
                                <input
                                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                  placeholder="Priority (1-4)"
                                  value={taskEditForm.priority}
                                  onChange={(event) =>
                                    setTaskEditForm((prev) => ({
                                      ...prev,
                                      priority: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <input
                                className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                placeholder="Labels (comma)"
                                value={taskEditForm.labels}
                                onChange={(event) =>
                                  setTaskEditForm((prev) => ({
                                    ...prev,
                                    labels: event.target.value,
                                  }))
                                }
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <select
                                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                  value={taskEditForm.project_id}
                                  onChange={(event) =>
                                    setTaskEditForm((prev) => ({
                                      ...prev,
                                      project_id: event.target.value,
                                    }))
                                  }
                                >
                                  <option value="">Project (optional)</option>
                                  {todoistProjects.map((project) => (
                                    <option key={project.id} value={project.id}>
                                      {project.name}
                                    </option>
                                  ))}
                                </select>
                                <input
                                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                  placeholder="Section ID"
                                  value={taskEditForm.section_id}
                                  onChange={(event) =>
                                    setTaskEditForm((prev) => ({
                                      ...prev,
                                      section_id: event.target.value,
                                    }))
                                  }
                                />
                                <input
                                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                                  placeholder="Parent ID"
                                  value={taskEditForm.parent_id}
                                  onChange={(event) =>
                                    setTaskEditForm((prev) => ({
                                      ...prev,
                                      parent_id: event.target.value,
                                    }))
                                  }
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400"
                                  onClick={saveTodoistTaskEdits}
                                >
                                  Save
                                </button>
                                <button
                                  type="button"
                                  className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:text-white"
                                  onClick={cancelTodoistTaskEdits}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium">{task.title}</span>
                              <div className="flex items-center gap-2 text-[11px] text-zinc-400">
                                <span>P{task.priority ?? 1}</span>
                                {hasTodoist && (
                                  <>
                                    <button
                                      type="button"
                                      className="text-[11px] text-indigo-200 hover:text-indigo-100"
                                      onClick={() => updateTodoistTask(task)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="text-[11px] text-emerald-200 hover:text-emerald-100"
                                      onClick={() => completeTodoistTask(task.id)}
                                    >
                                      Complete
                                    </button>
                                    <button
                                      type="button"
                                      className="text-[11px] text-rose-200 hover:text-rose-100"
                                      onClick={() => deleteTodoistTask(task.id)}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                          <div className="mt-1 text-[11px] text-zinc-400">
                            {task.due?.dateTime ?? task.due?.date ?? "No due date"} ·{" "}
                            {task.projectId
                              ? todoistProjects.find((p) => p.id === task.projectId)
                                  ?.name ?? "Project"
                              : "Inbox"}
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Month view</h2>
                  <span className="text-xs text-zinc-400">{monthLabel}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
                  <span className="font-semibold text-zinc-400">Calendars shown:</span>
                  {googleCalendars.length === 0 && (
                    <span className="text-zinc-400">No calendars loaded</span>
                  )}
                  {googleCalendars.map((calendar) => {
                    const checked = selectedCalendarIds.includes(calendar.id);
                    return (
                      <label
                        key={calendar.id}
                        className={`flex items-center gap-2 rounded-full border px-2 py-1 ${
                          checked
                            ? "border-indigo-700/50 bg-indigo-500/10 text-indigo-200"
                            : "border-zinc-800 bg-zinc-950/40 text-zinc-400"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => {
                            setSelectedCalendarIds((prev) =>
                              prev.includes(calendar.id)
                                ? prev.filter((id) => id !== calendar.id)
                                : [...prev, calendar.id]
                            );
                          }}
                        />
                        <span>{calendar.name}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-7 gap-2 text-sm text-zinc-400">
                  {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
                    <span key={`${day}-${index}`} className="text-center font-semibold">
                      {day}
                    </span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2 text-sm text-zinc-200">
                  {Array.from({ length: monthDays.startOffset }).map((_, index) => (
                    <div key={`empty-${index}`} className="h-20" />
                  ))}
                  {Array.from({ length: monthDays.daysInMonth }).map((_, index) => {
                    const dayNumber = index + 1;
                    const dateKey = `${monthDays.year}-${String(
                      monthDays.month + 1
                    ).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
                    const events = eventsByDate.get(dateKey) ?? [];
                    const isToday = dateKey === todayKey;
                    return (
                      <div
                        key={dateKey}
                        className={`h-20 rounded-lg border px-2 py-1 ${
                          isToday
                            ? "border-indigo-700/60 bg-indigo-500/10"
                            : "border-zinc-800 bg-zinc-950/40"
                        }`}
                      >
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold">{dayNumber}</span>
                          {events.length > 0 && (
                            <span className="text-xs text-indigo-300">
                              {events.length}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 space-y-1">
                          {events.slice(0, 2).map((event) => (
                            <div
                              key={event.id}
                              className="truncate text-[10px] text-zinc-300"
                              title={event.title}
                            >
                              {event.title}
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm backdrop-blur">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Today’s agenda</h2>
                  <span className="text-xs text-zinc-400">
                    {hasCalendar ? "Live from Google" : "Sample agenda"}
                  </span>
                </div>
                <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                  {(hasCalendar
                    ? todayAgendaEvents
                    : [
                        { id: "event-1", title: "graduate program Class" } as CalendarEventContract,
                        { id: "event-2", title: "Lunch + walk" } as CalendarEventContract,
                        { id: "event-3", title: "Project work" } as CalendarEventContract,
                      ]
                  ).map((event) => (
                    <li
                      key={event.id}
                  className={`rounded-lg border px-3 py-2 ${
                    hasCalendar ? getEventColorClass(event) : "border-zinc-800 bg-zinc-950/40 text-zinc-200"
                  }`}
                    >
                  {editingEventId === event.id ? (
                    <div className="mt-2 grid gap-2 text-xs text-zinc-100">
                      <input
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                        placeholder="Event title"
                        value={eventEditForm.summary}
                        onChange={(eventInput) =>
                          setEventEditForm((prev) => ({
                            ...prev,
                            summary: eventInput.target.value,
                          }))
                        }
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                          type="datetime-local"
                          value={eventEditForm.start}
                          onChange={(eventInput) =>
                            setEventEditForm((prev) => ({
                              ...prev,
                              start: eventInput.target.value,
                            }))
                          }
                        />
                        <input
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                          type="datetime-local"
                          value={eventEditForm.end}
                          onChange={(eventInput) =>
                            setEventEditForm((prev) => ({
                              ...prev,
                              end: eventInput.target.value,
                            }))
                          }
                        />
                      </div>
                      <input
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                        placeholder="Location"
                        value={eventEditForm.location}
                        onChange={(eventInput) =>
                          setEventEditForm((prev) => ({
                            ...prev,
                            location: eventInput.target.value,
                          }))
                        }
                      />
                      <select
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                        value={eventEditForm.calendarId}
                        onChange={(eventInput) =>
                          setEventEditForm((prev) => ({
                            ...prev,
                            calendarId: eventInput.target.value,
                          }))
                        }
                      >
                        <option value="">Select calendar</option>
                        {googleCalendars.map((calendar) => (
                          <option key={calendar.id} value={calendar.id}>
                            {calendar.name}
                          </option>
                        ))}
                      </select>
                      <select
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                        value={eventEditForm.colorId}
                        onChange={(eventInput) =>
                          setEventEditForm((prev) => ({
                            ...prev,
                            colorId: eventInput.target.value,
                          }))
                        }
                      >
                        <option value="">Default color</option>
                        <option value="1">Lavender</option>
                        <option value="2">Sage</option>
                        <option value="3">Grape</option>
                        <option value="4">Flamingo</option>
                        <option value="5">Banana</option>
                        <option value="6">Tangerine</option>
                        <option value="7">Peacock</option>
                        <option value="8">Graphite</option>
                        <option value="9">Blueberry</option>
                        <option value="10">Basil</option>
                        <option value="11">Tomato</option>
                      </select>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-400"
                          onClick={saveCalendarEventEdits}
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:text-white"
                          onClick={cancelCalendarEventEdits}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm">
                        {hasCalendar ? `${formatEventTime(event)} ` : "9:00 "}
                        {event.title ?? "Untitled event"}
                      </span>
                      {hasCalendar && (
                        <div className="flex items-center gap-2 text-[11px]">
                          <button
                            type="button"
                            className="text-emerald-200 hover:text-emerald-100"
                            onClick={() => updateCalendarEvent(event)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-rose-200 hover:text-rose-100"
                            onClick={() => deleteCalendarEvent(event)}
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                    </li>
                  ))}
                  {hasCalendar && todayAgendaEvents.length === 0 && (
                    <li className="rounded-lg border border-dashed border-zinc-800 bg-zinc-950/30 px-3 py-2 text-xs text-zinc-400">
                      No events today.
                    </li>
                  )}
                </ul>
              </div>
            </section>

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-sm backdrop-blur">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold">Connections</h2>
                  <p className="text-sm text-zinc-300">
                    Link accounts to load real tasks and events.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    className="rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-400"
                    onClick={connectTodoist}
                    type="button"
                  >
                    Connect Todoist
                  </button>
                  <button
                    className="rounded-full bg-emerald-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-emerald-400"
                    onClick={connectGoogle}
                    type="button"
                  >
                    Connect Google Calendar
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Todoist</span>
                    <button
                      className="text-xs font-medium text-indigo-300 hover:text-indigo-200"
                      onClick={loadTodoist}
                      type="button"
                    >
                      {todoistLoading ? "Loading..." : "Load tasks"}
                    </button>
                  </div>
                  {todoistError ? (
                    <p className="mt-2 text-xs text-rose-400">{todoistError}</p>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-400">
                      {todoistTasks.length
                        ? `${todoistTasks.length} tasks loaded`
                        : "No tasks loaded yet"}
                    </p>
                  )}
                  <ul className="mt-3 space-y-2">
                    {todoistTasks.slice(0, 5).map((task) => (
                      <li
                        key={task.id}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200"
                      >
                      {editingTaskId === task.id ? (
                        <div className="mt-2 grid gap-2 text-xs text-zinc-200">
                          <input
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                            value={taskEditForm.content}
                            onChange={(event) =>
                              setTaskEditForm((prev) => ({
                                ...prev,
                                content: event.target.value,
                              }))
                            }
                          />
                          <input
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                            placeholder="Description"
                            value={taskEditForm.description}
                            onChange={(event) =>
                              setTaskEditForm((prev) => ({
                                ...prev,
                                description: event.target.value,
                              }))
                            }
                          />
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                              placeholder="Due (e.g., tomorrow 5pm)"
                              value={taskEditForm.due_string}
                              onChange={(event) =>
                                setTaskEditForm((prev) => ({
                                  ...prev,
                                  due_string: event.target.value,
                                }))
                              }
                            />
                            <input
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                              placeholder="Priority (1-4)"
                              value={taskEditForm.priority}
                              onChange={(event) =>
                                setTaskEditForm((prev) => ({
                                  ...prev,
                                  priority: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <input
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                            placeholder="Labels (comma)"
                            value={taskEditForm.labels}
                            onChange={(event) =>
                              setTaskEditForm((prev) => ({
                                ...prev,
                                labels: event.target.value,
                              }))
                            }
                          />
                          <div className="grid grid-cols-3 gap-2">
                            <select
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                              value={taskEditForm.project_id}
                              onChange={(event) =>
                                setTaskEditForm((prev) => ({
                                  ...prev,
                                  project_id: event.target.value,
                                }))
                              }
                            >
                              <option value="">Project (optional)</option>
                              {todoistProjects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>
                            <input
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                              placeholder="Section ID"
                              value={taskEditForm.section_id}
                              onChange={(event) =>
                                setTaskEditForm((prev) => ({
                                  ...prev,
                                  section_id: event.target.value,
                                }))
                              }
                            />
                            <input
                              className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                              placeholder="Parent ID"
                              value={taskEditForm.parent_id}
                              onChange={(event) =>
                                setTaskEditForm((prev) => ({
                                  ...prev,
                                  parent_id: event.target.value,
                                }))
                              }
                            />
                          </div>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400"
                              onClick={saveTodoistTaskEdits}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-300 hover:text-white"
                              onClick={cancelTodoistTaskEdits}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">{task.title}</span>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              className="text-[11px] text-indigo-300 hover:text-indigo-200"
                              onClick={() => updateTodoistTask(task)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="text-[11px] text-emerald-300 hover:text-emerald-200"
                              onClick={() => completeTodoistTask(task.id)}
                            >
                              Complete
                            </button>
                            <button
                              type="button"
                              className="text-[11px] text-rose-300 hover:text-rose-200"
                              onClick={() => deleteTodoistTask(task.id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      )}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 border-t border-zinc-800 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Create task
                    </p>
                    <div className="mt-2 grid gap-2">
                      <input
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                        placeholder="Task title"
                        value={newTaskContent}
                        onChange={(event) => setNewTaskContent(event.target.value)}
                      />
                      <input
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                        placeholder="Description"
                        value={newTaskDescription}
                        onChange={(event) => setNewTaskDescription(event.target.value)}
                      />
                      <input
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                        placeholder="Due (e.g., tomorrow 5pm)"
                        value={newTaskDueString}
                        onChange={(event) => setNewTaskDueString(event.target.value)}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                          placeholder="Priority (1-4)"
                          value={newTaskPriority}
                          onChange={(event) => setNewTaskPriority(event.target.value)}
                        />
                        <input
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                          placeholder="Labels (comma)"
                          value={newTaskLabels}
                          onChange={(event) => setNewTaskLabels(event.target.value)}
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <select
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                          value={newTaskProjectId}
                          onChange={(event) => setNewTaskProjectId(event.target.value)}
                        >
                          <option value="">Project (optional)</option>
                          {todoistProjects.map((project) => (
                            <option key={project.id} value={project.id}>
                              {project.name}
                            </option>
                          ))}
                        </select>
                        <input
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                          placeholder="Section ID"
                          value={newTaskSectionId}
                          onChange={(event) => setNewTaskSectionId(event.target.value)}
                        />
                        <input
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                          placeholder="Parent ID"
                          value={newTaskParentId}
                          onChange={(event) => setNewTaskParentId(event.target.value)}
                        />
                      </div>
                      <button
                        className="rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-400"
                        type="button"
                        onClick={createTodoistTask}
                        disabled={todoistCreateLoading}
                      >
                        {todoistCreateLoading ? "Creating..." : "Add task"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 px-4 py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">Google Calendar</span>
                    <button
                      className="text-xs font-medium text-emerald-300 hover:text-emerald-200"
                      onClick={loadCalendar}
                      type="button"
                    >
                      {calendarLoading ? "Loading..." : "Load events"}
                    </button>
                  </div>
                  {calendarError ? (
                    <p className="mt-2 text-xs text-rose-400">{calendarError}</p>
                  ) : (
                    <p className="mt-2 text-xs text-zinc-400">
                      {calendarEvents.length
                        ? `${calendarEvents.length} events loaded`
                        : "No events loaded yet"}
                    </p>
                  )}
                  <ul className="mt-3 space-y-2">
                    {calendarEvents.slice(0, 5).map((event) => (
                      <li
                        key={event.id}
                        className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200"
                      >
                    {editingEventId === event.id ? (
                      <div className="mt-2 grid gap-2 text-xs text-zinc-100">
                        <input
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                          placeholder="Event title"
                          value={eventEditForm.summary}
                          onChange={(eventInput) =>
                            setEventEditForm((prev) => ({
                              ...prev,
                              summary: eventInput.target.value,
                            }))
                          }
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                            type="datetime-local"
                            value={eventEditForm.start}
                            onChange={(eventInput) =>
                              setEventEditForm((prev) => ({
                                ...prev,
                                start: eventInput.target.value,
                              }))
                            }
                          />
                          <input
                            className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                            type="datetime-local"
                            value={eventEditForm.end}
                            onChange={(eventInput) =>
                              setEventEditForm((prev) => ({
                                ...prev,
                                end: eventInput.target.value,
                              }))
                            }
                          />
                        </div>
                        <input
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                          placeholder="Location"
                          value={eventEditForm.location}
                          onChange={(eventInput) =>
                            setEventEditForm((prev) => ({
                              ...prev,
                              location: eventInput.target.value,
                            }))
                          }
                        />
                        <select
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                          value={eventEditForm.calendarId}
                          onChange={(eventInput) =>
                            setEventEditForm((prev) => ({
                              ...prev,
                              calendarId: eventInput.target.value,
                            }))
                          }
                        >
                          <option value="">Select calendar</option>
                          {googleCalendars.map((calendar) => (
                            <option key={calendar.id} value={calendar.id}>
                              {calendar.name}
                            </option>
                          ))}
                        </select>
                        <select
                          className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                          value={eventEditForm.colorId}
                          onChange={(eventInput) =>
                            setEventEditForm((prev) => ({
                              ...prev,
                              colorId: eventInput.target.value,
                            }))
                          }
                        >
                          <option value="">Default color</option>
                          <option value="1">Lavender</option>
                          <option value="2">Sage</option>
                          <option value="3">Grape</option>
                          <option value="4">Flamingo</option>
                          <option value="5">Banana</option>
                          <option value="6">Tangerine</option>
                          <option value="7">Peacock</option>
                          <option value="8">Graphite</option>
                          <option value="9">Blueberry</option>
                          <option value="10">Basil</option>
                          <option value="11">Tomato</option>
                        </select>
                        <div className="flex gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-400"
                            onClick={saveCalendarEventEdits}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="rounded-lg border border-zinc-800 px-3 py-2 text-xs text-zinc-200 hover:text-white"
                            onClick={cancelCalendarEventEdits}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{event.title ?? "Untitled event"}</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="text-[11px] text-emerald-300 hover:text-emerald-200"
                            onClick={() => updateCalendarEvent(event)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="text-[11px] text-rose-300 hover:text-rose-200"
                            onClick={() => deleteCalendarEvent(event)}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-4 border-t border-zinc-800 pt-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
                      Create event
                    </p>
                    <div className="mt-2 grid gap-2">
                      <select
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                        value={selectedCalendarIds[0] ?? ""}
                        onChange={(event) =>
                          setSelectedCalendarIds(
                            event.target.value ? [event.target.value] : []
                          )
                        }
                      >
                        <option value="">Select calendar</option>
                        {googleCalendars.map((calendar) => (
                          <option key={calendar.id} value={calendar.id}>
                            {calendar.name}
                          </option>
                        ))}
                      </select>
                      <input
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                        placeholder="Event title"
                        value={newEventTitle}
                        onChange={(event) => setNewEventTitle(event.target.value)}
                      />
                      <input
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                        type="datetime-local"
                        value={newEventStart}
                        onChange={(event) => setNewEventStart(event.target.value)}
                      />
                      <input
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                        type="datetime-local"
                        value={newEventEnd}
                        onChange={(event) => setNewEventEnd(event.target.value)}
                      />
                      <input
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-500"
                        placeholder="Location (optional)"
                        value={newEventLocation}
                        onChange={(event) => setNewEventLocation(event.target.value)}
                      />
                      <select
                        className="w-full rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                        value={newEventColor}
                        onChange={(event) => setNewEventColor(event.target.value)}
                      >
                        <option value="">Default color</option>
                        <option value="1">Lavender</option>
                        <option value="2">Sage</option>
                        <option value="3">Grape</option>
                        <option value="4">Flamingo</option>
                        <option value="5">Banana</option>
                        <option value="6">Tangerine</option>
                        <option value="7">Peacock</option>
                        <option value="8">Graphite</option>
                        <option value="9">Blueberry</option>
                        <option value="10">Basil</option>
                        <option value="11">Tomato</option>
                      </select>
                      <button
                        className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-medium text-white hover:bg-emerald-400"
                        type="button"
                        onClick={createCalendarEvent}
                        disabled={calendarCreateLoading}
                      >
                        {calendarCreateLoading ? "Creating..." : "Add event"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}
