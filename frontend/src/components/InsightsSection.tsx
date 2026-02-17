"use client";

type Insight = {
  id: string;
  title: string;
  body: string;
  why: string[];
};

type InsightsSectionProps = {
  aiBriefingInsights: Insight[] | undefined;
  practiceInsights: Insight[];
  onRefreshInsights?: () => void;
  insightsLoading?: boolean;
};

export default function InsightsSection({
  aiBriefingInsights,
  practiceInsights,
  onRefreshInsights,
  insightsLoading,
}: InsightsSectionProps) {
  const displayInsights = aiBriefingInsights ?? practiceInsights;

  return (
    <section className="rounded-2xl border border-indigo-900/40 bg-zinc-900/80 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold" style={{ textWrap: "balance" }}>Insights</h2>
          <p className="text-sm text-zinc-300">
            Calm, explainable nudges tied to your identity practices.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full border border-indigo-900/50 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200">
            {aiBriefingInsights ? "AI-assisted" : "Explainable only"}
          </span>
          {onRefreshInsights && (
            <button
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onRefreshInsights();
              }}
              disabled={insightsLoading}
              aria-label="Refresh insights"
              className="rounded-full border border-indigo-900/60 px-3 py-1 text-xs text-indigo-100 hover:text-white disabled:opacity-60"
            >
              {insightsLoading ? "Refreshing..." : "Refresh insights"}
            </button>
          )}
        </div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        {displayInsights.length === 0 ? (
          <div className="rounded-xl border border-dashed border-indigo-900/60 bg-zinc-950/40 px-3 py-3 text-sm text-zinc-400">
            No insights yet. Add a few check-ins to activate suggestions.
          </div>
        ) : (
          displayInsights.map((insight) => (
            <div
              key={insight.id}
              className="rounded-xl border border-indigo-900/50 bg-indigo-500/10 px-3 py-3 text-sm text-indigo-100"
            >
              <p className="font-medium">{insight.title}</p>
              <p className="mt-1 text-xs text-indigo-100/80">{insight.body}</p>
              <div className="mt-2 rounded-lg border border-indigo-900/60 bg-zinc-950/40 px-2 py-2 text-[11px] text-zinc-300">
                <p className="font-semibold text-indigo-200">Why this</p>
                <ul className="mt-1 space-y-1">
                  {insight.why.map((reason, index) => (
                    <li key={`${insight.id}-why-${index}`}>{reason}</li>
                  ))}
                </ul>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
