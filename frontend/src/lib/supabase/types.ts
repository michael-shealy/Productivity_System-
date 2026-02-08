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
  ai_reasoning: string;
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

export type DbWeeklyReflection = {
  id: string;
  user_id: string;
  week_start_date: string;
  what_went_well: string;
  what_mattered: string;
  learnings: string;
  capability_growth: boolean | null;
  created_at: string;
  updated_at: string;
};

export type WeeklyReflection = {
  weekStartDate: string;
  whatWentWell: string;
  whatMattered: string;
  learnings: string;
  capabilityGrowth: boolean | null;
};

export type UserPreferences = {
  aiTone?: "standard" | "gentle";
};

export type DbUserPreferences = {
  id: string;
  user_id: string;
  preferences: Record<string, unknown>;
  updated_at: string;
};

export type FourWeekReview = {
  periodEndDate: string;
  goalIds: string[];
  systemAdjustmentNotes: string | null;
  reflectionSummary: string | null;
};

export type DbFourWeekReview = {
  id: string;
  user_id: string;
  period_end_date: string;
  reflection_summary: string | null;
  goal_ids: string[];
  system_adjustment_notes: string | null;
  created_at: string;
  updated_at: string;
};
