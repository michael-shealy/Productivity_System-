"use client";

import { useEffect, useState } from "react";
import type { CalendarEventContract } from "@/lib/contracts";

type CalendarMonthViewProps = {
  monthDays: {
    year: number;
    month: number;
    daysInMonth: number;
    startOffset: number;
  };
  monthLabel: string;
  todayKey: string;
  eventsByDate: Map<string, CalendarEventContract[]>;
  googleCalendars: Array<{ id: string; name: string; primary: boolean }>;
  selectedCalendarIds: string[];
  setSelectedCalendarIds: (fn: (prev: string[]) => string[]) => void;
};

export default function CalendarMonthView({
  monthDays,
  monthLabel,
  todayKey,
  eventsByDate,
  googleCalendars,
  selectedCalendarIds,
  setSelectedCalendarIds,
}: CalendarMonthViewProps) {
  const [viewMode, setViewMode] = useState<"grid" | "list">(() => {
    if (typeof window === "undefined") return "grid";
    return (localStorage.getItem("calendarViewMode") as "grid" | "list") ?? "grid";
  });

  useEffect(() => {
    localStorage.setItem("calendarViewMode", viewMode);
  }, [viewMode]);

  // Build list of days with events for list view
  const daysWithEvents: Array<{ dateKey: string; dayNumber: number; events: CalendarEventContract[] }> = [];
  for (let i = 0; i < monthDays.daysInMonth; i++) {
    const dayNumber = i + 1;
    const dateKey = `${monthDays.year}-${String(monthDays.month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
    const events = eventsByDate.get(dateKey) ?? [];
    if (events.length > 0) {
      daysWithEvents.push({ dateKey, dayNumber, events });
    }
  }

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm backdrop-blur sm:p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold" style={{ textWrap: "balance" }}>Month view</h2>
        <div className="flex items-center gap-2">
          {/* Grid/List toggle — only visible on mobile */}
          <div className="flex rounded-full border border-zinc-700 bg-zinc-950/40 p-0.5 md:hidden">
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`rounded-full px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                viewMode === "grid"
                  ? "bg-indigo-500/20 text-indigo-200"
                  : "text-zinc-400"
              }`}
              aria-label="Grid view"
            >
              Grid
            </button>
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`rounded-full px-2.5 py-1 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                viewMode === "list"
                  ? "bg-indigo-500/20 text-indigo-200"
                  : "text-zinc-400"
              }`}
              aria-label="List view"
            >
              List
            </button>
          </div>
          <span className="text-xs text-zinc-400">{monthLabel}</span>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-zinc-300">
        <span className="font-semibold text-zinc-400">Calendars shown:</span>
        {googleCalendars.length === 0 && (
          <span className="text-zinc-400">No calendars loaded</span>
        )}
        {googleCalendars.map((calendar) => {
          const checked = selectedCalendarIds.includes(calendar.id);
          return (
            <label
              key={calendar.id}
              className={`flex items-center gap-2 rounded-full border px-2 py-1 ${
                checked
                  ? "border-indigo-700/50 bg-indigo-500/10 text-indigo-200"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-400"
              }`}
            >
              <input
                type="checkbox"
                checked={checked}
                onChange={() => {
                  setSelectedCalendarIds((prev: string[]) =>
                    prev.includes(calendar.id)
                      ? prev.filter((id: string) => id !== calendar.id)
                      : [...prev, calendar.id]
                  );
                }}
              />
              <span>{calendar.name}</span>
            </label>
          );
        })}
      </div>

      {/* Grid view — always shown on desktop, toggleable on mobile */}
      <div className={`${viewMode === "list" ? "hidden md:block" : ""}`}>
        <div className="mt-3 grid grid-cols-7 gap-1 text-sm text-zinc-400 sm:gap-2">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
            <span key={`${day}-${index}`} className="text-center font-semibold">
              {day}
            </span>
          ))}
        </div>
        {/* Horizontal scroll wrapper on mobile for grid */}
        <div className="mt-2 overflow-x-auto md:overflow-x-visible">
          <div className="grid min-w-[480px] grid-cols-7 gap-1 text-sm text-zinc-200 sm:gap-2 md:min-w-0">
            {Array.from({ length: monthDays.startOffset }).map((_, index) => (
              <div key={`empty-${index}`} className="h-16 sm:h-20" />
            ))}
            {Array.from({ length: monthDays.daysInMonth }).map((_, index) => {
              const dayNumber = index + 1;
              const dateKey = `${monthDays.year}-${String(monthDays.month + 1).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;
              const events = eventsByDate.get(dateKey) ?? [];
              const isToday = dateKey === todayKey;
              return (
                <div
                  key={dateKey}
                  className={`h-16 rounded-lg border px-1.5 py-1 sm:h-20 sm:px-2 ${
                    isToday
                      ? "border-indigo-700/60 bg-indigo-500/10"
                      : "border-zinc-800 bg-zinc-950/40"
                  }`}
                >
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="font-semibold tabular-nums">{dayNumber}</span>
                    {events.length > 0 && (
                      <span className="text-[10px] text-indigo-300 tabular-nums sm:text-xs">
                        {events.length}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 space-y-0.5 sm:mt-1 sm:space-y-1">
                    {events.slice(0, 2).map((event) => (
                      <div
                        key={event.id}
                        className="truncate text-[9px] text-zinc-300 sm:text-[10px]"
                        title={event.title}
                      >
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* List view — only on mobile when selected */}
      <div className={`mt-3 md:hidden ${viewMode === "grid" ? "hidden" : ""}`}>
        {daysWithEvents.length === 0 ? (
          <p className="text-sm text-zinc-400">No events this month.</p>
        ) : (
          <div className="space-y-2">
            {daysWithEvents.map(({ dateKey, events }) => {
              const date = new Date(`${dateKey}T12:00:00`);
              const dayLabel = date.toLocaleDateString([], {
                weekday: "short",
                month: "short",
                day: "numeric",
              });
              const isToday = dateKey === todayKey;
              return (
                <div
                  key={dateKey}
                  className={`rounded-lg border px-3 py-2 ${
                    isToday
                      ? "border-indigo-700/60 bg-indigo-500/10"
                      : "border-zinc-800 bg-zinc-950/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-zinc-200 tabular-nums">
                      {isToday ? "Today" : dayLabel}
                    </span>
                    <span className="text-xs text-indigo-300 tabular-nums">{events.length} event{events.length !== 1 ? "s" : ""}</span>
                  </div>
                  <div className="mt-1 space-y-1">
                    {events.map((event) => (
                      <div key={event.id} className="truncate text-xs text-zinc-300">
                        {event.title}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
