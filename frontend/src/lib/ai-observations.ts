import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { AIObservation, AnalysisDepth, EntityRef, ObservationCategory, ObservationScope } from "@/lib/supabase/types";
import {
  loadActiveObservations,
  loadObservationsForDate,
  loadIdentityMetricsRange,
  loadRecentWeeklyReflections,
  loadRecentDismissedObservations,
  insertObservations,
  supersedeObservations,
  pruneObservations,
  getLastAnalysisDate,
  type InsertObservationPayload,
} from "@/lib/supabase/data";

// ── Types ──────────────────────────────────────────────────────────────

type HabitStatForAnalysis = {
  title: string;
  activeStreak: number;
  last7Sum: number;
  adherenceLast365: number;
  adherenceCurrentYear: number;
};

type IdentityMetricRow = {
  date: string;
  morningGrounding: boolean;
  embodiedMovement: boolean;
  nutritionalAwareness: boolean;
  presentConnection: boolean;
  curiositySpark: boolean;
};

type ReflectionForAnalysis = {
  weekStartDate: string;
  whatWentWell: string;
  whatMattered: string;
  learnings: string;
};

export type AnalysisData = {
  today: string;
  habitStats: HabitStatForAnalysis[];
  identityMetrics: IdentityMetricRow[];
  reflections: ReflectionForAnalysis[];
  existingObservations: AIObservation[];
  dismissedObservations: AIObservation[];
  completedTasks?: Array<{ title: string }>;
};

type RawObservation = {
  category: string;
  observation: string;
  confidence: number;
  entity_refs?: Array<{ type: string; id: string }>;
};

// ── Constants ──────────────────────────────────────────────────────────

const MAX_ACTIVE_OBSERVATIONS = 200;

const VALID_CATEGORIES: ObservationCategory[] = [
  "habit_trend", "identity_pattern", "schedule_insight",
  "reflection_theme", "energy_pattern", "growth_signal", "task_trend",
];

// ── System Prompt ──────────────────────────────────────────────────────

const OBSERVATION_SYSTEM_PROMPT = `You are a longitudinal pattern analyst for an identity-focused personal productivity system. Your job is to identify meaningful patterns across days and weeks — NOT to restate today's data.

Core principles:
- Frame through identity growth, not productivity metrics
- Never use deficit language, shame, or guilt
- 70-80% adherence is healthy — never imply 100% is expected
- Every observation must cite specific data (dates, streaks, percentages)
- Look for: emerging trends, weekly rhythms, identity shifts, energy patterns, connections between habits

Output ONLY valid JSON: an array of observation objects. Each object has:
- "category": one of "habit_trend", "identity_pattern", "schedule_insight", "reflection_theme", "energy_pattern", "growth_signal", "task_trend"
- "observation": 1-2 sentence insight (be specific, cite data)
- "confidence": 1-5 (5 = very confident, well-supported by data)
- "entity_refs": optional array of {"type": "habit"|"goal"|"identity_metric", "id": "..."} (use when you can reference specific entities)

Rules:
- Generate 3-5 observations for 7day analysis, 2-4 for 30day, 1-3 for full
- Do NOT repeat existing observations — build on them or identify NEW patterns
- If the user dismissed an observation and labeled it "intentional", that means the behavior is a deliberate choice — do not flag it again
- If labeled "incorrect", the observation was wrong — avoid similar conclusions
- If labeled "outdated", the pattern has changed — look for what replaced it
- Higher confidence = more data points supporting the pattern
- When completed tasks data is provided, look for task completion patterns: recurring themes, velocity changes, types of tasks completed, and alignment with stated goals and identity practices
- COHESION CHECK: Before outputting, review all observations as a group. Each must add DISTINCT value — no two should cover the same habit, metric, or theme from a similar angle. If two observations reference the same entity (e.g., same habit streak), merge them or drop the weaker one. Vary framing: if one cites a streak, another should focus on rhythm, timing, or cross-habit correlation instead of another streak.`;

// ── Frequency Logic ────────────────────────────────────────────────────

export function shouldRunAnalysis(depth: AnalysisDepth, lastRunDate: string | null, today: string): boolean {
  if (!lastRunDate) return true;
  const last = new Date(lastRunDate + "T12:00:00");
  const now = new Date(today + "T12:00:00");
  const daysDiff = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  switch (depth) {
    case "7day": return daysDiff >= 1;
    case "30day": return daysDiff >= 5;
    case "full": return daysDiff >= 14;
  }
}

