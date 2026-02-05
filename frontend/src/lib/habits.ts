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

const parseCsvLine = (line: string) => {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (inQuotes && line[index + 1] === '"') {
        current += '"';
        index += 1;
        continue;
      }
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      cells.push(current);
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current);
  return cells.map((cell) => cell.trim());
};

const parseCsv = (csv: string) => {
  const lines = csv.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] as string[][] };
  const headers = parseCsvLine(lines[0]);
  const rows = lines.slice(1).map(parseCsvLine);
  return { headers, rows };
};

const findHeaderIndex = (headers: string[], name: string) =>
  headers.findIndex((header) => header.toLowerCase() === name.toLowerCase());

export const parseHabitsExport = (activitiesCsv: string, sessionsCsv: string) => {
  const activities = parseCsv(activitiesCsv);
  const sessions = parseCsv(sessionsCsv);

  const activityHeaders = activities.headers;
  const sessionHeaders = sessions.headers;

  const getActivity = (row: string[], field: string) =>
    row[findHeaderIndex(activityHeaders, field)] ?? "";
  const getSession = (row: string[], field: string) =>
    row[findHeaderIndex(sessionHeaders, field)] ?? "";

  const habits: Habit[] = activities.rows.map((row) => ({
    id: getActivity(row, "id"),
    title: getActivity(row, "title"),
    type: getActivity(row, "type"),
    kind: (getActivity(row, "kind") || "check") as HabitKind,
    count: Number(getActivity(row, "count")) || 0,
    period: getActivity(row, "period"),
    targetDuration: Number(getActivity(row, "target_duration")) || 0,
    createdAt: getActivity(row, "created_at"),
    archivedAt: (() => {
      const value = getActivity(row, "archived_at");
      return value && value !== "-" ? value : null;
    })(),
  }));

  const habitSessions: HabitSession[] = sessions.rows.map((row) => ({
    id: getSession(row, "id"),
    habitId: getSession(row, "activity_id"),
    duration: getSession(row, "duration") ? Number(getSession(row, "duration")) : null,
    amount: getSession(row, "amount") ? Number(getSession(row, "amount")) : null,
    data: getSession(row, "data") || null,
    createdAt: getSession(row, "created_at"),
    finishedAt: getSession(row, "finished_at") || null,
  }));

  return { habits, habitSessions };
};
