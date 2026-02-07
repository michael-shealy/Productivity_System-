import type { SupabaseClient } from "@supabase/supabase-js";
import type { Goal } from "@/lib/goals";
import type { Habit, HabitSession } from "@/lib/habits";
import type { AIBriefingResponse } from "@/lib/ai";

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

  // #region agent log
  fetch('http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'data.ts:loadFocus3',message:'loadFocus3 result',data:{hasData:!!data,errorCode:error?.code,errorMessage:error?.message,itemsLength:data?.items?.length},timestamp:Date.now(),hypothesisId:'H2',runId:'post-fix'})}).catch(()=>{});
  // #endregion

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

export async function deleteFocus3(
  supabase: SupabaseClient,
  userId: string,
  date: string
) {
  await supabase
    .from("daily_focus3")
    .delete()
    .eq("user_id", userId)
    .eq("date", date);
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
    id: row.slug,
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

// ── OAuth Status ──────────────────────────────────────────────────────

export async function getOAuthStatus(
  supabase: SupabaseClient,
  userId: string
): Promise<{ todoist: boolean; google: boolean }> {
  const { data } = await supabase
    .from("user_oauth_tokens")
    .select("provider")
    .eq("user_id", userId);

  const providers = new Set((data ?? []).map((row) => row.provider));
  return {
    todoist: providers.has("todoist"),
    google: providers.has("google"),
  };
}
