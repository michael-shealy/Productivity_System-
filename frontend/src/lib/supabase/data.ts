import type { SupabaseClient } from "@supabase/supabase-js";
import type { Goal } from "@/lib/goals";
import type { Habit, HabitSession } from "@/lib/habits";
import type { AIBriefingResponse } from "@/lib/ai";
import type {
  WeeklyReflection,
  UserPreferences,
} from "@/lib/supabase/types";

// ── Identity Metrics ──────────────────────────────────────────────────

type IdentityMetrics = {
  morningGrounding: boolean;
  embodiedMovement: boolean;
  nutritionalAwareness: boolean;
  presentConnection: boolean;
  curiositySpark: boolean;
};

export async function loadIdentityMetrics(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<IdentityMetrics | null> {
  const { data } = await supabase
    .from("daily_identity_metrics")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (!data) return null;
  return {
    morningGrounding: data.morning_grounding,
    embodiedMovement: data.embodied_movement,
    nutritionalAwareness: data.nutritional_awareness,
    presentConnection: data.present_connection,
    curiositySpark: data.curiosity_spark,
  };
}

export async function saveIdentityMetrics(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  metrics: IdentityMetrics
) {
  await supabase.from("daily_identity_metrics").upsert(
    {
      user_id: userId,
      date,
      morning_grounding: metrics.morningGrounding,
      embodied_movement: metrics.embodiedMovement,
      nutritional_awareness: metrics.nutritionalAwareness,
      present_connection: metrics.presentConnection,
      curiosity_spark: metrics.curiositySpark,
    },
    { onConflict: "user_id,date" }
  );
}

export async function loadLatestIdentityMetricsBeforeDate(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<{ date: string; metrics: IdentityMetrics } | null> {
  const { data } = await supabase
    .from("daily_identity_metrics")
    .select("date, morning_grounding, embodied_movement, nutritional_awareness, present_connection, curiosity_spark")
    .eq("user_id", userId)
    .lt("date", date)
    .order("date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    date: data.date as string,
    metrics: {
      morningGrounding: data.morning_grounding as boolean,
      embodiedMovement: data.embodied_movement as boolean,
      nutritionalAwareness: data.nutritional_awareness as boolean,
      presentConnection: data.present_connection as boolean,
      curiositySpark: data.curiosity_spark as boolean,
    },
  };
}

// ── Morning Flow ──────────────────────────────────────────────────────

type MorningFlowData = {
  status: "idle" | "in_progress" | "complete";
  steps: {
    briefing: boolean;
    focus: boolean;
    identity: boolean;
    habits: boolean;
  };
};

export async function loadMorningFlow(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<MorningFlowData | null> {
  const { data } = await supabase
    .from("daily_morning_flow")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (!data) return null;
  return {
    status: data.status as MorningFlowData["status"],
    steps: {
      briefing: data.step_briefing,
      focus: data.step_focus,
      identity: data.step_identity,
      habits: data.step_habits,
    },
  };
}

export async function saveMorningFlow(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  flow: MorningFlowData
) {
  await supabase.from("daily_morning_flow").upsert(
    {
      user_id: userId,
      date,
      status: flow.status,
      step_briefing: flow.steps.briefing,
      step_focus: flow.steps.focus,
      step_identity: flow.steps.identity,
      step_habits: flow.steps.habits,
    },
    { onConflict: "user_id,date" }
  );
}

export async function deleteMorningFlow(
  supabase: SupabaseClient,
  userId: string,
  date: string
) {
  await supabase
    .from("daily_morning_flow")
    .delete()
    .eq("user_id", userId)
    .eq("date", date);
}

// ── Focus3 ────────────────────────────────────────────────────────────

type Focus3Item = { id: string; label: string; type: string };
type Focus3Data = { items: Focus3Item[]; aiReasoning: string };

export async function loadFocus3(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<Focus3Data | null> {
  // Use maybeSingle() so 0 rows returns { data: null, error: null } instead of PGRST116
  const { data, error } = await supabase
    .from("daily_focus3")
    .select("items, ai_reasoning")
    .eq("user_id", userId)
    .eq("date", date)
    .maybeSingle();

  if (!data) return null;
  return {
    items: data.items as Focus3Item[],
    aiReasoning: (data.ai_reasoning as string) ?? "",
  };
}

export async function saveFocus3(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  items: Focus3Item[],
  aiReasoning?: string
) {
  await supabase.from("daily_focus3").upsert(
    {
      user_id: userId,
      date,
      items,
      ai_reasoning: aiReasoning ?? "",
    },
    { onConflict: "user_id,date" }
  );
}

// ── Goals ─────────────────────────────────────────────────────────────

export async function loadGoals(
  supabase: SupabaseClient,
  userId: string
): Promise<Goal[]> {
  const { data } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("sort_order");

  if (!data) return [];
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    domain: row.domain,
    description: row.description,
    season: row.season,
    active: row.active,
  }));
}

// ── Habits ────────────────────────────────────────────────────────────

export async function loadHabits(
  supabase: SupabaseClient,
  userId: string
): Promise<Habit[]> {
  const { data } = await supabase
    .from("habits")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");

  if (!data) return [];
  return data.map((row) => ({
    id: row.id,
    title: row.title,
    type: row.type,
    kind: row.kind as "check" | "amount",
    count: row.count,
    period: row.period,
    targetDuration: row.target_duration,
    createdAt: row.created_at,
    archivedAt: row.archived_at,
  }));
}

export async function loadHabitSessions(
  supabase: SupabaseClient,
  userId: string
): Promise<HabitSession[]> {
  const PAGE_SIZE = 1000;
  const allRows: { id: string; habit_id: string; duration: number | null; amount: number | null; data: string | null; created_at: string; finished_at: string | null }[] = [];
  let from = 0;
  let hasMore = true;

  while (hasMore) {
    const to = from + PAGE_SIZE - 1;
    const { data: page, error } = await supabase
      .from("habit_sessions")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .range(from, to);

    if (error) break;
    if (!page?.length) break;
    allRows.push(...(page as typeof allRows));
    hasMore = page.length === PAGE_SIZE;
    from += PAGE_SIZE;
  }

  return allRows.map((row) => ({
    id: row.id,
    habitId: row.habit_id,
    duration: row.duration,
    amount: row.amount,
    data: row.data,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  }));
}

export type InsertHabitSessionPayload = {
  habitId: string;
  amount?: number | null;
  duration?: number | null;
  data?: string | null;
  createdAt?: string;
  finishedAt?: string | null;
};

export async function insertHabitSession(
  supabase: SupabaseClient,
  userId: string,
  payload: InsertHabitSessionPayload
): Promise<HabitSession | null> {
  const now = new Date().toISOString();
  const createdAt = payload.createdAt ?? now;
  const finishedAt = payload.finishedAt ?? now;
  const { data, error } = await supabase
    .from("habit_sessions")
    .insert({
      user_id: userId,
      habit_id: payload.habitId,
      amount: payload.amount ?? null,
      duration: payload.duration ?? null,
      data: payload.data ?? null,
      created_at: createdAt,
      finished_at: finishedAt,
    })
    .select("id, habit_id, duration, amount, data, created_at, finished_at")
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    habitId: data.habit_id,
    duration: data.duration,
    amount: data.amount,
    data: data.data,
    createdAt: data.created_at,
    finishedAt: data.finished_at,
  };
}

