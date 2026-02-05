import type { Habit, HabitSession } from "@/lib/habits";

export type HabitStorePayload = {
  habits: Habit[];
  habitSessions: HabitSession[];
  source: string;
};

const STORAGE_KEY = "habitImportData";

export const loadHabitsFromStorage = () => {
  if (typeof window === "undefined") return null;
  const cached = localStorage.getItem(STORAGE_KEY);
  if (!cached) return null;
  try {
    return JSON.parse(cached) as HabitStorePayload;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
    return null;
  }
};

export const saveHabitsToStorage = (payload: HabitStorePayload) => {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
};

export const fetchHabitsFromApi = async () => {
  const response = await fetch("/api/habits/import");
  if (!response.ok) {
    throw new Error("Habit import failed");
  }
  return (await response.json()) as HabitStorePayload;
};

// Supabase-ready shape (for future migration)
// habits: id, title, type, kind, count, period, target_duration, created_at, archived_at
// habit_sessions: id, habit_id, duration, amount, data, created_at, finished_at
