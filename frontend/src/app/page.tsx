"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import type { CalendarEventContract, TaskContract } from "@/lib/contracts";
import type { Habit, HabitSession } from "@/lib/habits";
import type { Goal } from "@/lib/goals";
import { buildBriefingContext, type AIBriefingResponse } from "@/lib/ai";
import { useAIBriefing } from "@/lib/useAIBriefing";
import { toDateKey, getWeekStartKey, getMonthKey, getYearKey } from "@/lib/date-utils";
import { computeHabitStats } from "@/lib/habit-stats";
import { apiFetch } from "@/lib/fetch-helpers";
import { createClient } from "@/lib/supabase/client";
import {
  loadIdentityMetrics,
  loadLatestIdentityMetricsBeforeDate,
  saveIdentityMetrics,
  loadMorningFlow,
  saveMorningFlow,
  deleteMorningFlow,
  loadFocus3,
  saveFocus3,
  loadGoals,
  loadHabits,
  loadHabitSessions,
  insertHabitSession,
  updateHabitSession,
  deleteHabitSession,
  loadWeeklyReflection,
  upsertWeeklyReflection,
  loadLatestWeeklyReflection,
  loadUserPreferences,
  saveUserPreferences,
  loadRecentWeeklyReflections,
  loadFourWeekReview,
  loadPreviousFourWeekReview,
  upsertFourWeekReview,
  loadIdentityProfile,
} from "@/lib/supabase/data";
import type { WeeklyReflection, UserPreferences, IdentityProfile } from "@/lib/supabase/types";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import ChatPanel from "@/components/ChatPanel";
import DashboardHeader from "@/components/DashboardHeader";
import MorningFlowBanner from "@/components/MorningFlowBanner";
import InsightsSection from "@/components/InsightsSection";
import IdentityCheck, { identityQuestions } from "@/components/IdentityCheck";
import CalendarMonthView from "@/components/CalendarMonthView";
import ConnectionsPanel from "@/components/ConnectionsPanel";

type Focus3Item = { id: string; label: string; type: string };

type Focus3State = {
  status: "loading" | "proposing" | "submitted" | "editing";
  items: Focus3Item[];
  draft: Focus3Item[];
  reasoning: string;
  aiLoading: boolean;
  aiError: string | null;
  dataLoaded: boolean;
  customInputs: Record<number, string>;
};

type Focus3Action =
  | { type: "LOAD_FROM_DB"; items: Focus3Item[]; reasoning: string }
  | { type: "DATA_LOADED" }
  | { type: "AI_START" }
  | { type: "AI_SUCCESS"; items: Focus3Item[]; reasoning: string }
  | { type: "AI_ERROR"; error: string }
  | { type: "AI_DONE" }
  | { type: "ACCEPT_DRAFT"; items: Focus3Item[] }
  | { type: "EDIT_START"; items: Focus3Item[] }
  | { type: "CANCEL_EDIT" }
  | { type: "SET_DRAFT"; draft: Focus3Item[] }
  | { type: "SET_CUSTOM_INPUT"; index: number; value: string }
  | { type: "CLEAR_MANUAL" };

const focus3InitialState: Focus3State = {
  status: "loading",
  items: [],
  draft: [],
  reasoning: "",
  aiLoading: false,
  aiError: null,
  dataLoaded: false,
  customInputs: {},
};

function focus3Reducer(state: Focus3State, action: Focus3Action): Focus3State {
  switch (action.type) {
    case "LOAD_FROM_DB":
      return { ...state, items: action.items, reasoning: action.reasoning, status: "submitted" };
    case "DATA_LOADED":
      return { ...state, dataLoaded: true };
    case "AI_START":
      return { ...state, aiLoading: true, aiError: null };
    case "AI_SUCCESS":
      return { ...state, draft: action.items, reasoning: action.reasoning, status: "proposing" };
    case "AI_ERROR":
      return { ...state, aiError: action.error, draft: [...EMPTY_FOCUS3], status: "proposing" };
    case "AI_DONE":
      return { ...state, aiLoading: false };
    case "ACCEPT_DRAFT":
      return { ...state, items: action.items, status: "submitted", customInputs: {} };
    case "EDIT_START":
      return { ...state, draft: [...action.items], status: "editing" };
    case "CANCEL_EDIT":
      return { ...state, status: "submitted" };
    case "SET_DRAFT":
      return { ...state, draft: action.draft };
    case "SET_CUSTOM_INPUT":
      return { ...state, customInputs: { ...state.customInputs, [action.index]: action.value } };
    case "CLEAR_MANUAL":
      return { ...state, draft: [...EMPTY_FOCUS3], reasoning: "", customInputs: {} };
    default:
      return state;
  }
}

const EMPTY_FOCUS3: Array<{ id: string; label: string; type: string }> = [
  { id: "", label: "", type: "Focus" },
  { id: "", label: "", type: "Focus" },
  { id: "", label: "", type: "Focus" },
];