// ── Context Builder ────────────────────────────────────────────────────

function buildAnalysisContext(depth: AnalysisDepth, data: AnalysisData): string {
  const sections: string[] = [];
  sections.push(`Analysis depth: ${depth}`);
  sections.push(`Analysis through: ${data.today} (today's data excluded — still in progress)`);

  if (data.identityMetrics.length > 0) {
    const metricsStr = data.identityMetrics.map((m) => {
      const score = [m.morningGrounding, m.embodiedMovement, m.nutritionalAwareness, m.presentConnection, m.curiositySpark].filter(Boolean).length;
      return `${m.date}: ${score}/5 (${[
        m.morningGrounding ? "grounding" : "",
        m.embodiedMovement ? "movement" : "",
        m.nutritionalAwareness ? "nutrition" : "",
        m.presentConnection ? "connection" : "",
        m.curiositySpark ? "curiosity" : "",
      ].filter(Boolean).join(", ") || "none"})`;
    }).join("\n");
    sections.push(`Identity metrics (last ${depth === "7day" ? "7" : "30"} days):\n${metricsStr}`);
  }

  if (data.habitStats.length > 0) {
    sections.push(
      `Habit stats:\n${data.habitStats.map((h) =>
        `- ${h.title}: streak=${h.activeStreak}d, last7=${h.last7Sum}, adherence365=${h.adherenceLast365}%, currentYear=${h.adherenceCurrentYear}%`
      ).join("\n")}\nNote: Habit adherence stats are long-window metrics where one day's variance is negligible.`
    );
  }

  if (data.completedTasks && data.completedTasks.length > 0) {
    sections.push(
      `Completed tasks (recent):\n${data.completedTasks.map((t) => `- ${t.title}`).join("\n")}`
    );
  }

  if (data.reflections.length > 0) {
    sections.push(
      `Recent reflections:\n${data.reflections.map((r) =>
        `Week of ${r.weekStartDate}: Well: ${r.whatWentWell || "(empty)"} | Mattered: ${r.whatMattered || "(empty)"} | Learnings: ${r.learnings || "(empty)"}`
      ).join("\n")}`
    );
  }

  if (data.existingObservations.length > 0) {
    sections.push(
      `Existing active observations (do NOT repeat these — build on them or find NEW patterns):\n${data.existingObservations.map((o) =>
        `- [${o.category}] ${o.observation} (confidence: ${o.confidence}, from: ${o.dateRef})`
      ).join("\n")}`
    );
  }

  if (data.dismissedObservations.length > 0) {
    sections.push(
      `User-corrected observations (respect these corrections):\n${data.dismissedObservations.map((o) =>
        `- [${o.category}] "${o.observation}" → dismissed as "${o.dismissReason}"${o.dismissNote ? `: ${o.dismissNote}` : ""}`
      ).join("\n")}`
    );
  }

  return sections.join("\n\n");
}

// ── Response Parsing ──────────────────────────────────────────────────

function parseObservationResponse(text: string): RawObservation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      parsed = JSON.parse(fenceMatch[1]);
    } else {
      const firstBracket = text.indexOf("[");
      const lastBracket = text.lastIndexOf("]");
      if (firstBracket !== -1 && lastBracket > firstBracket) {
        parsed = JSON.parse(text.slice(firstBracket, lastBracket + 1));
      } else {
        throw new Error("Could not parse observation response as JSON");
      }
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error("Observation response is not an array");
  }

  return (parsed as Array<Record<string, unknown>>)
    .filter((item) =>
      typeof item.category === "string" &&
      typeof item.observation === "string" &&
      typeof item.confidence === "number"
    )
    .map((item) => ({
      category: VALID_CATEGORIES.includes(item.category as ObservationCategory)
        ? (item.category as string)
        : "growth_signal",
      observation: (item.observation as string).slice(0, 500),
      confidence: Math.min(5, Math.max(1, Math.round(item.confidence as number))),
      entity_refs: Array.isArray(item.entity_refs)
        ? (item.entity_refs as Array<Record<string, unknown>>).filter(
            (r) => typeof r.type === "string" && typeof r.id === "string"
          ).map((r) => ({ type: r.type as string, id: r.id as string }))
        : undefined,
    }));
}

