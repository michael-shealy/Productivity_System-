"use client";

type MorningFlowBannerProps = {
  morningFlowStatus: "idle" | "in_progress" | "complete";
  setMorningFlowStatus: (status: "idle" | "in_progress" | "complete") => void;
  morningFlowSteps: {
    briefing: boolean;
    focus: boolean;
    identity: boolean;
    habits: boolean;
  };
  setMorningFlowSteps: (fn: (prev: { briefing: boolean; focus: boolean; identity: boolean; habits: boolean }) => { briefing: boolean; focus: boolean; identity: boolean; habits: boolean }) => void;
  morningFlowStepCount: number;
  morningFlowTotalSteps: number;
  morningFlowComplete: boolean;
  scrollToSection: (id: string) => void;
};

export default function MorningFlowBanner({
  morningFlowStatus,
  setMorningFlowStatus,
  morningFlowSteps,
  setMorningFlowSteps,
  morningFlowStepCount,
  morningFlowTotalSteps,
  morningFlowComplete,
  scrollToSection,
}: MorningFlowBannerProps) {
  if (morningFlowStatus === "complete") return null;

  return (
    <section className="rounded-2xl border border-indigo-900/50 bg-zinc-900/90 p-4 shadow-sm backdrop-blur sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-indigo-300/80">
            Morning flow
          </p>
          <h2 className="text-lg font-semibold sm:text-xl" style={{ textWrap: "balance" }}>Begin your daily reset</h2>
          <p className="mt-1 text-sm text-zinc-300">
            Ground, choose focus, check identity, then log a minimum practice.
          </p>
        </div>
        <div className="rounded-full border border-indigo-800/60 bg-indigo-500/10 px-3 py-1 text-xs text-indigo-200 tabular-nums">
          {morningFlowStepCount}/{morningFlowTotalSteps} steps
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {morningFlowStatus === "idle" && (
          <button
            type="button"
            onClick={() => setMorningFlowStatus("in_progress")}
            className="rounded-full bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Start morning flow
          </button>
        )}
        {morningFlowStatus === "in_progress" && (
          <button
            type="button"
            onClick={() => setMorningFlowStatus("in_progress")}
            className="rounded-full border border-indigo-700/60 px-4 py-2.5 text-sm text-indigo-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Resume flow
          </button>
        )}
        {morningFlowStatus === "in_progress" && (
          <button
            type="button"
            onClick={() => {
              if (!morningFlowComplete) return;
              setMorningFlowStatus("complete");
            }}
            className={`rounded-full px-4 py-2.5 text-sm font-medium text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 ${
              morningFlowComplete
                ? "bg-emerald-500 hover:bg-emerald-400"
                : "bg-emerald-500/30 text-emerald-200"
            }`}
            disabled={!morningFlowComplete}
          >
            Mark flow complete
          </button>
        )}
      </div>
      {morningFlowStatus === "in_progress" && (
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {[
            {
              id: "briefing",
              label: "Read the morning briefing",
              helper: "Understand the day\u2019s constraints and values reminder.",
              target: "#morning-briefing",
            },
            {
              id: "focus",
              label: "Set Focus 3",
              helper: "Pick what matters most, not what is loudest.",
              target: "#focus-3",
            },
            {
              id: "identity",
              label: "Complete the identity check",
              helper: "3\u20135 checks is a strong day.",
              target: "#identity-check",
            },
            {
              id: "habits",
              label: "Log a minimum practice",
              helper: "Log one small habit check-in to keep momentum.",
              target: "#habit-checkin",
            },
          ].map((step) => {
            const isDone = morningFlowSteps[step.id as keyof typeof morningFlowSteps];
            return (
              <div
                key={step.id}
                className="rounded-xl border border-indigo-900/50 bg-indigo-500/10 px-3 py-3 text-sm text-indigo-100"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium">{step.label}</p>
                    <p className="mt-1 text-xs text-indigo-100/80">{step.helper}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setMorningFlowSteps((prev) => ({
                        ...prev,
                        [step.id]: !isDone,
                      }))
                    }
                    className={`min-h-[44px] min-w-[44px] rounded-full border px-3 py-2 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${
                      isDone
                        ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-100"
                        : "border-indigo-700/60 text-indigo-200"
                    }`}
                  >
                    {isDone ? "Done" : "Mark done"}
                  </button>
                </div>
                <div className="mt-2">
                  <button
                    type="button"
                    onClick={() => scrollToSection(step.target.replace("#", ""))}
                    className="text-xs text-indigo-200 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
                  >
                    Jump to section
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