export type UpdateHabitSessionPayload = {
  amount?: number | null;
  duration?: number | null;
  data?: string | null;
};

export async function updateHabitSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string,
  updates: UpdateHabitSessionPayload
): Promise<HabitSession | null> {
  const body: Record<string, unknown> = {};
  if (updates.amount !== undefined) body.amount = updates.amount;
  if (updates.duration !== undefined) body.duration = updates.duration;
  if (updates.data !== undefined) body.data = updates.data;
  if (Object.keys(body).length === 0) return null;

  const { data, error } = await supabase
    .from("habit_sessions")
    .update(body)
    .eq("id", sessionId)
    .eq("user_id", userId)
    .select("id, habit_id, duration, amount, data, created_at, finished_at")
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    habitId: data.habit_id,
    duration: data.duration,
    amount: data.amount,
    data: data.data,
    createdAt: data.created_at,
    finishedAt: data.finished_at,
  };
}

export async function deleteHabitSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("habit_sessions")
    .delete()
    .eq("id", sessionId)
    .eq("user_id", userId);
  return !error;
}

// ── AI Briefing Cache ─────────────────────────────────────────────────

export async function loadAIBriefing(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<AIBriefingResponse | null> {
  const { data } = await supabase
    .from("daily_ai_briefings")
    .select("*")
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (!data) return null;
  return {
    headline: data.headline,
    valuesFocus: data.values_focus,
    whyBullets: data.why_bullets as string[],
    insights: data.insights as AIBriefingResponse["insights"],
  };
}

export async function saveAIBriefing(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  briefing: AIBriefingResponse
) {
  await supabase.from("daily_ai_briefings").upsert(
    {
      user_id: userId,
      date,
      headline: briefing.headline,
      values_focus: briefing.valuesFocus,
      why_bullets: briefing.whyBullets,
      insights: briefing.insights,
    },
    { onConflict: "user_id,date" }
  );
}

export async function deleteAIBriefing(
  supabase: SupabaseClient,
  userId: string,
  date: string
) {
  await supabase
    .from("daily_ai_briefings")
    .delete()
    .eq("user_id", userId)
    .eq("date", date);
}

// ── Weekly Reflection ──────────────────────────────────────────────────

export async function loadWeeklyReflection(
  supabase: SupabaseClient,
  userId: string,
  weekStartDate: string
): Promise<WeeklyReflection | null> {
  const { data } = await supabase
    .from("weekly_reflections")
    .select("week_start_date, what_went_well, what_mattered, learnings, capability_growth")
    .eq("user_id", userId)
    .eq("week_start_date", weekStartDate)
    .single();

  if (!data) return null;
  return {
    weekStartDate: data.week_start_date,
    whatWentWell: data.what_went_well ?? "",
    whatMattered: data.what_mattered ?? "",
    learnings: data.learnings ?? "",
    capabilityGrowth: data.capability_growth,
  };
}

export type UpsertWeeklyReflectionPayload = {
  whatWentWell: string;
  whatMattered: string;
  learnings: string;
  capabilityGrowth: boolean | null;
};

export async function upsertWeeklyReflection(
  supabase: SupabaseClient,
  userId: string,
  weekStartDate: string,
  payload: UpsertWeeklyReflectionPayload
): Promise<void> {
  const { error } = await supabase.from("weekly_reflections").upsert(
    {
      user_id: userId,
      week_start_date: weekStartDate,
      what_went_well: payload.whatWentWell,
      what_mattered: payload.whatMattered,
      learnings: payload.learnings,
      capability_growth: payload.capabilityGrowth,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,week_start_date" }
  );
  if (error) throw error;
}

export async function loadLatestWeeklyReflection(
  supabase: SupabaseClient,
  userId: string
): Promise<WeeklyReflection | null> {
  const { data } = await supabase
    .from("weekly_reflections")
    .select("week_start_date, what_went_well, what_mattered, learnings, capability_growth")
    .eq("user_id", userId)
    .order("week_start_date", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    weekStartDate: data.week_start_date,
    whatWentWell: data.what_went_well ?? "",
    whatMattered: data.what_mattered ?? "",
    learnings: data.learnings ?? "",
    capabilityGrowth: data.capability_growth,
  };
}

export async function loadRecentWeeklyReflections(
  supabase: SupabaseClient,
  userId: string,
  limit: number
): Promise<WeeklyReflection[]> {
  const { data } = await supabase
    .from("weekly_reflections")
    .select("week_start_date, what_went_well, what_mattered, learnings, capability_growth")
    .eq("user_id", userId)
    .order("week_start_date", { ascending: false })
    .limit(limit);

  if (!data || !data.length) return [];
  return data.map((row) => ({
    weekStartDate: row.week_start_date,
    whatWentWell: row.what_went_well ?? "",
    whatMattered: row.what_mattered ?? "",
    learnings: row.learnings ?? "",
    capabilityGrowth: row.capability_growth,
  }));
}

// ── User Preferences ───────────────────────────────────────────────────

export async function loadUserPreferences(
  supabase: SupabaseClient,
  userId: string
): Promise<UserPreferences | null> {
  const { data } = await supabase
    .from("user_preferences")
    .select("preferences")
    .eq("user_id", userId)
    .single();

  if (!data?.preferences || typeof data.preferences !== "object") return null;
  const prefs = data.preferences as Record<string, unknown>;
  const result: UserPreferences = {};
  if (prefs.ai_tone === "standard" || prefs.ai_tone === "gentle") {
    result.aiTone = prefs.ai_tone;
  }
  return result;
}

export async function saveUserPreferences(
  supabase: SupabaseClient,
  userId: string,
  preferences: UserPreferences
): Promise<void> {
  await supabase.from("user_preferences").upsert(
    {
      user_id: userId,
      preferences: {
        ai_tone: preferences.aiTone ?? "standard",
      },
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
}

// ── Four-Week Reviews ──────────────────────────────────────────────────

export async function loadFourWeekReview(
  supabase: SupabaseClient,
  userId: string,
  periodEndDate: string
): Promise<{ periodEndDate: string; goalIds: string[]; systemAdjustmentNotes: string | null; reflectionSummary: string | null; updatedAt?: string } | null> {
  const { data } = await supabase
    .from("four_week_reviews")
    .select("period_end_date, goal_ids, system_adjustment_notes, reflection_summary, updated_at")
    .eq("user_id", userId)
    .eq("period_end_date", periodEndDate)
    .single();

  if (!data) return null;
  const goalIds = Array.isArray(data.goal_ids) ? (data.goal_ids as string[]) : [];
  return {
    periodEndDate: data.period_end_date,
    goalIds,
    systemAdjustmentNotes: data.system_adjustment_notes,
    reflectionSummary: data.reflection_summary,
    updatedAt: data.updated_at,
  };
}

/** Load the previous 4-week period's review (for "last period you noted" snippet). */
export async function loadPreviousFourWeekReview(
  supabase: SupabaseClient,
  userId: string,
  currentPeriodEndDate: string
): Promise<{ systemAdjustmentNotes: string | null } | null> {
  const current = new Date(currentPeriodEndDate + "T12:00:00");
  const prevEnd = new Date(current);
  prevEnd.setDate(prevEnd.getDate() - 28);
  const prevKey = prevEnd.toISOString().slice(0, 10);
  const review = await loadFourWeekReview(supabase, userId, prevKey);
  if (!review) return null;
  return { systemAdjustmentNotes: review.systemAdjustmentNotes };
}

export type UpsertFourWeekReviewPayload = {
  goalIds?: string[];
  systemAdjustmentNotes?: string | null;
  reflectionSummary?: string | null;
};

export async function upsertFourWeekReview(
  supabase: SupabaseClient,
  userId: string,
  periodEndDate: string,
  payload: UpsertFourWeekReviewPayload
): Promise<void> {
  const { error } = await supabase.from("four_week_reviews").upsert(
    {
      user_id: userId,
      period_end_date: periodEndDate,
      goal_ids: payload.goalIds ?? [],
      system_adjustment_notes: payload.systemAdjustmentNotes ?? null,
      reflection_summary: payload.reflectionSummary ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,period_end_date" }
  );
  if (error) throw error;
}

// ── Chat Messages ─────────────────────────────────────────────────────

export type ChatMessageContent = {
  text: string;
  toolUses?: Array<{
    id: string;
    name: string;
    input: Record<string, unknown>;
    status: "pending" | "confirmed" | "rejected" | "executing" | "executed" | "error";
    result?: string;
  }>;
};

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: ChatMessageContent;
  createdAt: string;
};

export async function loadChatMessages(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from("daily_chat_messages")
    .select("id, role, content, created_at")
    .eq("user_id", userId)
    .eq("date", date)
    .order("created_at", { ascending: true });

  if (!data) return [];
  return data.map((row) => ({
    id: row.id,
    role: row.role as "user" | "assistant",
    content: row.content as ChatMessageContent,
    createdAt: row.created_at,
  }));
}

export async function saveChatMessage(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  role: "user" | "assistant",
  content: ChatMessageContent
): Promise<ChatMessage | null> {
  const { data, error } = await supabase
    .from("daily_chat_messages")
    .insert({ user_id: userId, date, role, content })
    .select("id, role, content, created_at")
    .single();

  if (error || !data) return null;
  return {
    id: data.id,
    role: data.role as "user" | "assistant",
    content: data.content as ChatMessageContent,
    createdAt: data.created_at,
  };
}

export async function updateChatMessageContent(
  supabase: SupabaseClient,
  userId: string,
  messageId: string,
  content: ChatMessageContent
): Promise<void> {
  await supabase
    .from("daily_chat_messages")
    .update({ content })
    .eq("id", messageId)
    .eq("user_id", userId);
}

export async function deleteChatMessagesForDate(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<void> {
  await supabase
    .from("daily_chat_messages")
    .delete()
    .eq("user_id", userId)
    .eq("date", date);
}
