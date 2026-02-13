/** Format a Date as "YYYY-MM-DD" in local time. */
export const toDateKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

/** Get the Sunday-based week start key for a date. */
export const getWeekStartKey = (date: Date) => {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - day);
  start.setHours(0, 0, 0, 0);
  return toDateKey(start);
};

/** Format a Date as "YYYY-MM" in local time. */
export const getMonthKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

/** Format a Date as "YYYY" in local time. */
export const getYearKey = (date: Date) => `${date.getFullYear()}`;
