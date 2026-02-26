import type { TaskContract, CalendarEventContract } from "@/lib/contracts";
import type { Goal } from "@/lib/goals";
import type { WeatherData } from "@/lib/weather";

// ── Types ──────────────────────────────────────────────────────────────

export type LatestReflectionForAI = {
  weekStartDate: string;
  whatWentWell: string;
  whatMattered: string;
  learnings: string;
  capabilityGrowth: boolean | null;
};

export type IdentityProfileForAI = {
  valuesDocument?: string;
  busyDayProtocol?: string;
  recoveryProtocol?: string;
  currentPhase?: string;
  coreValues?: string[];
};

export type AIBriefingRequest = {
  today: string;
  goals: Array<{ id: string; title: string; domain: string; season: string }>;
  tasks: Array<{ title: string; due?: string; priority: number; status: string }>;
  completedTasks: Array<{ title: string }>;
  events: Array<{ title: string; time: string }>;
  habitStats: Array<{
    title: string;
    activeStreak: number;
    last7Sum: number;
    adherenceLast365: number;
    adherenceCurrentYear: number;
  }>;
  identityScore: number;
  focus3: Array<{ label: string; type: string }>;
  morningFlowStatus: string;
  latestReflection?: LatestReflectionForAI;
  aiTone?: "standard" | "gentle";
  identityProfile?: IdentityProfileForAI;
  customIdentityLabels?: string[];
  aiAdditionalContext?: string;
  weather?: WeatherData | null;
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

// ── Focus 3 AI Types ──────────────────────────────────────────────────

export type Focus3AIRequest = {
  today: string;
  weekday: string;
  goals: Array<{ title: string; domain: string; description: string; season: string }>;
  tasks: Array<{ id: string; title: string; priority: number; status: string }>;
  events: Array<{ id: string; title: string; time: string }>;
  habits: Array<{
    id: string;
    title: string;
    activeStreak: number;
    last7Sum: number;
    adherenceLast365: number;
    adherenceCurrentYear: number;
    period: string;
  }>;
  identityMetrics: { morningGrounding: boolean; embodiedMovement: boolean; nutritionalAwareness: boolean; presentConnection: boolean; curiositySpark: boolean };
  identityScore: number;
  latestReflection?: LatestReflectionForAI;
  aiTone?: "standard" | "gentle";
  identityProfile?: IdentityProfileForAI;
  aiAdditionalContext?: string;
  aiObservations?: Array<{ category: string; observation: string }>;
  weather?: WeatherData | null;
};

export type Focus3AIResponse = {
  items: Array<{ id: string; label: string; type: string }>;
  reasoning: string;
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
    sumLast7: number;
    adherenceLast365: number;
    adherenceCurrentYear: number;
  }>;
  identityScore: number;
  focus3Snapshot: Array<{ label: string; type: string }>;
  morningFlowStatus: string;
  latestReflection?: LatestReflectionForAI;
  aiTone?: "standard" | "gentle";
  identityProfile?: IdentityProfileForAI;
  customIdentityLabels?: string[];
  aiAdditionalContext?: string;
  weather?: WeatherData | null;
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
        last7Sum: s.sumLast7,
        adherenceLast365: s.adherenceLast365,
        adherenceCurrentYear: s.adherenceCurrentYear,
      })),
    identityScore: opts.identityScore,
    focus3: opts.focus3Snapshot.map((f) => ({
      label: f.label,
      type: f.type,
    })),
    morningFlowStatus: opts.morningFlowStatus,
    latestReflection: opts.latestReflection,
    aiTone: opts.aiTone,
    identityProfile: opts.identityProfile,
    customIdentityLabels: opts.customIdentityLabels,
    aiAdditionalContext: opts.aiAdditionalContext,
    weather: opts.weather,
  };
}