export default function Home() {
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [userGoals, setUserGoals] = useState<Goal[]>([]);
  const [todoistTasks, setTodoistTasks] = useState<TaskContract[]>([]);
  const [completedTodayTasks, setCompletedTodayTasks] = useState<TaskContract[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [habitSessions, setHabitSessions] = useState<HabitSession[]>([]);
  const [habitLoading, setHabitLoading] = useState(false);
  const [habitSaving, setHabitSaving] = useState(false);
  const [habitError, setHabitError] = useState<string | null>(null);
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
  const [habitViewDateKey, setHabitViewDateKey] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [sessionEditInputs, setSessionEditInputs] = useState<
    Record<string, { amount: string; note: string }>
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
  const [chatOpen, setChatOpen] = useState(false);
  const [identityMetrics, setIdentityMetrics] = useState({
    morningGrounding: false,
    embodiedMovement: false,
    nutritionalAwareness: false,
    presentConnection: false,
    curiositySpark: false,
  });
  const [identityViewDateKey, setIdentityViewDateKey] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [identityViewMetrics, setIdentityViewMetrics] = useState<{
    morningGrounding: boolean;
    embodiedMovement: boolean;
    nutritionalAwareness: boolean;
    presentConnection: boolean;
    curiositySpark: boolean;
  } | null>(null);
  const [identityViewLoading, setIdentityViewLoading] = useState(false);
  /** Yesterday's identity metrics — used for AI briefing/insights so the day's checks aren't used before the user has had time to complete them. */
  const [yesterdayIdentityMetrics, setYesterdayIdentityMetrics] = useState<{
    morningGrounding: boolean;
    embodiedMovement: boolean;
    nutritionalAwareness: boolean;
    presentConnection: boolean;
    curiositySpark: boolean;
  } | null>(null);
  const [weeklyReflection, setWeeklyReflection] = useState<WeeklyReflection | null>(null);
  const [weeklyReflectionSaving, setWeeklyReflectionSaving] = useState(false);
  const [latestWeeklyReflection, setLatestWeeklyReflection] = useState<WeeklyReflection | null>(null);
  const [userPreferences, setUserPreferences] = useState<UserPreferences | null>(null);
  const [identityProfile, setIdentityProfile] = useState<IdentityProfile | null>(null);
  const [fourWeekReflections, setFourWeekReflections] = useState<WeeklyReflection[]>([]);
  const [fourWeekReviewGoalIds, setFourWeekReviewGoalIds] = useState<string[]>([]);
  const [fourWeekReviewNotes, setFourWeekReviewNotes] = useState<string>("");
  const [fourWeekReviewSaving, setFourWeekReviewSaving] = useState(false);
  const [fourWeekReviewExists, setFourWeekReviewExists] = useState(false);
  const [fourWeekReviewEditMode, setFourWeekReviewEditMode] = useState(false);
  const [fourWeekReviewSavedAt, setFourWeekReviewSavedAt] = useState<string | null>(null);
  const [previousFourWeekNotes, setPreviousFourWeekNotes] = useState<string | null>(null);
  const [weeklyReflectionFromDb, setWeeklyReflectionFromDb] = useState(false);
  const [weeklyReflectionEditMode, setWeeklyReflectionEditMode] = useState(false);
  const [fourWeekReviewSaveError, setFourWeekReviewSaveError] = useState<string | null>(null);
  const [f3, f3d] = useReducer(focus3Reducer, focus3InitialState);
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

  // Debounce timers for Supabase saves
  const identitySaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const morningFlowSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const identityMetricsCache = useRef<Record<string, {
    morningGrounding: boolean;
    embodiedMovement: boolean;
    nutritionalAwareness: boolean;
    presentConnection: boolean;
    curiositySpark: boolean;
  }>>({});

  // Auth check + onboarding gate + initial data load from Supabase
  useEffect(() => {
    let cancelled = false;
    const sb = createClient();
    setSupabase(sb);

    async function init() {
      const { data: { user: authUser } } = await sb.auth.getUser();
      if (cancelled) return;

      if (!authUser) {
        window.location.href = "/login";
        return;
      }
      setUser(authUser);

      // Onboarding gate: check if user has completed onboarding
      const [prefs, goalsCheck] = await Promise.all([
        loadUserPreferences(sb, authUser.id),
        loadGoals(sb, authUser.id),
      ]);
      if (cancelled) return;

      if (prefs?.onboardingCompleted !== true && goalsCheck.length === 0) {
        // New user without onboarding — redirect to wizard
        window.location.href = "/onboarding";
        return;
      }

      // Store preferences for dashboard use
      setUserPreferences(prefs);
      setAuthLoading(false);

      // Load all daily data in parallel (today + yesterday for identity metrics used by AI)
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

      const [
        habitsData,
        sessionsData,
        metricsData,
        latestIdentityBeforeToday,
        flowData,
        focus3Data,
        profileData,
      ] = await Promise.all([
        loadHabits(sb, authUser.id),
        loadHabitSessions(sb, authUser.id),
        loadIdentityMetrics(sb, authUser.id, dateKey),
        loadLatestIdentityMetricsBeforeDate(sb, authUser.id, dateKey),
        loadMorningFlow(sb, authUser.id, dateKey),
        loadFocus3(sb, authUser.id, dateKey),
        loadIdentityProfile(sb, authUser.id),
      ]);

      if (cancelled) return;

      setUserGoals(goalsCheck);
      if (profileData) setIdentityProfile(profileData);
      if (habitsData.length) setHabits(habitsData);
      if (sessionsData.length) setHabitSessions(sessionsData);
      if (metricsData) setIdentityMetrics(metricsData);
      if (latestIdentityBeforeToday?.metrics) {
        setYesterdayIdentityMetrics(latestIdentityBeforeToday.metrics);
      }
      if (flowData) {
        setMorningFlowStatus(flowData.status);
        setMorningFlowSteps(flowData.steps);
      }
      if (focus3Data?.items?.length) {
        f3d({ type: "LOAD_FROM_DB", items: focus3Data.items, reasoning: focus3Data.aiReasoning ?? "" });
      }
      f3d({ type: "DATA_LOADED" });
    }

    init();
    return () => { cancelled = true; };
  }, []);

  const handleLogout = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    window.location.href = "/login";
  }, [supabase]);

  const hasTodoist = todoistTasks.length > 0;
  const hasCalendar = calendarEvents.length > 0;
  const countTrue = (obj: Record<string, boolean>) => Object.values(obj).filter(Boolean).length;
  const identityScore = countTrue(identityMetrics);
  /** Yesterday's identity score (0–5) for AI briefing/insights — excludes today so morning content isn't based on incomplete checks. */
  const identityScoreForAI =
    yesterdayIdentityMetrics != null
      ? countTrue(yesterdayIdentityMetrics)
      : 0;
  const defaultIdentityMetricsForAI = {
    morningGrounding: false,
    embodiedMovement: false,
    nutritionalAwareness: false,
    presentConnection: false,
    curiositySpark: false,
  };
  const identityMetricsForAI = yesterdayIdentityMetrics ?? defaultIdentityMetricsForAI;

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

  const toLocalDateTimeInputValue = (value?: string) => {
    if (!value) return "";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "";
    const offsetMs = parsed.getTimezoneOffset() * 60000;
    const local = new Date(parsed.getTime() - offsetMs);
    return local.toISOString().slice(0, 16);
  };

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

  const isIdentityViewToday = identityViewDateKey === todayKey;
  const identityViewActive = isIdentityViewToday
    ? identityMetrics
    : identityViewMetrics ?? {
        morningGrounding: false,
        embodiedMovement: false,
        nutritionalAwareness: false,
        presentConnection: false,
        curiositySpark: false,
      };
  const identityViewScore = Object.values(identityViewActive).filter(Boolean).length;

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

  // identityQuestions imported from @/components/IdentityCheck

  const toggleIdentityMetric = (key: string) => {
    if (isIdentityViewToday) {
      setIdentityMetrics((prev) => ({
        ...prev,
        [key]: !prev[key as keyof typeof prev],
      }));
    } else {
      setIdentityViewMetrics((prev) => {
        const current = prev ?? {
          morningGrounding: false,
          embodiedMovement: false,
          nutritionalAwareness: false,
          presentConnection: false,
          curiositySpark: false,
        };
        const updated = { ...current, [key]: !current[key as keyof typeof current] };
        identityMetricsCache.current[identityViewDateKey] = updated;
        if (supabase && user) {
          saveIdentityMetrics(supabase, user.id, identityViewDateKey, updated).catch(() => {});
        }
        return updated;
      });
    }
  };

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
      const payload = await apiFetch<{
        items: TaskContract[];
        completedToday?: TaskContract[];
      }>("/api/todoist/tasks?includeCompletedToday=true", {
        silent401: silent,
        label: "Todoist fetch",
      });
      if (!payload) return;
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
      const payload = await apiFetch<{
        items: Array<{ id: string; name: string }>;
      }>("/api/todoist/projects", {
        silent401: silent,
        label: "Todoist projects fetch",
      });
      if (!payload) return;
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
    try {
      const payload = await apiFetch<{
        items: Array<{ id: string; name: string; primary: boolean }>;
      }>("/api/google/calendars", {
        silent401: silent,
        label: "Calendar list",
      });
      if (!payload) return;
      const calendars = payload.items ?? [];
      setGoogleCalendars(calendars);
      if (!selectedCalendarIds.length && calendars.length) {
        const primary = calendars.find((item) => item.primary);
        const nextSelectedIds = primary ? [primary.id] : calendars.map((item) => item.id);
        setSelectedCalendarIds(nextSelectedIds);
      }
    } catch (error) {
      if (!silent) {
        setCalendarError(
          error instanceof Error ? error.message : "Calendar list failed"
        );
      }
    }
  }, [selectedCalendarIds]);

  const loadCalendar = useCallback(
    async (silent = false) => {
      setCalendarLoading(true);
      setCalendarError(null);
      try {
        const calendarParam = selectedCalendarIds.length
          ? `?calendarIds=${encodeURIComponent(selectedCalendarIds.join(","))}`
          : "";
        const payload = await apiFetch<{
          items: CalendarEventContract[];
        }>(`/api/google/events${calendarParam}`, {
          silent401: silent,
          label: "Calendar fetch",
        });
        if (!payload) return;
        setCalendarEvents(payload.items ?? []);
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
    if (!user || !supabase) return;
    setHabitLoading(true);
    setHabitError(null);
    try {
      const [habitsData, sessionsData] = await Promise.all([
        loadHabits(supabase, user.id),
        loadHabitSessions(supabase, user.id),
      ]);
      setHabits(habitsData);
      setHabitSessions(sessionsData);
    } catch (error) {
      setHabitError(error instanceof Error ? error.message : "Habit load failed");
    } finally {
      setHabitLoading(false);
    }
  }, [supabase, user]);

  useEffect(() => {
    loadTodoist(true);
    loadTodoistProjects(true);
    loadGoogleCalendars(true);
    loadCalendar(true);
  }, [loadTodoist, loadTodoistProjects, loadGoogleCalendars, loadCalendar]);

  // Debounced save: morning flow status + steps → Supabase
  useEffect(() => {
    if (!user || !supabase) return;
    if (morningFlowSaveTimer.current) clearTimeout(morningFlowSaveTimer.current);
    morningFlowSaveTimer.current = setTimeout(() => {
      saveMorningFlow(supabase, user.id, todayKey, {
        status: morningFlowStatus,
        steps: morningFlowSteps,
      }).catch(() => {});
    }, 500);
  }, [morningFlowStatus, morningFlowSteps, todayKey, supabase, user]);

  // Debounced save: identity metrics → Supabase
  useEffect(() => {
    if (!user || !supabase) return;
    if (identitySaveTimer.current) clearTimeout(identitySaveTimer.current);
    identitySaveTimer.current = setTimeout(() => {
      saveIdentityMetrics(supabase, user.id, todayKey, identityMetrics).catch(() => {});
    }, 500);
  }, [identityMetrics, todayKey, supabase, user]);

  // Load identity metrics when viewing a past date
  useEffect(() => {
    if (identityViewDateKey === todayKey) {
      setIdentityViewMetrics(null);
      return;
    }
    const cached = identityMetricsCache.current[identityViewDateKey];
    if (cached) {
      setIdentityViewMetrics(cached);
      return;
    }
    if (!supabase || !user) return;
    let cancelled = false;
    setIdentityViewLoading(true);
    loadIdentityMetrics(supabase, user.id, identityViewDateKey).then((data) => {
      if (cancelled) return;
      const metrics = data ?? {
        morningGrounding: false,
        embodiedMovement: false,
        nutritionalAwareness: false,
        presentConnection: false,
        curiositySpark: false,
      };
      identityMetricsCache.current[identityViewDateKey] = metrics;
      setIdentityViewMetrics(metrics);
      setIdentityViewLoading(false);
    }).catch(() => {
      if (!cancelled) setIdentityViewLoading(false);
    });
    return () => { cancelled = true; };
  }, [identityViewDateKey, todayKey, supabase, user]);

  const currentWeekKey = useMemo(() => getWeekStartKey(new Date()), [todayKey]);

  // Previous week = the week that just ended (for reflection and metrics)
  const previousWeekKey = useMemo(() => {
    const thisWeekStart = new Date(currentWeekKey + "T12:00:00");
    const prev = new Date(thisWeekStart);
    prev.setDate(prev.getDate() - 7);
    return toDateKey(prev);
  }, [currentWeekKey]);

  const isSunday = useMemo(() => {
    const d = new Date(todayKey + "T12:00:00");
    return d.getDay() === 0;
  }, [todayKey]);

  const weeklyReflectionFilledForPreviousWeek = useMemo(() => {
    // Only treat the previous week as "filled" once a reflection has been
    // loaded from or successfully saved to the database. This prevents the
    // card from disappearing on non-Sundays while the user is still typing.
    if (!weeklyReflectionFromDb) return false;
    if (!weeklyReflection || weeklyReflection.weekStartDate !== previousWeekKey) return false;
    return (
      weeklyReflection.whatWentWell.trim() !== "" ||
      weeklyReflection.whatMattered.trim() !== "" ||
      weeklyReflection.learnings.trim() !== "" ||
      weeklyReflection.capabilityGrowth !== null
    );
  }, [weeklyReflectionFromDb, weeklyReflection, previousWeekKey]);

  const showWeeklyReflectionSection =
    isSunday || (!weeklyReflectionFilledForPreviousWeek && weeklyReflection?.weekStartDate === previousWeekKey);

  const previousWeekRangeLabel = useMemo(() => {
    const start = new Date(previousWeekKey + "T12:00:00");
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
    return `${fmt(start)}–${fmt(end)}`;
  }, [previousWeekKey]);

  const FOUR_WEEK_EPOCH = "2026-01-05";
  const isFourthSunday = useMemo(() => {
    if (!isSunday) return false;
    const today = new Date(todayKey + "T12:00:00");
    const epoch = new Date(FOUR_WEEK_EPOCH + "T12:00:00");
    const diffMs = today.getTime() - epoch.getTime();
    const sundaysSinceEpoch = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
    return sundaysSinceEpoch > 0 && sundaysSinceEpoch % 4 === 0;
  }, [isSunday, todayKey]);

  const periodEndDateForFourWeek = isFourthSunday ? todayKey : null;

  // Load weekly reflection for previous week (the week we reflect on)
  useEffect(() => {
    if (!supabase || !user) return;
    const defaultReflection: WeeklyReflection = {
      weekStartDate: previousWeekKey,
      whatWentWell: "",
      whatMattered: "",
      learnings: "",
      capabilityGrowth: null,
    };
    setWeeklyReflection(defaultReflection);
    setWeeklyReflectionFromDb(false);
    setWeeklyReflectionEditMode(false);
    loadWeeklyReflection(supabase, user.id, previousWeekKey).then((data) => {
      if (data) {
        setWeeklyReflection(data);
        setWeeklyReflectionFromDb(true);
        setWeeklyReflectionEditMode(false);
      }
    });
  }, [supabase, user, previousWeekKey]);

  // Load latest weekly reflection (for AI briefing and Focus 3)
  useEffect(() => {
    if (!supabase || !user) return;
    loadLatestWeeklyReflection(supabase, user.id).then(setLatestWeeklyReflection);
  }, [supabase, user]);

  // User preferences loaded in init effect (onboarding gate)

  // Load 4-week review data when it's the 4th Sunday
  useEffect(() => {
    if (!supabase || !user || !periodEndDateForFourWeek) return;
    loadRecentWeeklyReflections(supabase, user.id, 4).then(setFourWeekReflections);
    loadFourWeekReview(supabase, user.id, periodEndDateForFourWeek).then((review) => {
      if (review) {
        setFourWeekReviewGoalIds(review.goalIds ?? []);
        setFourWeekReviewNotes(review.systemAdjustmentNotes ?? "");
        setFourWeekReviewExists(true);
        setFourWeekReviewEditMode(false);
        setFourWeekReviewSavedAt(review.updatedAt ?? null);
      } else {
        setFourWeekReviewGoalIds([]);
        setFourWeekReviewNotes("");
        setFourWeekReviewExists(false);
        setFourWeekReviewEditMode(false);
        setFourWeekReviewSavedAt(null);
      }
      setFourWeekReviewSaveError(null);
    });
    loadPreviousFourWeekReview(supabase, user.id, periodEndDateForFourWeek).then((prev) => {
      setPreviousFourWeekNotes(prev?.systemAdjustmentNotes ?? null);
    });
  }, [supabase, user, periodEndDateForFourWeek]);

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

  // Last 7 days excluding today (complete days only for historic metrics)
  const last7Days = useMemo(() => {
    const days: string[] = [];
    for (let i = 1; i <= 7; i += 1) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      days.push(toDateKey(date));
    }
    return days;
  }, []);

  const habitStats = useMemo(
    () => computeHabitStats(activeHabits, habitSessionsById, last7Days),
    [activeHabits, habitSessionsById, last7Days]
  );

  // Habit summary for the previous week (the week being reflected on) — must be after habitStats
  const previousWeekHabitSummary = useMemo(() => {
    if (!habitStats.length) return { weekCount: 0, total: 0 };
    let count = 0;
    const weekStart = new Date(previousWeekKey + "T12:00:00");
    for (const stat of habitStats) {
      const target = stat.habit.count || 1;
      if (stat.isDaily) {
        let daysDone = 0;
        for (let i = 0; i < 7; i++) {
          const day = new Date(weekStart);
          day.setDate(day.getDate() + i);
          const key = toDateKey(day);
          const value = stat.totalsByDay.get(key) ?? 0;
          if (stat.habit.kind === "amount" ? value >= target : value >= 1) daysDone++;
        }
        if (daysDone > 0) count++;
      } else {
        const weekValue = stat.totalsByWeek.get(previousWeekKey) ?? 0;
        if (weekValue >= target) count++;
      }
    }
    return { weekCount: count, total: habitStats.length };
  }, [habitStats, previousWeekKey]);

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

  const habitSummaryForViewDate = useMemo(() => {
    const viewDateCount = habitStats.filter((stat) =>
      stat.totalsByDay.has(habitViewDateKey)
    ).length;
    return { viewDateCount };
  }, [habitStats, habitViewDateKey]);

  // ── Focus 3 AI-driven options ───────────────────────────────────────
  const focus3Options = useMemo(() => [
    ...dueTodayTasks.map((t) => ({
      id: `task-${t.id}`,
      label: cleanFocusTitle(t.title),
      type: "Task",
      group: "Tasks",
    })),
    ...completedTodayTasks.map((t) => ({
      id: `completed-${t.id}`,
      label: cleanFocusTitle(t.title),
      type: "Completed task",
      group: "Tasks",
    })),
    ...todayAgendaEvents.map((e) => ({
      id: `event-${e.id}`,
      label: cleanFocusTitle(e.title ?? "Untitled event"),
      type: "Event",
      group: "Events",
    })),
    ...activeHabits.map((h) => ({
      id: `habit-${h.id}`,
      label: h.title,
      type: "Habit",
      group: "Habits",
    })),
    ...identityQuestions.map((q) => ({
      id: `identity-${q.key}`,
      label: q.helper,
      type: "Identity",
      group: "Identity",
    })),
  ], [dueTodayTasks, completedTodayTasks, todayAgendaEvents, activeHabits]);

  // Ref holds latest context so Focus 3 effect can read it without re-running when data updates (which would abort the request).
  const focus3ContextRef = useRef({
    todayKey,
    userGoals,
    dueTodayTasks,
    completedTodayTasks,
    todayAgendaEvents,
    habitStats,
    identityMetricsForAI: defaultIdentityMetricsForAI,
    identityScoreForAI: 0,
    latestReflection: null as WeeklyReflection | null,
    aiTone: "standard" as "standard" | "gentle",
    identityProfile: null as IdentityProfile | null,
    aiAdditionalContext: undefined as string | undefined,
  });
  focus3ContextRef.current = {
    todayKey,
    userGoals,
    dueTodayTasks,
    completedTodayTasks,
    todayAgendaEvents,
    habitStats,
    identityMetricsForAI,
    identityScoreForAI,
    latestReflection: latestWeeklyReflection,
    aiTone: userPreferences?.aiTone ?? "standard",
    identityProfile,
    aiAdditionalContext: userPreferences?.aiAdditionalContext,
  };
  const focus3HasData =
    dueTodayTasks.length > 0 || todayAgendaEvents.length > 0 || activeHabits.length > 0 || habitStats.length > 0;

  // ── Focus 3 AI generation trigger ─────────────────────────────────
  useEffect(() => {
    const ctx = focus3ContextRef.current;
    const hasData = ctx.dueTodayTasks.length > 0 || ctx.todayAgendaEvents.length > 0 || ctx.habitStats.length > 0;
    if (f3.status !== "loading" || !f3.dataLoaded || f3.aiLoading) return;
    if (!hasData) return;

    const abortController = new AbortController();
    f3d({ type: "AI_START" });

    const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const formatEventTime = (event: CalendarEventContract) => {
      if (!event.start?.dateTime) return "All day";
      const d = new Date(event.start.dateTime);
      if (Number.isNaN(d.getTime())) return "All day";
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    };

    const requestBody = {
      today: ctx.todayKey,
      weekday,
      goals: ctx.userGoals.map((g) => ({ title: g.title, domain: g.domain, description: g.description, season: g.season })),
      tasks: [
        ...ctx.dueTodayTasks.slice(0, 10).map((t) => ({ id: `task-${t.id}`, title: t.title, priority: t.priority, status: t.status ?? "active" })),
        ...ctx.completedTodayTasks.slice(0, 5).map((t) => ({ id: `completed-${t.id}`, title: t.title, priority: t.priority, status: "completed" })),
      ],
      events: ctx.todayAgendaEvents.slice(0, 8).map((e) => ({ id: `event-${e.id}`, title: e.title ?? "Untitled", time: formatEventTime(e) })),
      habits: ctx.habitStats.slice(0, 10).map((s) => ({
        id: `habit-${s.habit.id}`,
        title: s.habit.title,
        activeStreak: s.activeStreak,
        last7Sum: s.sumLast7,
        adherenceLast365: s.adherenceLast365,
        adherenceCurrentYear: s.adherenceCurrentYear,
        period: s.habit.period,
      })),
      identityMetrics: ctx.identityMetricsForAI,
      identityScore: ctx.identityScoreForAI,
      latestReflection: ctx.latestReflection ?? undefined,
      aiTone: ctx.aiTone,
      identityProfile: ctx.identityProfile ? {
        valuesDocument: ctx.identityProfile.valuesDocument ?? undefined,
        currentPhase: (ctx.identityProfile.phaseMetadata as { currentPhase?: string } | null)?.currentPhase ?? undefined,
        coreValues: (ctx.identityProfile.phaseMetadata as { coreValues?: string[] } | null)?.coreValues ?? undefined,
      } : undefined,
      aiAdditionalContext: ctx.aiAdditionalContext,
    };

    fetch("/api/ai/focus3", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: abortController.signal,
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.detail ?? body.error ?? "AI Focus 3 generation failed");
        }
        return res.json();
      })
      .then((data: { items: Array<{ id: string; label: string; type: string }>; reasoning: string }) => {
        if (abortController.signal.aborted) return;
        f3d({ type: "AI_SUCCESS", items: data.items.length ? data.items : [], reasoning: data.reasoning ?? "" });
      })
      .catch((err) => {
        if (abortController.signal.aborted) return;
        f3d({ type: "AI_ERROR", error: err instanceof Error ? err.message : "Failed to generate Focus 3" });
      })
      .finally(() => {
        if (!abortController.signal.aborted) f3d({ type: "AI_DONE" });
      });

    return () => abortController.abort();
    // Only re-run when ready state or data-availability changes; use focus3ContextRef for payload to avoid
    // re-running (and aborting the request) when tasks/events/habits update.
  }, [f3.status, f3.dataLoaded, focus3HasData]);

  const aiBriefingContext = useMemo(() => {
    if (!habitStats.length && !dueTodayTasks.length && !todayAgendaEvents.length) {
      return null;
    }
    const ipForAI = identityProfile ? {
      valuesDocument: identityProfile.valuesDocument ?? undefined,
      busyDayProtocol: typeof identityProfile.busyDayProtocol === "object" && identityProfile.busyDayProtocol !== null ? (identityProfile.busyDayProtocol as { text?: string }).text : undefined,
      recoveryProtocol: typeof identityProfile.recoveryProtocol === "object" && identityProfile.recoveryProtocol !== null ? (identityProfile.recoveryProtocol as { text?: string }).text : undefined,
      currentPhase: (identityProfile.phaseMetadata as { currentPhase?: string } | null)?.currentPhase ?? undefined,
      coreValues: (identityProfile.phaseMetadata as { coreValues?: string[] } | null)?.coreValues ?? undefined,
    } : undefined;

    return buildBriefingContext({
      goals: userGoals,
      dueTodayTasks,
      completedTodayTasks,
      todayAgendaEvents,
      habitStats,
      identityScore: identityScoreForAI,
      focus3Snapshot: f3.status === "submitted" ? f3.items : [],
      morningFlowStatus,
      latestReflection: latestWeeklyReflection ?? undefined,
      aiTone: userPreferences?.aiTone ?? "standard",
      identityProfile: ipForAI,
      customIdentityLabels: userPreferences?.identityQuestions?.map((q) => q.label),
      aiAdditionalContext: userPreferences?.aiAdditionalContext,
    });
  }, [
    userGoals,
    habitStats,
    dueTodayTasks,
    completedTodayTasks,
    todayAgendaEvents,
    identityScoreForAI,
    f3.status,
    f3.items,
    morningFlowStatus,
    latestWeeklyReflection,
    userPreferences?.aiTone,
    identityProfile,
    userPreferences?.identityQuestions,
    userPreferences?.aiAdditionalContext,
  ]);

  const aiBriefing = useAIBriefing(aiBriefingContext, supabase, user?.id ?? null);
  const [morningBriefing, setMorningBriefing] = useState<AIBriefingResponse | null>(null);
  const [insightsBriefing, setInsightsBriefing] = useState<AIBriefingResponse["insights"] | null>(null);
  const [pendingMorningBriefingRefresh, setPendingMorningBriefingRefresh] = useState(false);
  const [pendingInsightsRefresh, setPendingInsightsRefresh] = useState(false);

  useEffect(() => {
    if (!aiBriefing.briefing) return;

    // Initial load: capture briefing for both sections once
    if (
      !morningBriefing &&
      !insightsBriefing &&
      !pendingInsightsRefresh &&
      !pendingMorningBriefingRefresh
    ) {
      setMorningBriefing(aiBriefing.briefing);
      setInsightsBriefing(aiBriefing.briefing.insights);
      return;
    }

    // Explicit Morning Briefing refresh: update only the morning snapshot
    if (pendingMorningBriefingRefresh) {
      setMorningBriefing(aiBriefing.briefing);
      setPendingMorningBriefingRefresh(false);
      return;
    }

    // Insights-only refresh: update only the insights snapshot
    if (pendingInsightsRefresh) {
      setInsightsBriefing(aiBriefing.briefing.insights);
      setPendingInsightsRefresh(false);
    }
  }, [
    aiBriefing.briefing,
    morningBriefing,
    insightsBriefing,
    pendingInsightsRefresh,
    pendingMorningBriefingRefresh,
  ]);

  const handleMorningBriefingRefresh = () => {
    setPendingMorningBriefingRefresh(true);
    aiBriefing.refresh();
  };

  const handleInsightsRefresh = () => {
    setPendingInsightsRefresh(true);
    aiBriefing.refresh();
  };

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
    if (user && supabase) {
      deleteMorningFlow(supabase, user.id, todayKey).catch(() => {});
    }
  };

  const saveFocus3Submit = () => {
    // Resolve custom inputs: if a draft item has id="" (custom), assign a manual id
    const resolvedItems = f3.draft.map((item, index) => {
      if (item.id === "custom" || item.id === "") {
        const customLabel = f3.customInputs[index]?.trim() || item.label.trim() || "Focus anchor";
        return { id: `custom-${index + 1}-${todayKey}`, label: customLabel, type: "Custom" };
      }
      return item;
    }).slice(0, 3);
    while (resolvedItems.length < 3) {
      resolvedItems.push({ id: `custom-${resolvedItems.length + 1}-${todayKey}`, label: "Focus anchor", type: "Identity" });
    }
    f3d({ type: "ACCEPT_DRAFT", items: resolvedItems });
    if (user && supabase) {
      saveFocus3(supabase, user.id, todayKey, resolvedItems, f3.reasoning).catch(() => {});
    }
  };

  const editFocus3 = () => {
    f3d({ type: "EDIT_START", items: f3.items });
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
    if (identityScoreForAI > 0 && identityScoreForAI < 3) {
      items.push({
        id: "identity-minimum",
        title: "Aim for a 3/5 identity check",
        body: "Minimums still count, and 3‑5 is a strong day.",
        why: [`Yesterday you completed ${identityScoreForAI}/5 identity checks.`],
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
    return items.slice(0, 4);
  }, [habitSummary.total, habitSummary.weekCount, identityScoreForAI, morningFlowStatus]);

  const logHabitForDate = useCallback(
    async (habitId: string, dateKey: string, amountOverride?: number) => {
      if (!supabase || !user) return;
      if (dateKey > todayKey) {
        setHabitError("Cannot log for a future date.");
        return;
      }
      const habit = habits.find((item) => item.id === habitId);
      if (!habit) {
        setHabitError("Habit not found.");
        return;
      }
      if (habit.kind === "check") {
        const alreadyLogged = habitSessions.some((session) => {
          if (session.habitId !== habit.id) return false;
          const parsed = new Date(session.createdAt);
          if (Number.isNaN(parsed.getTime())) return false;
          return toDateKey(parsed) === dateKey;
        });
        if (alreadyLogged) {
          setHabitError("This habit is already logged for this day.");
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
      const noonIso = new Date(dateKey + "T12:00:00").toISOString();
      setHabitSaving(true);
      setHabitError(null);
      const inserted = await insertHabitSession(supabase, user.id, {
        habitId: habit.id,
        duration: null,
        amount: habit.kind === "amount" ? amount : 1,
        data: input.note.trim() || null,
        createdAt: noonIso,
        finishedAt: noonIso,
      });
      setHabitSaving(false);
      if (!inserted) {
        setHabitError("Failed to save habit log.");
        return;
      }
      setHabitSessions((prev) => [inserted, ...prev]);
      setHabitLogInputs((prev) => ({
        ...prev,
        [habit.id]: { amount: "", note: "" },
      }));
    },
    [
      supabase,
      user,
      todayKey,
      habits,
      habitSessions,
      habitLogInputs,
    ]
  );

  const removeLatestHabitSessionForDate = useCallback(
    async (habitId: string, dateKey: string) => {
      if (!supabase || !user) return;
      let latestSession: HabitSession | undefined;
      let latestTime = 0;
      for (const session of habitSessions) {
        if (session.habitId !== habitId) continue;
        const parsed = new Date(session.createdAt);
        if (Number.isNaN(parsed.getTime())) continue;
        if (toDateKey(parsed) !== dateKey) continue;
        if (parsed.getTime() >= latestTime) {
          latestTime = parsed.getTime();
          latestSession = session;
        }
      }
      if (!latestSession) {
        setHabitError("No log to undo for this day.");
        return;
      }
      setHabitSaving(true);
      setHabitError(null);
      const ok = await deleteHabitSession(supabase, user.id, latestSession.id);
      setHabitSaving(false);
      if (!ok) {
        setHabitError("Failed to remove habit log.");
        return;
      }
      const removedId = latestSession.id;
      setHabitSessions((prev) => prev.filter((s) => s.id !== removedId));
    },
    [supabase, user, habitSessions]
  );

  const removeHabitSessionById = useCallback(
    async (sessionId: string) => {
      if (!supabase || !user) return;
      setHabitSaving(true);
      setHabitError(null);
      const ok = await deleteHabitSession(supabase, user.id, sessionId);
      setHabitSaving(false);
      if (!ok) {
        setHabitError("Failed to remove habit log.");
        return;
      }
      setHabitSessions((prev) => prev.filter((s) => s.id !== sessionId));
      setEditingSessionId((id) => (id === sessionId ? null : id));
    },
    [supabase, user]
  );

  const saveSessionEdit = useCallback(
    async (sessionId: string) => {
      if (!supabase || !user) return;
      const input = sessionEditInputs[sessionId];
      if (!input) return;
      const session = habitSessions.find((s) => s.id === sessionId);
      const habit = habits.find((h) => h.id === session?.habitId);
      const isAmount = habit?.kind === "amount";
      if (isAmount) {
        const amount = Number.parseFloat(input.amount);
        if (Number.isNaN(amount) || amount < 0) {
          setHabitError("Enter a valid amount.");
          return;
        }
      }
      setHabitSaving(true);
      setHabitError(null);
      const updated = await updateHabitSession(supabase, user.id, sessionId, {
        ...(isAmount ? { amount: Number.parseFloat(input.amount) } : {}),
        data: input.note.trim() || null,
      });
      setHabitSaving(false);
      if (!updated) {
        setHabitError("Failed to update habit log.");
        return;
      }
      setHabitSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updated : s))
      );
      setEditingSessionId(null);
    },
    [supabase, user, sessionEditInputs, habitSessions, habits]
  );

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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-950 via-slate-950 to-indigo-950">
        <p className="text-sm text-zinc-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-slate-950 to-indigo-950 font-sans text-zinc-100">
      <main className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-4 sm:px-6 sm:py-8">
        {activeTab === "practice" && (
          <MorningFlowBanner
            morningFlowStatus={morningFlowStatus}
            setMorningFlowStatus={setMorningFlowStatus}
            morningFlowSteps={morningFlowSteps}
            setMorningFlowSteps={setMorningFlowSteps}
            morningFlowStepCount={morningFlowStepCount}
            morningFlowTotalSteps={morningFlowTotalSteps}
            morningFlowComplete={morningFlowComplete}
            scrollToSection={scrollToSection}
          />
        )}

        <DashboardHeader
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          chatOpen={chatOpen}
          setChatOpen={setChatOpen}
          handleLogout={handleLogout}
          resetMorningFlow={resetMorningFlow}
        />

        {activeTab === "practice" && (
          <>
            <section className="grid gap-4 md:grid-cols-[1.2fr_1fr]">
              <div
                id="morning-briefing"
                className="rounded-2xl border border-indigo-900/50 bg-zinc-900/80 p-5 shadow-sm backdrop-blur"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-lg font-semibold">Morning Briefing</h2>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] uppercase tracking-wide text-zinc-500">AI tone</span>
                      <button
                        type="button"
                        onClick={() => {
                          const next: UserPreferences = { ...(userPreferences ?? {}), aiTone: "standard" };
                          setUserPreferences(next);
                          if (supabase && user) saveUserPreferences(supabase, user.id, next).catch(() => {});
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs ${(userPreferences?.aiTone ?? "standard") === "standard" ? "bg-indigo-500/30 text-indigo-200" : "border border-zinc-600 text-zinc-400 hover:text-zinc-200"}`}
                      >
                        Standard
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const next: UserPreferences = { ...(userPreferences ?? {}), aiTone: "gentle" };
                          setUserPreferences(next);
                          if (supabase && user) saveUserPreferences(supabase, user.id, next).catch(() => {});
                        }}
                        className={`rounded-full px-2.5 py-1 text-xs ${(userPreferences?.aiTone ?? "standard") === "gentle" ? "bg-indigo-500/30 text-indigo-200" : "border border-zinc-600 text-zinc-400 hover:text-zinc-200"}`}
                      >
                        Gentle
                      </button>
                    </div>
                    {morningBriefing && (
                      <button
                        type="button"
                        onClick={handleMorningBriefingRefresh}
                        disabled={pendingMorningBriefingRefresh}
                        className="rounded-full border border-indigo-700/60 px-3 py-1 text-xs text-indigo-200 hover:text-white disabled:opacity-50"
                      >
                        {pendingMorningBriefingRefresh ? "Refreshing..." : "Refresh"}
                      </button>
                    )}
                  </div>
                </div>
                {aiBriefing.loading && !morningBriefing ? (
                  <div className="mt-3 space-y-3 animate-pulse">
                    <div className="h-4 w-3/4 rounded bg-indigo-500/20" />
                    <div className="h-4 w-1/2 rounded bg-indigo-500/20" />
                    <div className="h-10 rounded-xl bg-indigo-500/10" />
                    <div className="h-16 rounded-xl bg-zinc-950/40" />
                  </div>
                ) : (
                  <>
                    <p className="mt-2 text-sm text-zinc-300">
                      {morningBriefing?.headline ?? briefingCopy}
                    </p>
                    <div className="mt-4 rounded-xl bg-indigo-500/10 px-4 py-3 text-sm text-indigo-200">
                      {morningBriefing?.valuesFocus ??
                        "Values focus: presence, grounded confidence, relationship care."}
                    </div>
                    <div className="mt-3 rounded-xl border border-indigo-900/50 bg-zinc-950/40 px-4 py-3 text-xs text-zinc-300">
                      <p className="font-semibold text-indigo-200">Why this briefing</p>
                      <ul className="mt-2 space-y-1">
                        {(
                          morningBriefing?.whyBullets ?? [
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
                      {f3.aiLoading
                        ? "AI is selecting your Focus 3..."
                        : f3.status === "proposing"
                          ? "AI suggested your Focus 3. Review and submit."
                          : "Choose what matters most today, not what is loudest."}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {f3.status === "submitted" && (
                      <button
                        type="button"
                        onClick={editFocus3}
                        className="rounded-full border border-emerald-700/60 px-3 py-1 text-xs text-emerald-200 hover:text-white"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {/* Loading / AI generating state */}
                {(f3.status === "loading" || f3.aiLoading) && (
                  <div className="mt-4 space-y-2">
                    {[0, 1, 2].map((i) => (
                      <div key={`skeleton-${i}`} className="h-10 animate-pulse rounded-lg bg-emerald-500/10 border border-emerald-900/30" />
                    ))}
                  </div>
                )}

                {/* AI error message */}
                {f3.aiError && (
                  <p className="mt-2 text-xs text-amber-400">{f3.aiError} — pick your Focus 3 manually below.</p>
                )}

                {/* Proposing / Editing state — dropdown UI */}
                {(f3.status === "proposing" || f3.status === "editing") && !f3.aiLoading && (
                  <div className="mt-3 space-y-2 text-sm text-zinc-200">
                    {f3.reasoning && f3.status === "proposing" && (
                      <p className="text-xs text-emerald-300/80 italic mb-2">{f3.reasoning}</p>
                    )}
                    {[0, 1, 2].map((index) => {
                      const currentVal = f3.draft[index]?.id ?? "";
                      const isCustom = currentVal === "custom";
                      return (
                        <div
                          key={`focus3-slot-${index}`}
                          className="rounded-lg border border-emerald-900/50 bg-emerald-500/10 px-3 py-2"
                        >
                          <select
                            className="w-full rounded-lg border border-emerald-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                            value={currentVal}
                            onChange={(e) => {
                              const selectedId = e.target.value;
                              if (selectedId === "custom") {
                                const next = [...f3.draft];
                                next[index] = { id: "custom", label: "", type: "Custom" };
                                f3d({ type: "SET_DRAFT", draft: next });
                              } else {
                                const opt = focus3Options.find((o) => o.id === selectedId);
                                if (opt) {
                                  const next = [...f3.draft];
                                  next[index] = { id: opt.id, label: opt.label, type: opt.type };
                                  f3d({ type: "SET_DRAFT", draft: next });
                                }
                              }
                            }}
                          >
                            <option value="">-- Select focus {index + 1} --</option>
                            {(() => {
                              const groups = ["Tasks", "Events", "Habits", "Identity"];
                              return groups.map((group) => {
                                const groupItems = focus3Options.filter((o) => o.group === group);
                                if (!groupItems.length) return null;
                                return (
                                  <optgroup key={group} label={group}>
                                    {groupItems.map((o) => (
                                      <option key={o.id} value={o.id}>{o.label}</option>
                                    ))}
                                  </optgroup>
                                );
                              });
                            })()}
                            <option value="custom">Custom...</option>
                          </select>
                          {isCustom && (
                            <input
                              className="mt-2 w-full rounded-lg border border-emerald-900/50 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-100"
                              placeholder="Type your focus item..."
                              value={f3.customInputs[index] ?? ""}
                              onChange={(e) =>
                                f3d({ type: "SET_CUSTOM_INPUT", index, value: e.target.value })
                              }
                            />
                          )}
                        </div>
                      );
                    })}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={saveFocus3Submit}
                        className="rounded-full bg-emerald-500 px-4 py-2 text-xs font-medium text-white hover:bg-emerald-400"
                      >
                        {f3.status === "editing" ? "Save changes" : "Submit Focus 3"}
                      </button>
                      {f3.status === "editing" && (
                        <button
                          type="button"
                          onClick={() => f3d({ type: "CANCEL_EDIT" })}
                          className="rounded-full border border-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:text-white"
                        >
                          Cancel
                        </button>
                      )}
                      {f3.status === "proposing" && (
                        <button
                          type="button"
                          onClick={() => f3d({ type: "CLEAR_MANUAL" })}
                          className="text-xs text-zinc-400 hover:text-zinc-200 underline"
                        >
                          Start from scratch
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Submitted state — locked items */}
                {f3.status === "submitted" && (
                  <>
                    <ul className="mt-3 space-y-2 text-sm text-zinc-200">
                      {f3.items.map((item) => (
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
                    {f3.reasoning && (
                      <p className="mt-2 text-xs text-zinc-400 italic">{f3.reasoning}</p>
                    )}
                  </>
                )}
              </div>
            </section>

          <InsightsSection
            aiBriefingInsights={insightsBriefing ?? aiBriefing.briefing?.insights}
            practiceInsights={practiceInsights}
            onRefreshInsights={handleInsightsRefresh}
            insightsLoading={pendingInsightsRefresh}
          />

            <IdentityCheck
              identityViewDateKey={identityViewDateKey}
              setIdentityViewDateKey={setIdentityViewDateKey}
              identityViewActive={identityViewActive}
              identityViewScore={identityViewScore}
              isIdentityViewToday={isIdentityViewToday}
              identityViewLoading={identityViewLoading}
              todayKey={todayKey}
              toggleIdentityMetric={toggleIdentityMetric}
              customQuestions={userPreferences?.identityQuestions}
            />

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
              <div className="mt-4 flex flex-wrap items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-2">
                <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Viewing
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(habitViewDateKey + "T12:00:00");
                      d.setDate(d.getDate() - 1);
                      setHabitViewDateKey(
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                      );
                      setHabitError(null);
                    }}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-zinc-600 bg-zinc-800/80 text-xs text-zinc-200 hover:bg-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    aria-label="Previous day"
                  >
                    ←
                  </button>
                  <span className="min-w-[8rem] text-center text-sm text-zinc-200">
                    {habitViewDateKey === todayKey
                      ? "Today"
                      : new Date(habitViewDateKey + "T12:00:00").toLocaleDateString(
                          [],
                          {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          }
                        )}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(habitViewDateKey + "T12:00:00");
                      d.setDate(d.getDate() + 1);
                      setHabitViewDateKey(
                        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
                      );
                      setHabitError(null);
                    }}
                    disabled={habitViewDateKey >= todayKey}
                    className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-zinc-600 bg-zinc-800/80 text-xs text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:hover:bg-zinc-800/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                    aria-label="Next day"
                  >
                    →
                  </button>
                </div>
                {habitViewDateKey !== todayKey && (
                  <button
                    type="button"
                    onClick={() => {
                      setHabitViewDateKey(todayKey);
                      setHabitError(null);
                    }}
                    className="rounded bg-amber-500/20 px-2 py-1 text-xs font-medium text-amber-200 hover:bg-amber-500/30"
                  >
                    Today
                  </button>
                )}
              </div>
              <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-950/40 px-3 py-3 text-xs text-zinc-200">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                    Overall habit momentum
                  </p>
                  <span className="text-[11px] text-zinc-400">
                    {habitViewDateKey === todayKey
                      ? `Today ${habitSummaryForViewDate.viewDateCount}/${habitSummary.total}`
                      : `${new Date(habitViewDateKey + "T12:00:00").toLocaleDateString([], { month: "short", day: "numeric" })} ${habitSummaryForViewDate.viewDateCount}/${habitSummary.total}`}
                  </span>
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-zinc-900/70">
                  <div
                    className="h-full rounded-full bg-emerald-400/70"
                    style={{
                      width: habitSummary.total
                        ? `${Math.round(
                            (habitSummaryForViewDate.viewDateCount / habitSummary.total) * 100
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
              {/* Weekly reflection — habit review loop (Sundays, or reminder if previous week not filled) */}
              {showWeeklyReflectionSection && (
              <div className="mt-6 rounded-xl border border-zinc-700/50 bg-zinc-950/40 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  Weekly reflection
                </p>
                {isSunday ? (
                  <p className="mt-1 text-xs text-zinc-500">
                    Take a few minutes to reflect on the week that just ended (Sunday evening).
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-amber-200/90">
                    You didn’t fill out last week’s reflection. Complete it below for the week of {previousWeekRangeLabel}.
                  </p>
                )}
                {previousWeekHabitSummary.total > 0 && (
                  <p className="mt-3 text-sm text-zinc-200">
                    Last week: {previousWeekHabitSummary.weekCount} of {previousWeekHabitSummary.total} practices touched.
                  </p>
                )}
                {weeklyReflection && weeklyReflection.weekStartDate === previousWeekKey && (
                  <div className="mt-4 space-y-4">
                    {weeklyReflectionFromDb && !weeklyReflectionEditMode ? (
                      <>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/50 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                            <span aria-hidden>✓</span> Submitted
                          </span>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-zinc-400">What went well?</p>
                          <p className="mt-1 text-sm text-zinc-200 whitespace-pre-wrap">{weeklyReflection.whatWentWell || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-zinc-400">What mattered?</p>
                          <p className="mt-1 text-sm text-zinc-200 whitespace-pre-wrap">{weeklyReflection.whatMattered || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-zinc-400">Learnings?</p>
                          <p className="mt-1 text-sm text-zinc-200 whitespace-pre-wrap">{weeklyReflection.learnings || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[11px] font-medium text-zinc-400">Am I more capable than I was 7 days ago?</p>
                          <p className="mt-1 text-sm text-zinc-200">
                            {weeklyReflection.capabilityGrowth === true ? "Yes" : weeklyReflection.capabilityGrowth === false ? "No" : "—"}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setWeeklyReflectionEditMode(true)}
                          className="rounded-full border border-zinc-600 bg-transparent px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800/80"
                        >
                          Edit submission
                        </button>
                      </>
                    ) : (
                      <>
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400">
                            What went well?
                          </label>
                          <textarea
                            value={weeklyReflection.whatWentWell}
                            onChange={(e) =>
                              setWeeklyReflection((prev) =>
                                prev ? { ...prev, whatWentWell: e.target.value } : null
                              )
                            }
                            rows={2}
                            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-amber-600/50 focus:outline-none focus:ring-1 focus:ring-amber-600/50"
                            placeholder="What showed up for you?"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400">
                            What mattered?
                          </label>
                          <textarea
                            value={weeklyReflection.whatMattered}
                            onChange={(e) =>
                              setWeeklyReflection((prev) =>
                                prev ? { ...prev, whatMattered: e.target.value } : null
                              )
                            }
                            rows={2}
                            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-amber-600/50 focus:outline-none focus:ring-1 focus:ring-amber-600/50"
                            placeholder="What felt meaningful?"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400">
                            Learnings?
                          </label>
                          <textarea
                            value={weeklyReflection.learnings}
                            onChange={(e) =>
                              setWeeklyReflection((prev) =>
                                prev ? { ...prev, learnings: e.target.value } : null
                              )
                            }
                            rows={2}
                            className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-amber-600/50 focus:outline-none focus:ring-1 focus:ring-amber-600/50"
                            placeholder="What did you learn or notice?"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-zinc-400">
                            Am I more capable than I was 7 days ago?
                          </label>
                          <div className="mt-2 flex flex-wrap items-center gap-3">
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                              <input
                                type="radio"
                                name="capability_growth"
                                checked={weeklyReflection.capabilityGrowth === true}
                                onChange={() =>
                                  setWeeklyReflection((prev) =>
                                    prev ? { ...prev, capabilityGrowth: true } : null
                                  )
                                }
                                className="rounded-full border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
                              />
                              Yes
                            </label>
                            <label className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                              <input
                                type="radio"
                                name="capability_growth"
                                checked={weeklyReflection.capabilityGrowth === false}
                                onChange={() =>
                                  setWeeklyReflection((prev) =>
                                    prev ? { ...prev, capabilityGrowth: false } : null
                                  )
                                }
                                className="rounded-full border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
                              />
                              No
                            </label>
                            {weeklyReflectionSaving && (
                              <span className="text-[11px] text-zinc-500">Saving…</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={weeklyReflectionSaving}
                          onClick={async () => {
                            if (!supabase || !user || !weeklyReflection) return;
                            setWeeklyReflectionSaving(true);
                            try {
                              await upsertWeeklyReflection(supabase, user.id, weeklyReflection.weekStartDate, {
                                whatWentWell: weeklyReflection.whatWentWell,
                                whatMattered: weeklyReflection.whatMattered,
                                learnings: weeklyReflection.learnings,
                                capabilityGrowth: weeklyReflection.capabilityGrowth,
                              });
                              setWeeklyReflectionFromDb(true);
                              setWeeklyReflectionEditMode(false);
                            } finally {
                              setWeeklyReflectionSaving(false);
                            }
                          }}
                          className="rounded-full bg-amber-600 px-4 py-2 text-xs font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                        >
                          {weeklyReflectionSaving ? "Saving…" : "Save"}
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
              )}
              {periodEndDateForFourWeek && (
              <div className="mt-6 rounded-xl border border-violet-900/50 bg-zinc-950/40 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                  4-Week review
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  Every 4 Sundays: reflect on the past four weeks and align with goals.
                </p>
                {previousFourWeekNotes && (
                  <div className="mt-3 rounded-lg border border-violet-800/40 bg-zinc-900/40 px-3 py-2">
                    <p className="text-[11px] font-medium text-zinc-400">Last period you noted</p>
                    <p className="mt-1 text-xs text-zinc-300">
                      {previousFourWeekNotes.length > 200 ? previousFourWeekNotes.slice(0, 200) + "…" : previousFourWeekNotes}
                    </p>
                  </div>
                )}
                {fourWeekReflections.length > 0 && (
                  <div className="mt-4 space-y-3">
                    <p className="text-[11px] font-medium text-zinc-400">What mattered & learnings (last 4 weeks)</p>
                    {fourWeekReflections.map((r) => {
                      const start = new Date(r.weekStartDate + "T12:00:00");
                      const end = new Date(start);
                      end.setDate(end.getDate() + 6);
                      const label = start.toLocaleDateString([], { month: "short", day: "numeric" }) + " – " + end.toLocaleDateString([], { month: "short", day: "numeric" });
                      return (
                        <div key={r.weekStartDate} className="rounded-lg border border-zinc-800 bg-zinc-900/40 px-3 py-2 text-xs text-zinc-200">
                          <p className="text-[11px] font-medium text-violet-300/90">{label}</p>
                          {(r.whatMattered || r.learnings) ? (
                            <>
                              {r.whatMattered && <p className="mt-1 whitespace-pre-wrap">What mattered: {r.whatMattered}</p>}
                              {r.learnings && <p className="mt-1 whitespace-pre-wrap">Learnings: {r.learnings}</p>}
                            </>
                          ) : (
                            <p className="mt-1 text-zinc-500">No reflection for this week.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {fourWeekReviewExists && !fourWeekReviewEditMode ? (
                  <div className="mt-4 space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-900/50 px-2.5 py-1 text-[11px] font-medium text-emerald-200">
                        <span aria-hidden>✓</span> Submitted
                      </span>
                      {fourWeekReviewSavedAt && (
                        <span className="text-[11px] text-zinc-500">
                          Saved {new Date(fourWeekReviewSavedAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-[11px] font-medium text-zinc-400">Goals this period supported</p>
                      <p className="mt-1 text-sm text-zinc-200">
                        {fourWeekReviewGoalIds.length > 0
                          ? fourWeekReviewGoalIds.map((id) => userGoals.find((g) => g.id === id)?.title).filter(Boolean).join(", ") || "—"
                          : "None"}
                      </p>
                    </div>
                    {fourWeekReviewNotes && (
                      <div>
                        <p className="text-[11px] font-medium text-zinc-400">Anything to adjust</p>
                        <p className="mt-1 text-sm text-zinc-200 whitespace-pre-wrap">{fourWeekReviewNotes}</p>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => setFourWeekReviewEditMode(true)}
                      className="rounded-full border border-zinc-600 bg-transparent px-4 py-2 text-xs font-medium text-zinc-300 hover:bg-zinc-800/80"
                    >
                      Edit submission
                    </button>
                  </div>
                ) : (
                  <div className="mt-4 space-y-4">
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400">
                        Which goals did this 4-week period support? (select all that apply)
                      </label>
                      <div className="mt-2 flex flex-col gap-2">
                        {userGoals.filter((g) => g.active).map((g) => (
                          <label key={g.id} className="flex cursor-pointer items-center gap-2 text-sm text-zinc-200">
                            <input
                              type="checkbox"
                              checked={fourWeekReviewGoalIds.includes(g.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setFourWeekReviewGoalIds((prev) => [...prev, g.id]);
                                } else {
                                  setFourWeekReviewGoalIds((prev) => prev.filter((id) => id !== g.id));
                                }
                              }}
                              className="rounded border-zinc-600 bg-zinc-800 text-violet-500 focus:ring-violet-500/50"
                            />
                            {g.title}
                          </label>
                        ))}
                        {userGoals.filter((g) => g.active).length === 0 && (
                          <p className="text-xs text-zinc-500">No active goals.</p>
                        )}
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-zinc-400">
                        Anything to adjust in your systems? (optional)
                      </label>
                      <textarea
                        value={fourWeekReviewNotes}
                        onChange={(e) => setFourWeekReviewNotes(e.target.value)}
                        rows={2}
                        placeholder="What's working? What needs a tweak?"
                        className="mt-1 w-full rounded-md border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-500 focus:border-violet-600/50 focus:outline-none focus:ring-1 focus:ring-violet-600/50"
                      />
                    </div>
                    {fourWeekReviewSaveError && (
                      <p className="text-xs text-red-400">{fourWeekReviewSaveError}</p>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!supabase || !user || !periodEndDateForFourWeek) return;
                        setFourWeekReviewSaving(true);
                        setFourWeekReviewSaveError(null);
                        try {
                          await upsertFourWeekReview(supabase, user.id, periodEndDateForFourWeek, {
                            goalIds: fourWeekReviewGoalIds,
                            systemAdjustmentNotes: fourWeekReviewNotes.trim() || null,
                          });
                          setFourWeekReviewExists(true);
                          setFourWeekReviewEditMode(false);
                          setFourWeekReviewSavedAt(new Date().toISOString());
                          const review = await loadFourWeekReview(supabase, user.id, periodEndDateForFourWeek);
                          if (review?.updatedAt) setFourWeekReviewSavedAt(review.updatedAt);
                        } catch (err) {
                          const raw =
                            (err && typeof err === "object" && "message" in err
                              ? (err as { message: string }).message
                              : err instanceof Error
                                ? err.message
                                : null) ?? "Failed to save";
                          const hint =
                            /goal_ids|column.*does not exist/i.test(raw)
                              ? " Run the Supabase migration 006_four_week_reviews_goal_ids.sql and try again."
                              : "";
                          setFourWeekReviewSaveError(raw + hint);
                        } finally {
                          setFourWeekReviewSaving(false);
                        }
                      }}
                      disabled={fourWeekReviewSaving}
                      className="rounded-full bg-violet-600 px-4 py-2 text-xs font-medium text-white hover:bg-violet-500 disabled:opacity-50"
                    >
                      {fourWeekReviewSaving ? "Saving…" : "Save 4-week review"}
                    </button>
                  </div>
                )}
              </div>
              )}
              <div className="mt-4 grid gap-3 md:grid-cols-2">
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
                    const targetForDay = habit.kind === "amount" ? (habit.count || 1) : 1;
                    const targetForWeek = habit.count || 1;
                    const viewDateWeekKey = getWeekStartKey(
                      new Date(habitViewDateKey + "T12:00:00")
                    );
                    const viewDateGoalMet = isDaily
                      ? (totalsByDay.get(habitViewDateKey) ?? 0) >= targetForDay
                      : (totalsByWeek.get(viewDateWeekKey) ?? 0) >= targetForWeek;
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
                            <div className="flex items-start gap-2 min-w-0">
                              {viewDateGoalMet && (
                                <span
                                  className="mt-0.5 shrink-0 rounded-full bg-emerald-500/20 text-emerald-400"
                                  role="img"
                                  aria-label={
                                    isDaily
                                      ? "Goal met for this day"
                                      : "Goal met for this week"
                                  }
                                  title={
                                    isDaily
                                      ? "Goal met for this day"
                                      : "Goal met for this week"
                                  }
                                >
                                  <svg
                                    className="h-5 w-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </span>
                              )}
                              <div className="min-w-0">
                                <p className="font-medium">{habit.title}</p>
                                <p className="text-xs text-amber-100/80">
                                  Goal: {habit.count} · {habit.period}
                                </p>
                              </div>
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
                              {habitViewDateKey === todayKey ? "Log today" : "Log for this day"}
                            </p>
                            <button
                              type="button"
                              onClick={() => logHabitForDate(habit.id, habitViewDateKey)}
                              disabled={habitSaving || habitViewDateKey > todayKey}
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
                                    className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:text-white disabled:opacity-50"
                                    onClick={() => removeLatestHabitSessionForDate(habit.id, habitViewDateKey)}
                                    disabled={habitSaving}
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
                                    className="rounded-full border border-zinc-700 px-2 py-1 text-xs text-zinc-200 hover:text-white disabled:opacity-50"
                                    onClick={() => logHabitForDate(habit.id, habitViewDateKey, 1)}
                                    disabled={habitSaving || habitViewDateKey > todayKey}
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
                                className="rounded-lg border border-zinc-800 bg-zinc-950/40 px-3 py-2 text-xs text-zinc-200 hover:text-white disabled:opacity-50"
                                disabled={habitSaving || habitViewDateKey > todayKey}
                                onClick={() =>
                                  habitSessions.some((session) => {
                                    if (session.habitId !== habit.id) return false;
                                    const parsed = new Date(session.createdAt);
                                    if (Number.isNaN(parsed.getTime())) return false;
                                    return toDateKey(parsed) === habitViewDateKey;
                                  })
                                    ? removeLatestHabitSessionForDate(habit.id, habitViewDateKey)
                                    : logHabitForDate(habit.id, habitViewDateKey)
                                }
                              >
                                {habitSessions.some((session) => {
                                  if (session.habitId !== habit.id) return false;
                                  const parsed = new Date(session.createdAt);
                                  if (Number.isNaN(parsed.getTime())) return false;
                                  return toDateKey(parsed) === habitViewDateKey;
                                })
                                  ? habitViewDateKey === todayKey
                                    ? "Undo check"
                                    : "Undo for this day"
                                  : habitViewDateKey === todayKey
                                    ? "Check habit (one tap)"
                                    : "Log for this day"}
                              </button>
                            )}
                          </div>
                          {(() => {
                            const sessionsOnViewDate = habitSessions
                              .filter(
                                (s) =>
                                  s.habitId === habit.id &&
                                  toDateKey(new Date(s.createdAt)) === habitViewDateKey
                              )
                              .sort(
                                (a, b) =>
                                  new Date(b.createdAt).getTime() -
                                  new Date(a.createdAt).getTime()
                              );
                            if (sessionsOnViewDate.length === 0) return null;
                            return (
                              <div className="mt-3 border-t border-zinc-800 pt-3">
                                <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                                  On this day
                                </p>
                                <ul className="mt-2 space-y-1.5">
                                  {sessionsOnViewDate.map((session) => {
                                    const isEditing = editingSessionId === session.id;
                                    const inputs = sessionEditInputs[session.id] ?? {
                                      amount: String(session.amount ?? ""),
                                      note: session.data ?? "",
                                    };
                                    return (
                                      <li
                                        key={session.id}
                                        className="flex flex-wrap items-center gap-2 rounded border border-zinc-800 bg-zinc-900/40 px-2 py-1.5 text-xs"
                                      >
                                        {isEditing ? (
                                          <>
                                            {habit.kind === "amount" && (
                                              <input
                                                type="number"
                                                min={0}
                                                step={0.1}
                                                className="w-16 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
                                                value={inputs.amount}
                                                onChange={(e) =>
                                                  setSessionEditInputs((prev) => ({
                                                    ...prev,
                                                    [session.id]: {
                                                      ...prev[session.id],
                                                      amount: e.target.value,
                                                      note: prev[session.id]?.note ?? "",
                                                    },
                                                  }))
                                                }
                                              />
                                            )}
                                            <input
                                              className="min-w-0 flex-1 rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-zinc-100"
                                              placeholder="Note"
                                              value={inputs.note}
                                              onChange={(e) =>
                                                setSessionEditInputs((prev) => ({
                                                  ...prev,
                                                  [session.id]: {
                                                    ...prev[session.id],
                                                    amount: prev[session.id]?.amount ?? "",
                                                    note: e.target.value,
                                                  },
                                                }))
                                              }
                                            />
                                            <button
                                              type="button"
                                              className="rounded bg-amber-500/80 px-2 py-1 text-[11px] font-medium text-white hover:bg-amber-500 disabled:opacity-50"
                                              onClick={() => saveSessionEdit(session.id)}
                                              disabled={habitSaving}
                                            >
                                              Save
                                            </button>
                                            <button
                                              type="button"
                                              className="rounded border border-zinc-600 px-2 py-1 text-[11px] text-zinc-300 hover:bg-zinc-800"
                                              onClick={() => {
                                                setEditingSessionId(null);
                                              }}
                                            >
                                              Cancel
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <span className="text-zinc-200">
                                              {habit.kind === "amount"
                                                ? `${session.amount ?? 0}${session.data ? ` · ${session.data}` : ""}`
                                                : session.data || "Check"}
                                            </span>
                                            <button
                                              type="button"
                                              className="text-[11px] text-amber-200 hover:text-amber-100"
                                              onClick={() => {
                                                setEditingSessionId(session.id);
                                                setSessionEditInputs((prev) => ({
                                                  ...prev,
                                                  [session.id]: {
                                                    amount: String(session.amount ?? ""),
                                                    note: session.data ?? "",
                                                  },
                                                }));
                                              }}
                                            >
                                              Edit
                                            </button>
                                            <button
                                              type="button"
                                              className="text-[11px] text-rose-300 hover:text-rose-200"
                                              onClick={() => removeHabitSessionById(session.id)}
                                              disabled={habitSaving}
                                            >
                                              Remove
                                            </button>
                                          </>
                                        )}
                                      </li>
                                    );
                                  })}
                                </ul>
                              </div>
                            );
                          })()}
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
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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
                              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
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
              <CalendarMonthView
                monthDays={monthDays}
                monthLabel={monthLabel}
                todayKey={todayKey}
                eventsByDate={eventsByDate}
                googleCalendars={googleCalendars}
                selectedCalendarIds={selectedCalendarIds}
                setSelectedCalendarIds={setSelectedCalendarIds}
              />
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
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
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

            <ConnectionsPanel
              connectTodoist={connectTodoist}
              connectGoogle={connectGoogle}
              loadTodoist={loadTodoist}
              loadCalendar={loadCalendar}
              todoistLoading={todoistLoading}
              calendarLoading={calendarLoading}
              todoistError={todoistError}
              calendarError={calendarError}
              todoistCreateLoading={todoistCreateLoading}
              calendarCreateLoading={calendarCreateLoading}
              todoistTasks={todoistTasks}
              calendarEvents={calendarEvents}
              todoistProjects={todoistProjects}
              googleCalendars={googleCalendars}
              selectedCalendarIds={selectedCalendarIds}
              setSelectedCalendarIds={setSelectedCalendarIds}
              editingTaskId={editingTaskId}
              taskEditForm={taskEditForm}
              setTaskEditForm={setTaskEditForm}
              updateTodoistTask={updateTodoistTask}
              saveTodoistTaskEdits={saveTodoistTaskEdits}
              cancelTodoistTaskEdits={cancelTodoistTaskEdits}
              completeTodoistTask={completeTodoistTask}
              deleteTodoistTask={deleteTodoistTask}
              createTodoistTask={createTodoistTask}
              newTaskContent={newTaskContent}
              setNewTaskContent={setNewTaskContent}
              newTaskDescription={newTaskDescription}
              setNewTaskDescription={setNewTaskDescription}
              newTaskDueString={newTaskDueString}
              setNewTaskDueString={setNewTaskDueString}
              newTaskPriority={newTaskPriority}
              setNewTaskPriority={setNewTaskPriority}
              newTaskLabels={newTaskLabels}
              setNewTaskLabels={setNewTaskLabels}
              newTaskProjectId={newTaskProjectId}
              setNewTaskProjectId={setNewTaskProjectId}
              newTaskSectionId={newTaskSectionId}
              setNewTaskSectionId={setNewTaskSectionId}
              newTaskParentId={newTaskParentId}
              setNewTaskParentId={setNewTaskParentId}
              editingEventId={editingEventId}
              eventEditForm={eventEditForm}
              setEventEditForm={setEventEditForm}
              updateCalendarEvent={updateCalendarEvent}
              saveCalendarEventEdits={saveCalendarEventEdits}
              cancelCalendarEventEdits={cancelCalendarEventEdits}
              deleteCalendarEvent={deleteCalendarEvent}
              createCalendarEvent={createCalendarEvent}
              newEventTitle={newEventTitle}
              setNewEventTitle={setNewEventTitle}
              newEventStart={newEventStart}
              setNewEventStart={setNewEventStart}
              newEventEnd={newEventEnd}
              setNewEventEnd={setNewEventEnd}
              newEventLocation={newEventLocation}
              setNewEventLocation={setNewEventLocation}
              newEventColor={newEventColor}
              setNewEventColor={setNewEventColor}
            />
          </>
        )}
      </main>
      {supabase && user && (
        <ChatPanel
          isOpen={chatOpen}
          onClose={() => setChatOpen(false)}
          supabase={supabase}
          userId={user.id}
          todayKey={todayKey}
          goals={userGoals}
          tasks={todoistTasks}
          completedTasks={completedTodayTasks}
          events={calendarEvents}
          habits={habits}
          habitSessions={habitSessions}
          identityMetrics={identityMetrics}
          yesterdayIdentityMetrics={yesterdayIdentityMetrics}
          focus3={f3.items}
          morningFlowStatus={morningFlowStatus}
          latestReflection={latestWeeklyReflection}
          aiTone={userPreferences?.aiTone}
          identityProfile={identityProfile ? {
            valuesDocument: identityProfile.valuesDocument ?? undefined,
            currentPhase: (identityProfile.phaseMetadata as { currentPhase?: string } | null)?.currentPhase ?? undefined,
            coreValues: (identityProfile.phaseMetadata as { coreValues?: string[] } | null)?.coreValues ?? undefined,
          } : undefined}
          aiAdditionalContext={userPreferences?.aiAdditionalContext}
          onTasksChanged={() => loadTodoist(true)}
          onEventsChanged={() => loadCalendar(true)}
          onHabitSessionAdded={(session) => setHabitSessions((prev) => [session, ...prev])}
        />
      )}
    </div>
  );
}
