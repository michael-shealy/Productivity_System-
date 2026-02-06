import type { TaskContract, CalendarEventContract } from "@/lib/contracts";
import type { Goal } from "@/lib/goals";

// ── Types ──────────────────────────────────────────────────────────────

export type AIBriefingRequest = {
  today: string;
  goals: Array<{ id: string; title: string; domain: string; season: string }>;
  tasks: Array<{ title: string; due?: string; priority: number; status: string }>;
  completedTasks: Array<{ title: string }>;
  events: Array<{ title: string; time: string }>;
  habitStats: Array<{
    title: string;
    activeStreak: number;
    adherencePercent: number;
    last7Sum: number;
  }>;
  identityScore: number;
  focusThemes: string[];
  focus3: Array<{ label: string; type: string }>;
  morningFlowStatus: string;
};

export type AIInsightCard = {
  id: string;
  title: string;
  body: string;
  why: string[];
};

export type AIBriefingResponse = {
  headline: string;
  valuesFocus: string;
  whyBullets: string[];
  insights: AIInsightCard[];
};

export type AIBriefingCache = {
  date: string;
  timestamp: number;
  data: AIBriefingResponse;
};

// ── Context Builder ────────────────────────────────────────────────────

export function buildBriefingContext(opts: {
  goals: Goal[];
  dueTodayTasks: TaskContract[];
  completedTodayTasks: TaskContract[];
  todayAgendaEvents: CalendarEventContract[];
  habitStats: Array<{
    habit: { title: string };
    activeStreak: number;
    adherencePercent: number;
    sumLast7: number;
  }>;
  identityScore: number;
  focusThemes: string[];
  focus3Snapshot: Array<{ label: string; type: string }>;
  morningFlowStatus: string;
}): AIBriefingRequest {
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;

  const formatEventTime = (event: CalendarEventContract) => {
    if (!event.start?.dateTime) return "All day";
    const d = new Date(event.start.dateTime);
    if (Number.isNaN(d.getTime())) return "All day";
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return {
    today: todayStr,
    goals: opts.goals.map((g) => ({
      id: g.id,
      title: g.title,
      domain: g.domain,
      season: g.season,
    })),
    tasks: opts.dueTodayTasks.slice(0, 10).map((t) => ({
      title: t.title,
      due: t.due?.dateTime ?? t.due?.date,
      priority: t.priority,
      status: t.status,
    })),
    completedTasks: opts.completedTodayTasks.slice(0, 10).map((t) => ({
      title: t.title,
    })),
    events: opts.todayAgendaEvents.slice(0, 8).map((e) => ({
      title: e.title,
      time: formatEventTime(e),
    })),
    habitStats: opts.habitStats
      .slice()
      .sort((a, b) => b.activeStreak - a.activeStreak)
      .slice(0, 3)
      .map((s) => ({
        title: s.habit.title,
        activeStreak: s.activeStreak,
        adherencePercent: s.adherencePercent,
        last7Sum: s.sumLast7,
      })),
    identityScore: opts.identityScore,
    focusThemes: opts.focusThemes,
    focus3: opts.focus3Snapshot.map((f) => ({
      label: f.label,
      type: f.type,
    })),
    morningFlowStatus: opts.morningFlowStatus,
  };
}

// ── Cache Helpers ──────────────────────────────────────────────────────

const CACHE_KEY = "ai_briefing_cache";
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours

export function getCachedBriefing(todayKey: string): AIBriefingResponse | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const cached: AIBriefingCache = JSON.parse(raw);
    if (cached.date !== todayKey) return null;
    if (Date.now() - cached.timestamp > CACHE_TTL_MS) return null;
    return cached.data;
  } catch {
    return null;
  }
}

export function setCachedBriefing(todayKey: string, data: AIBriefingResponse) {
  try {
    const entry: AIBriefingCache = {
      date: todayKey,
      timestamp: Date.now(),
      data,
    };
    localStorage.setItem(CACHE_KEY, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — silently ignore
  }
}

export function clearBriefingCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    // ignore
  }
}
