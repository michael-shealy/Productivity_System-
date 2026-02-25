"use client";

import { useState } from "react";
import type { AIObservation, DismissReason, ObservationCategory } from "@/lib/supabase/types";

type PatternsPanelProps = {
  observations: AIObservation[];
  onDismiss: (id: string, reason: DismissReason, note?: string) => void;
  onUndismiss: (id: string) => void;
};

const CATEGORY_COLORS: Record<ObservationCategory, { bg: string; text: string; border: string }> = {
  habit_trend: { bg: "bg-indigo-500/15", text: "text-indigo-300", border: "border-indigo-700/40" },
  identity_pattern: { bg: "bg-violet-500/15", text: "text-violet-300", border: "border-violet-700/40" },
  schedule_insight: { bg: "bg-cyan-500/15", text: "text-cyan-300", border: "border-cyan-700/40" },
  reflection_theme: { bg: "bg-rose-500/15", text: "text-rose-300", border: "border-rose-700/40" },
  energy_pattern: { bg: "bg-amber-500/15", text: "text-amber-300", border: "border-amber-700/40" },
  growth_signal: { bg: "bg-emerald-500/15", text: "text-emerald-300", border: "border-emerald-700/40" },
  task_trend: { bg: "bg-sky-500/15", text: "text-sky-300", border: "border-sky-700/40" },
};

const CATEGORY_LABELS: Record<ObservationCategory, string> = {
  habit_trend: "Habit Trend",
  identity_pattern: "Identity Pattern",
  schedule_insight: "Schedule Insight",
  reflection_theme: "Reflection Theme",
  energy_pattern: "Energy Pattern",
  growth_signal: "Growth Signal",
  task_trend: "Task Trend",
};

const SCOPE_LABELS: Record<string, string> = {
  daily: "Daily",
  weekly: "Weekly",
  quarterly: "Quarterly",
};

const DEPTH_LABELS: Record<string, string> = {
  "7day": "7-day",
  "30day": "30-day",
  full: "Full",
};

function formatAge(dateRef: string): string {
  const ref = new Date(dateRef + "T12:00:00");
  const now = new Date();
  const days = Math.floor((now.getTime() - ref.getTime()) / (1000 * 60 * 60 * 24));
  if (days === 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

function ConfidenceLabel({ confidence }: { confidence: number }) {
  if (confidence >= 4) {
    return <span className="text-xs text-amber-400">High confidence</span>;
  }
  if (confidence === 3) {
    return <span className="text-xs text-zinc-400">Moderate</span>;
  }
  return <span className="text-xs text-zinc-500">Low confidence</span>;
}

function DismissForm({
  onConfirm,
  onCancel,
}: {
  onConfirm: (reason: DismissReason, note?: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState<DismissReason | null>(null);
  const [note, setNote] = useState("");

  return (
    <div className="mt-3 space-y-2 rounded-lg border border-zinc-700 bg-zinc-900/60 p-3">
      <p className="text-xs font-medium text-zinc-300">Why is this observation off?</p>
      <div className="flex flex-wrap gap-2">
        {(["intentional", "outdated", "incorrect"] as DismissReason[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setReason(r)}
            className={`rounded-full border px-3 py-1 text-xs transition ${
              reason === r
                ? "border-amber-600 bg-amber-500/20 text-amber-200"
                : "border-zinc-700 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {r === "intentional" ? "Intentional choice" : r === "outdated" ? "Outdated" : "Incorrect"}
          </button>
        ))}
      </div>
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Optional note..."
        className="w-full rounded-lg border border-zinc-700 bg-zinc-950/40 px-3 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-600"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={!reason}
          onClick={() => reason && onConfirm(reason, note || undefined)}
          className="rounded-full border border-amber-700 bg-amber-500/20 px-3 py-1 text-xs text-amber-200 transition hover:bg-amber-500/30 disabled:opacity-40"
        >
          Confirm
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-full border border-zinc-700 px-3 py-1 text-xs text-zinc-400 transition hover:text-zinc-200"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export default function PatternsPanel({ observations, onDismiss, onUndismiss }: PatternsPanelProps) {
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);

  const active = observations.filter((o) => !o.dismissed);
  const dismissed = observations.filter((o) => o.dismissed);

  // Group active by category
  const grouped = new Map<ObservationCategory, AIObservation[]>();
  for (const obs of active) {
    const cat = obs.category as ObservationCategory;
    if (!grouped.has(cat)) grouped.set(cat, []);
    grouped.get(cat)!.push(obs);
  }

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-zinc-100">Patterns</h2>
        <p className="mt-1 text-sm text-zinc-400">
          What the AI has noticed about your trajectory
        </p>
        <p className="mt-1 text-xs text-zinc-500">
          {active.length} active observation{active.length !== 1 ? "s" : ""}
          {dismissed.length > 0 && ` · ${dismissed.length} dismissed`}
        </p>
      </div>

      {active.length === 0 && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 text-center">
          <p className="text-sm text-zinc-400">
            No patterns observed yet. Generate a morning briefing to start building AI memory.
          </p>
        </div>
      )}

      {Array.from(grouped.entries()).map(([category, obs]) => {
        const colors = CATEGORY_COLORS[category] ?? CATEGORY_COLORS.growth_signal;
        return (
          <div key={category} className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`rounded-full ${colors.bg} ${colors.text} border ${colors.border} px-2.5 py-0.5 text-xs font-medium`}>
                {CATEGORY_LABELS[category] ?? category}
              </span>
              <span className="text-xs text-zinc-500">{obs.length}</span>
            </div>

            <div className="space-y-2">
              {obs.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-zinc-800 bg-zinc-900/80 p-4 shadow-sm backdrop-blur"
                >
                  <p className="text-sm text-zinc-200">{o.observation}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                    <span>{o.dateRef} · {formatAge(o.dateRef)}</span>
                    <ConfidenceLabel confidence={o.confidence} />
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                      {DEPTH_LABELS[o.analysisDepth] ?? o.analysisDepth}
                    </span>
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                      {SCOPE_LABELS[o.scope] ?? o.scope}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDismissingId(dismissingId === o.id ? null : o.id)}
                      className={`transition ${
                        dismissingId === o.id
                          ? "text-red-400"
                          : "text-zinc-500 hover:text-red-400"
                      }`}
                    >
                      This doesn&apos;t sound right
                    </button>
                  </div>
                  {dismissingId === o.id && (
                    <DismissForm
                      onConfirm={(reason, note) => {
                        onDismiss(o.id, reason, note);
                        setDismissingId(null);
                      }}
                      onCancel={() => setDismissingId(null)}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {dismissed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowDismissed(!showDismissed)}
            className="text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            {showDismissed ? "Hide" : "Show"} dismissed observations ({dismissed.length})
          </button>

          {showDismissed && (
            <div className="mt-3 space-y-2">
              {dismissed.map((o) => (
                <div
                  key={o.id}
                  className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 p-4 opacity-60"
                >
                  <p className="text-sm text-zinc-400 line-through">{o.observation}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-600">
                    <span className="rounded-full border border-zinc-700 px-2 py-0.5">
                      {o.dismissReason === "intentional" ? "Intentional choice" : o.dismissReason === "outdated" ? "Outdated" : "Incorrect"}
                    </span>
                    {o.dismissNote && <span>&ldquo;{o.dismissNote}&rdquo;</span>}
                    <button
                      type="button"
                      onClick={() => onUndismiss(o.id)}
                      className="text-zinc-500 transition hover:text-amber-400"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
