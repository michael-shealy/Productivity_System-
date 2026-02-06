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

export async function loadFocus3(
  supabase: SupabaseClient,
  userId: string,
  date: string
): Promise<Focus3Item[] | null> {
  const { data } = await supabase
    .from("daily_focus3")
    .select("items")
    .eq("user_id", userId)
    .eq("date", date)
    .single();

  if (!data) return null;
  return data.items as Focus3Item[];
}

export async function saveFocus3(
  supabase: SupabaseClient,
  userId: string,
  date: string,
  items: Focus3Item[]
) {
  await supabase.from("daily_focus3").upsert(
    {
      user_id: userId,
      date,
      items,
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
  const { data } = await supabase
    .from("habit_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at");

  if (!data) return [];
  return data.map((row) => ({
    id: row.id,
    habitId: row.habit_id,
    duration: row.duration,
    amount: row.amount,
    data: row.data,
    createdAt: row.created_at,
    finishedAt: row.finished_at,
  }));
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
