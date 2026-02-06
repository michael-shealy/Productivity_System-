export type OAuthProvider = "todoist" | "google";

export type DbOAuthToken = {
  id: string;
  user_id: string;
  provider: OAuthProvider;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type DbGoal = {
  id: string;
  user_id: string;
  slug: string;
  title: string;
  domain: string;
  description: string;
  season: string;
  active: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type DbHabit = {
  id: string;
  user_id: string;
  external_id: string | null;
  title: string;
  type: string;
  kind: "check" | "amount";
  count: number;
  period: string;
  target_duration: number;
  created_at: string;
  archived_at: string | null;
};

export type DbHabitSession = {
  id: string;
  user_id: string;
  habit_id: string;
  duration: number | null;
  amount: number | null;
  data: string | null;
  created_at: string;
  finished_at: string | null;
};

export type DbDailyIdentityMetrics = {
  id: string;
  user_id: string;
  date: string;
  morning_grounding: boolean;
  embodied_movement: boolean;
  nutritional_awareness: boolean;
  present_connection: boolean;
  curiosity_spark: boolean;
};

export type DbDailyMorningFlow = {
  id: string;
  user_id: string;
  date: string;
  status: "idle" | "in_progress" | "complete";
  step_briefing: boolean;
  step_focus: boolean;
  step_identity: boolean;
  step_habits: boolean;
};

export type DbDailyFocus3 = {
  id: string;
  user_id: string;
  date: string;
  items: Array<{ id: string; label: string; type: string }>;
};

export type DbDailyAIBriefing = {
  id: string;
  user_id: string;
  date: string;
  headline: string;
  values_focus: string;
  why_bullets: string[];
  insights: Array<{
    id: string;
    title: string;
    body: string;
    why: string[];
  }>;
};
