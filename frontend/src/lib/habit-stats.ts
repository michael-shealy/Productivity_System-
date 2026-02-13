import type { Habit, HabitSession } from "@/lib/habits";
import { toDateKey, getWeekStartKey, getMonthKey, getYearKey } from "@/lib/date-utils";

export type HabitStatResult = {
  habit: Habit;
  last7: number[];
  sumLast7: number;
  activeStreak: number;
  longestStreak: number;
  adherencePercent: number;
  adherenceLast365: number;
  adherenceCurrentYear: number;
  currentWeekSuccess: boolean;
  weekdayTotals: number[];
  weekdaySuccess: number[];
  monthTotals: Map<string, number>;
  monthSuccess: Map<string, number>;
  successDaysCount: number;
  successWeeksCount: number;
  successMonthsCount: number;
  successYearsCount: number;
  totalsByDay: Map<string, number>;
  totalsByWeek: Map<string, number>;
  totalsByMonth: Map<string, number>;
  totalsByYear: Map<string, number>;
  isDaily: boolean;
  startDate: Date;
  totalDays: number;
  totalWeeks: number;
  totalMonths: number;
  totalYears: number;
};

function countDaysBetween(start: Date, end: Date) {
  const diff = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(diff / 86400000) + 1);
}

function countWeeksBetween(start: Date, end: Date) {
  const startWeek = new Date(start);
  startWeek.setDate(startWeek.getDate() - startWeek.getDay());
  const endWeek = new Date(end);
  endWeek.setDate(endWeek.getDate() - endWeek.getDay());
  const diff = endWeek.getTime() - startWeek.getTime();
  return Math.max(1, Math.floor(diff / (7 * 86400000)) + 1);
}

function countMonthsBetween(start: Date, end: Date) {
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth()) +
    1
  );
}

function countYearsBetween(start: Date, end: Date) {
  return end.getFullYear() - start.getFullYear() + 1;
}

