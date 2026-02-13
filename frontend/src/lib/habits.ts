export type HabitKind = "check" | "amount";

export type Habit = {
  id: string;
  title: string;
  type: string;
  kind: HabitKind;
  count: number;
  period: string;
  targetDuration: number;
  createdAt: string;
  archivedAt?: string | null;
};

export type HabitSession = {
  id: string;
  habitId: string;
  duration?: number | null;
  amount?: number | null;
  data?: string | null;
  createdAt: string;
  finishedAt?: string | null;
};

