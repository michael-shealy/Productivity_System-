"use client";

import type { IdentityQuestionConfig } from "@/lib/supabase/types";

type IdentityMetrics = {
  morningGrounding: boolean;
  embodiedMovement: boolean;
  nutritionalAwareness: boolean;
  presentConnection: boolean;
  curiositySpark: boolean;
};

type IdentityCheckProps = {
  identityViewDateKey: string;
  setIdentityViewDateKey: (key: string) => void;
  identityViewActive: IdentityMetrics;
  identityViewScore: number;
  isIdentityViewToday: boolean;
  identityViewLoading: boolean;
  todayKey: string;
  toggleIdentityMetric: (key: string) => void;
  customQuestions?: IdentityQuestionConfig[];
};

const identityQuestions: Array<{
  key: keyof IdentityMetrics;
  label: string;
  helper: string;
}> = [
  {
    key: "morningGrounding",
    label: "Did I start my day connected to my values?",
    helper: "Morning grounding",
  },
  {
    key: "embodiedMovement",
    label: "Did I move in a way that felt good in my body?",
    helper: "Embodied movement",
  },
  {
    key: "nutritionalAwareness",
    label: "Did I make intentional food choices, even if imperfect?",
    helper: "Nutritional awareness",
  },
  {
    key: "presentConnection",
    label: "Did I have one moment of genuine presence?",
    helper: "Present connection",
  },
  {
    key: "curiositySpark",
    label: "Did one thing make me genuinely curious?",
    helper: "Curiosity spark",
  },
];

export { identityQuestions };
export type { IdentityMetrics };

export default function IdentityCheck({
  identityViewDateKey,
  setIdentityViewDateKey,
  identityViewActive,
  identityViewScore,
  isIdentityViewToday,
  identityViewLoading,
  todayKey,
  toggleIdentityMetric,
  customQuestions,
}: IdentityCheckProps) {
  // Merge custom labels over defaults (keep the same keys for DB mapping)
  const displayQuestions = customQuestions
    ? identityQuestions.map((def) => {
        const custom = customQuestions.find((c) => c.key === def.key);
        return custom ? { ...def, label: custom.label, helper: custom.helper } : def;
      })
    : identityQuestions;

  return (
    <section id="identity-check" className="rounded-2xl border border-indigo-900/40 bg-zinc-900/80 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold" style={{ textWrap: "balance" }}>Daily Identity Check</h2>
          <p className="text-sm text-zinc-300">
            Success is showing up as who you&apos;re becoming.
          </p>
        </div>
        <div className="rounded-full border border-indigo-900/50 bg-indigo-500/10 px-3 py-1 text-sm text-indigo-200 tabular-nums">
          {identityViewScore}/5{isIdentityViewToday ? " today" : ""}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-900/40 bg-zinc-950/40 px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
          Viewing
        </span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              const d = new Date(identityViewDateKey + "T12:00:00");
              d.setDate(d.getDate() - 1);
              setIdentityViewDateKey(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
              );
            }}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-indigo-800/60 bg-indigo-500/10 text-xs text-indigo-200 hover:bg-indigo-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Previous day"
          >
            &larr;
          </button>
          <span className="min-w-[8rem] text-center text-sm text-zinc-200">
            {isIdentityViewToday
              ? "Today"
              : new Date(identityViewDateKey + "T12:00:00").toLocaleDateString(
                  [],
                  {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  }
                )}
          </span>
          <button
            type="button"
            onClick={() => {
              const d = new Date(identityViewDateKey + "T12:00:00");
              d.setDate(d.getDate() + 1);
              setIdentityViewDateKey(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
              );
            }}
            disabled={identityViewDateKey >= todayKey}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded border border-indigo-800/60 bg-indigo-500/10 text-xs text-indigo-200 hover:bg-indigo-500/20 disabled:opacity-50 disabled:hover:bg-indigo-500/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Next day"
          >
            &rarr;
          </button>
        </div>
        {!isIdentityViewToday && (
          <button
            type="button"
            onClick={() => setIdentityViewDateKey(todayKey)}
            className="rounded bg-indigo-500/20 px-2 py-1 text-xs font-medium text-indigo-200 hover:bg-indigo-500/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Today
          </button>
        )}
        {identityViewLoading && (
          <span className="text-[11px] text-zinc-400">Loading...</span>
        )}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {displayQuestions.map((question) => {
          const isActive = identityViewActive[question.key];
          return (
            <button
              key={question.key}
              type="button"
              onClick={() => toggleIdentityMetric(question.key)}
              className={`min-h-[44px] rounded-xl border px-3 py-3 text-left text-sm transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                isActive
                  ? "border-indigo-700/60 bg-indigo-500/10 text-indigo-100"
                  : "border-zinc-800 bg-zinc-950/40 text-zinc-300 hover:border-indigo-800/60"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-medium">{question.label}</span>
                <span
                  className={`text-[11px] ${
                    isActive ? "text-indigo-200" : "text-zinc-500"
                  }`}
                >
                  {question.helper}
                </span>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-zinc-400">
        A strong day is 3&ndash;5 checks. Minimums still count.
      </p>
    </section>
  );
}