function countSuccessInRange(
  keys: Set<string>,
  rangeStart: Date,
  rangeEnd: Date
) {
  let count = 0;
  keys.forEach((key) => {
    const parsed = new Date(`${key}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return;
    if (parsed >= rangeStart && parsed <= rangeEnd) {
      count += 1;
    }
  });
  return count;
}

function getActiveStreak(
  isDaily: boolean,
  successDayKeys: Set<string>,
  successWeekKeys: Set<string>,
  metricsEndDate: Date,
  todayDate: Date
) {
  if (isDaily) {
    let streak = 0;
    const cursor = new Date(metricsEndDate);
    while (true) {
      const key = toDateKey(cursor);
      if (!successDayKeys.has(key)) break;
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
    }
    return streak;
  }
  let streak = 0;
  const cursor = new Date(todayDate);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  while (true) {
    const key = toDateKey(cursor);
    if (!successWeekKeys.has(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 7);
  }
  return streak;
}

function getLongestStreak(
  isDaily: boolean,
  successDayKeys: Set<string>,
  successWeekKeys: Set<string>,
  startDate: Date,
  metricsEndDate: Date,
  todayDate: Date
) {
  if (isDaily) {
    let longest = 0;
    let current = 0;
    const cursor = new Date(startDate);
    while (cursor <= metricsEndDate) {
      const key = toDateKey(cursor);
      if (successDayKeys.has(key)) {
        current += 1;
        longest = Math.max(longest, current);
      } else {
        current = 0;
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return longest;
  }
  let longest = 0;
  let current = 0;
  const cursor = new Date(startDate);
  cursor.setDate(cursor.getDate() - cursor.getDay());
  while (cursor <= todayDate) {
    const key = toDateKey(cursor);
    if (successWeekKeys.has(key)) {
      current += 1;
      longest = Math.max(longest, current);
    } else {
      current = 0;
    }
    cursor.setDate(cursor.getDate() + 7);
  }
  return longest;
}

export function computeHabitStats(
  activeHabits: Habit[],
  habitSessionsById: Map<string, HabitSession[]>,
  last7Days: string[]
): HabitStatResult[] {
  return activeHabits.map((habit) => {
    const sessions = habitSessionsById.get(habit.id) ?? [];
    const totalsByDay = new Map<string, number>();
    const totalsByWeek = new Map<string, number>();
    const totalsByMonth = new Map<string, number>();
    const totalsByYear = new Map<string, number>();
    const weekdayTotals = Array.from({ length: 7 }, () => 0);
    const weekdaySuccess = Array.from({ length: 7 }, () => 0);
    const monthTotals = new Map<string, number>();
    const monthSuccess = new Map<string, number>();
    let earliestSession: Date | null = null;

    sessions.forEach((session) => {
      const raw = session.createdAt;
      if (!raw) return;
      const parsed = new Date(raw);
      if (Number.isNaN(parsed.getTime())) return;
      if (!earliestSession || parsed < earliestSession) {
        earliestSession = parsed;
      }
      const dayKey = toDateKey(parsed);
      const weekKey = getWeekStartKey(parsed);
      const monthKey = getMonthKey(parsed);
      const yearKey = getYearKey(parsed);
      const amount = habit.kind === "amount" ? session.amount ?? 0 : 1;
      totalsByDay.set(dayKey, (totalsByDay.get(dayKey) ?? 0) + amount);
      totalsByWeek.set(weekKey, (totalsByWeek.get(weekKey) ?? 0) + amount);
      totalsByMonth.set(monthKey, (totalsByMonth.get(monthKey) ?? 0) + amount);
      totalsByYear.set(yearKey, (totalsByYear.get(yearKey) ?? 0) + amount);
      weekdayTotals[parsed.getDay()] += amount;
      monthTotals.set(monthKey, (monthTotals.get(monthKey) ?? 0) + amount);
    });

    const isDaily = habit.period.toLowerCase().includes("day");
    const target = habit.count || 1;
    const successDayKeys = new Set<string>();
    const successWeekKeys = new Set<string>();

    totalsByDay.forEach((value, key) => {
      if (isDaily) {
        if (habit.kind === "amount" ? value >= target : value >= 1) {
          successDayKeys.add(key);
          const parsed = new Date(`${key}T00:00:00`);
          if (!Number.isNaN(parsed.getTime())) {
            weekdaySuccess[parsed.getDay()] += 1;
          }
        }
      } else if (value > 0) {
        successDayKeys.add(key);
      }
    });

    totalsByWeek.forEach((value, key) => {
      if (!isDaily) {
        if (habit.kind === "amount" ? value >= target : value >= 1) {
          successWeekKeys.add(key);
        }
      }
    });

    const startDate =
      habit.createdAt && !Number.isNaN(new Date(habit.createdAt).getTime())
        ? new Date(habit.createdAt)
        : earliestSession ?? new Date();
    startDate.setHours(0, 0, 0, 0);
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const yesterdayDate = new Date(todayDate);
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterdayKey = toDateKey(yesterdayDate);
    const todayKey = toDateKey(todayDate);

    const hasAnyLogToday = (totalsByDay.get(todayKey) ?? 0) > 0;
    const metricsEndDate = hasAnyLogToday ? todayDate : yesterdayDate;
    const metricsEndKey = hasAnyLogToday ? todayKey : yesterdayKey;

    const successMonths = new Set<string>();
    const successYears = new Set<string>();
    (isDaily ? successDayKeys : successWeekKeys).forEach((key) => {
      const parsed = new Date(`${key}T00:00:00`);
      if (Number.isNaN(parsed.getTime())) return;
      successMonths.add(getMonthKey(parsed));
      successYears.add(getYearKey(parsed));
      const mk = getMonthKey(parsed);
      monthSuccess.set(mk, (monthSuccess.get(mk) ?? 0) + 1);
    });

    const successDaysCount = successDayKeys.size;
    const successWeeksCount = successWeekKeys.size;
    const successMonthsCount = successMonths.size;
    const successYearsCount = successYears.size;

    const successDaysThroughEnd = Array.from(successDayKeys).filter(
      (key) => key <= metricsEndKey
    ).length;
    const successWeeksExcludingCurrent = Array.from(successWeekKeys).filter(
      (key) => {
        const weekStart = new Date(`${key}T00:00:00`);
        if (Number.isNaN(weekStart.getTime())) return false;
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);
        return weekEnd <= yesterdayDate;
      }
    ).length;

    const totalPeriods = isDaily
      ? countDaysBetween(startDate, metricsEndDate)
      : countWeeksBetween(startDate, yesterdayDate);
    const successPeriods = isDaily
      ? successDaysThroughEnd
      : successWeeksExcludingCurrent;
    const adherencePercent =
      totalPeriods > 0 ? Math.round((successPeriods / totalPeriods) * 100) : 0;

    const last365Start = new Date(metricsEndDate);
    last365Start.setDate(last365Start.getDate() - 364);
    const currentYearStart = new Date(metricsEndDate.getFullYear(), 0, 1);

    const totalLast365 = isDaily
      ? countDaysBetween(
          startDate > last365Start ? startDate : last365Start,
          metricsEndDate
        )
      : countWeeksBetween(
          startDate > last365Start ? startDate : last365Start,
          yesterdayDate
        );
    const totalCurrentYear = isDaily
      ? countDaysBetween(
          startDate > currentYearStart ? startDate : currentYearStart,
          metricsEndDate
        )
      : countWeeksBetween(
          startDate > currentYearStart ? startDate : currentYearStart,
          yesterdayDate
        );

    const successLast365 = isDaily
      ? countSuccessInRange(successDayKeys, last365Start, metricsEndDate)
      : (() => {
          let n = 0;
          successWeekKeys.forEach((key) => {
            const weekStart = new Date(`${key}T00:00:00`);
            if (Number.isNaN(weekStart.getTime())) return;
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            if (weekEnd >= last365Start && weekEnd <= yesterdayDate) n += 1;
          });
          return n;
        })();
    const successCurrentYear = isDaily
      ? countSuccessInRange(successDayKeys, currentYearStart, metricsEndDate)
      : (() => {
          let n = 0;
          successWeekKeys.forEach((key) => {
            const weekStart = new Date(`${key}T00:00:00`);
            if (Number.isNaN(weekStart.getTime())) return;
            const weekEnd = new Date(weekStart);
            weekEnd.setDate(weekEnd.getDate() + 6);
            if (weekEnd >= currentYearStart && weekEnd <= yesterdayDate) n += 1;
          });
          return n;
        })();

    const adherenceLast365 =
      totalLast365 > 0 ? Math.round((successLast365 / totalLast365) * 100) : 0;
    const adherenceCurrentYear =
      totalCurrentYear > 0 ? Math.round((successCurrentYear / totalCurrentYear) * 100) : 0;

    const currentWeekKey = getWeekStartKey(todayDate);
    const currentWeekSuccess = isDaily
      ? Array.from(successDayKeys).some((key) => {
          const parsed = new Date(`${key}T00:00:00`);
          if (Number.isNaN(parsed.getTime())) return false;
          return getWeekStartKey(parsed) === currentWeekKey;
        })
      : successWeekKeys.has(currentWeekKey);

    const last7 = last7Days.map((key) => totalsByDay.get(key) ?? 0);
    const sumLast7 = last7.reduce((acc, value) => acc + value, 0);

    return {
      habit,
      last7,
      sumLast7,
      activeStreak: getActiveStreak(isDaily, successDayKeys, successWeekKeys, metricsEndDate, todayDate),
      longestStreak: getLongestStreak(isDaily, successDayKeys, successWeekKeys, startDate, metricsEndDate, todayDate),
      adherencePercent,
      adherenceLast365,
      adherenceCurrentYear,
      currentWeekSuccess,
      weekdayTotals,
      weekdaySuccess,
      monthTotals,
      monthSuccess,
      successDaysCount,
      successWeeksCount,
      successMonthsCount,
      successYearsCount,
      totalsByDay,
      totalsByWeek,
      totalsByMonth,
      totalsByYear,
      isDaily,
      startDate,
      totalDays: countDaysBetween(startDate, metricsEndDate),
      totalWeeks: countWeeksBetween(startDate, metricsEndDate),
      totalMonths: countMonthsBetween(startDate, metricsEndDate),
      totalYears: countYearsBetween(startDate, metricsEndDate),
    };
  });
}