// ── Core Generation ────────────────────────────────────────────────────

export async function generateObservations(
  client: Anthropic,
  depth: AnalysisDepth,
  data: AnalysisData
): Promise<InsertObservationPayload[]> {
  const context = buildAnalysisContext(depth, data);
  const scopeMap: Record<AnalysisDepth, ObservationScope> = {
    "7day": "daily",
    "30day": "weekly",
    "full": "quarterly",
  };

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 512,
    system: OBSERVATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: context }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return [];

  const raw = parseObservationResponse(textBlock.text);
  return raw.map((r) => ({
    scope: scopeMap[depth],
    analysisDepth: depth,
    category: r.category,
    observation: r.observation,
    dateRef: data.today,
    entityRefs: r.entity_refs as EntityRef[] | undefined,
    confidence: r.confidence,
  }));
}

// ── Consolidation ──────────────────────────────────────────────────────

async function consolidateWeekly(
  client: Anthropic,
  supabase: SupabaseClient,
  userId: string,
  today: string,
  existingActive: AIObservation[]
): Promise<void> {
  const dailyObs = existingActive.filter((o) => o.scope === "daily");
  if (dailyObs.length < 3) return;

  const weekAgo = new Date(today + "T12:00:00");
  weekAgo.setDate(weekAgo.getDate() - 7);
  const oldDailies = dailyObs.filter((o) => new Date(o.dateRef + "T12:00:00") <= weekAgo);
  if (oldDailies.length < 2) return;

  const consolidationPrompt = `Consolidate these daily observations into 2-3 weekly-scope observations that capture the most important patterns. Keep the same JSON format (array of objects with category, observation, confidence, entity_refs).

Daily observations to consolidate:
${oldDailies.map((o) => `- [${o.category}] ${o.observation} (${o.dateRef}, confidence: ${o.confidence})`).join("\n")}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 400,
    system: OBSERVATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: consolidationPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return;

  const raw = parseObservationResponse(textBlock.text);
  const payloads: InsertObservationPayload[] = raw.map((r) => ({
    scope: "weekly" as ObservationScope,
    analysisDepth: "30day" as AnalysisDepth,
    category: r.category,
    observation: r.observation,
    dateRef: today,
    entityRefs: r.entity_refs as EntityRef[] | undefined,
    confidence: r.confidence,
  }));

  const inserted = await insertObservations(supabase, userId, payloads);
  if (inserted.length > 0) {
    await supersedeObservations(supabase, userId, oldDailies.map((o) => o.id), inserted[0].id);
  }
}

async function consolidateQuarterly(
  client: Anthropic,
  supabase: SupabaseClient,
  userId: string,
  today: string,
  existingActive: AIObservation[]
): Promise<void> {
  const weeklyObs = existingActive.filter((o) => o.scope === "weekly");
  if (weeklyObs.length < 3) return;

  const fourWeeksAgo = new Date(today + "T12:00:00");
  fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
  const oldWeeklies = weeklyObs.filter((o) => new Date(o.dateRef + "T12:00:00") <= fourWeeksAgo);
  if (oldWeeklies.length < 2) return;

  const consolidationPrompt = `Consolidate these weekly observations into 1-2 quarterly-scope observations that capture the deepest identity patterns. Keep the same JSON format (array of objects with category, observation, confidence, entity_refs).

Weekly observations to consolidate:
${oldWeeklies.map((o) => `- [${o.category}] ${o.observation} (${o.dateRef}, confidence: ${o.confidence})`).join("\n")}`;

  const message = await client.messages.create({
    model: "claude-sonnet-4-5-20250929",
    max_tokens: 300,
    system: OBSERVATION_SYSTEM_PROMPT,
    messages: [{ role: "user", content: consolidationPrompt }],
  });

  const textBlock = message.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") return;

  const raw = parseObservationResponse(textBlock.text);
  const payloads: InsertObservationPayload[] = raw.map((r) => ({
    scope: "quarterly" as ObservationScope,
    analysisDepth: "full" as AnalysisDepth,
    category: r.category,
    observation: r.observation,
    dateRef: today,
    entityRefs: r.entity_refs as EntityRef[] | undefined,
    confidence: r.confidence,
  }));

  const inserted = await insertObservations(supabase, userId, payloads);
  if (inserted.length > 0) {
    await supersedeObservations(supabase, userId, oldWeeklies.map((o) => o.id), inserted[0].id);
  }
}

// ── Main Pipeline (called from briefing route) ─────────────────────────

export async function runObservationPipeline(
  client: Anthropic,
  supabase: SupabaseClient,
  userId: string,
  today: string,
  habitStats: HabitStatForAnalysis[],
  completedTasks?: Array<{ title: string }>
): Promise<AIObservation[]> {
  // Analyze through yesterday — today's data is still incomplete
  const yesterdayDate = new Date(today + "T12:00:00");
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  // Check if daily analysis already ran for yesterday
  const yesterdayObs = await loadObservationsForDate(supabase, userId, yesterday);
  if (yesterdayObs.length > 0) {
    return loadActiveObservations(supabase, userId, 5);
  }

  const existingActive = await loadActiveObservations(supabase, userId, 50);
  const dismissed = await loadRecentDismissedObservations(supabase, userId, 30);

  // Always run 7-day analysis (through yesterday)
  const metrics7 = await loadIdentityMetricsRange(supabase, userId, 7, yesterday);
  const reflections = await loadRecentWeeklyReflections(supabase, userId, 1);
  const baseData: AnalysisData = {
    today: yesterday,
    habitStats,
    identityMetrics: metrics7,
    reflections: reflections.map((r) => ({
      weekStartDate: r.weekStartDate,
      whatWentWell: r.whatWentWell,
      whatMattered: r.whatMattered,
      learnings: r.learnings,
    })),
    existingObservations: existingActive,
    dismissedObservations: dismissed,
    completedTasks,
  };

  try {
    const dailyPayloads = await generateObservations(client, "7day", baseData);
    await insertObservations(supabase, userId, dailyPayloads);
  } catch (err) {
    console.error("7day observation generation failed:", err);
  }

  // Check if 30-day analysis is due
  const last30day = await getLastAnalysisDate(supabase, userId, "30day");
  if (shouldRunAnalysis("30day", last30day, yesterday)) {
    try {
      const metrics30 = await loadIdentityMetricsRange(supabase, userId, 30, yesterday);
      const reflections4 = await loadRecentWeeklyReflections(supabase, userId, 4);
      const data30: AnalysisData = {
        ...baseData,
        identityMetrics: metrics30,
        reflections: reflections4.map((r) => ({
          weekStartDate: r.weekStartDate,
          whatWentWell: r.whatWentWell,
          whatMattered: r.whatMattered,
          learnings: r.learnings,
        })),
      };
      const weeklyPayloads = await generateObservations(client, "30day", data30);
      await insertObservations(supabase, userId, weeklyPayloads);
    } catch (err) {
      console.error("30day observation generation failed:", err);
    }
  }

  // Check if full analysis is due
  const lastFull = await getLastAnalysisDate(supabase, userId, "full");
  if (shouldRunAnalysis("full", lastFull, yesterday)) {
    try {
      const metrics30 = await loadIdentityMetricsRange(supabase, userId, 30, yesterday);
      const allReflections = await loadRecentWeeklyReflections(supabase, userId, 12);
      const dataFull: AnalysisData = {
        ...baseData,
        identityMetrics: metrics30,
        reflections: allReflections.map((r) => ({
          weekStartDate: r.weekStartDate,
          whatWentWell: r.whatWentWell,
          whatMattered: r.whatMattered,
          learnings: r.learnings,
        })),
      };
      const fullPayloads = await generateObservations(client, "full", dataFull);
      await insertObservations(supabase, userId, fullPayloads);
    } catch (err) {
      console.error("full observation generation failed:", err);
    }
  }

  // Consolidation
  const refreshed = await loadActiveObservations(supabase, userId, 50);
  try {
    await consolidateWeekly(client, supabase, userId, yesterday, refreshed);
    await consolidateQuarterly(client, supabase, userId, yesterday, refreshed);
  } catch (err) {
    console.error("Observation consolidation failed:", err);
  }

  // Enforce cap
  await pruneObservations(supabase, userId, MAX_ACTIVE_OBSERVATIONS);

  return loadActiveObservations(supabase, userId, 5);
}
