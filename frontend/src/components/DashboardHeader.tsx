"use client";

import type { WeatherData } from "@/lib/weather";

export type DashboardTab = "practice" | "tasks" | "patterns";

type DashboardHeaderProps = {
  activeTab: DashboardTab;
  setActiveTab: (tab: DashboardTab) => void;
  chatOpen: boolean;
  setChatOpen: (open: boolean | ((v: boolean) => boolean)) => void;
  handleLogout: () => void;
  resetMorningFlow: () => void;
  weatherData?: WeatherData | null;
  onChangeLocation?: () => void;
};

export default function DashboardHeader({
  activeTab,
  setActiveTab,
  chatOpen,
  setChatOpen,
  handleLogout,
  resetMorningFlow,
  weatherData,
  onChangeLocation,
}: DashboardHeaderProps) {
  const todayForecast = weatherData?.forecast?.[0];

  return (
    <>
      <header className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-400" style={{ textWrap: "balance" }}>
            Daily System
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setChatOpen((v: boolean) => !v)}
              className={`rounded-full border px-3 py-1.5 text-xs transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                chatOpen
                  ? "border-indigo-700 bg-indigo-900/30 text-indigo-300"
                  : "border-zinc-800 text-zinc-500 hover:text-zinc-300"
              }`}
              aria-label="Toggle chat panel"
            >
              Chat
            </button>
            <button
              type="button"
              onClick={handleLogout}
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-500 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Sign out
            </button>
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl" style={{ textWrap: "balance" }}>
          Morning Briefing + Plan
        </h1>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm text-zinc-400">
            Calm, goal-aligned, and ready for check-ins anytime today.
          </p>
          {weatherData && todayForecast && (
            <div className="flex shrink-0 items-center gap-1.5 text-sm text-zinc-300">
              <span>{weatherData.current.emoji}</span>
              <span className="font-medium">{weatherData.current.temperature}°F</span>
              <span className="text-xs text-zinc-500">
                H:{todayForecast.tempHigh}° L:{todayForecast.tempLow}°
              </span>
              {onChangeLocation && (
                <button
                  type="button"
                  onClick={onChangeLocation}
                  className="ml-1 text-xs text-zinc-600 hover:text-zinc-400"
                >
                  Change
                </button>
              )}
            </div>
          )}
        </div>
        {activeTab === "practice" && (
          <div>
            <button
              type="button"
              onClick={resetMorningFlow}
              className="rounded-full border border-zinc-800 px-3 py-1.5 text-xs text-zinc-300 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            >
              Reset morning flow
            </button>
          </div>
        )}
      </header>

      <div className="flex w-full items-center justify-start">
        <div className="inline-flex rounded-full border border-zinc-800 bg-zinc-950/40 p-1 text-sm">
          <button
            type="button"
            onClick={() => setActiveTab("practice")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              activeTab === "practice"
                ? "bg-indigo-500/20 text-indigo-200"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Practice
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tasks")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              activeTab === "tasks"
                ? "bg-emerald-500/20 text-emerald-200"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Tasks
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("patterns")}
            className={`rounded-full px-4 py-2 text-sm font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
              activeTab === "patterns"
                ? "bg-amber-500/20 text-amber-200"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            Patterns
          </button>
        </div>
      </div>
    </>
  );
}
