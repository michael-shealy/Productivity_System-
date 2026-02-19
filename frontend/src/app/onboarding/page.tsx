"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  loadUserPreferences,
  loadGoals,
  saveIdentityProfile,
  createGoal,
  createHabit,
  saveUserPreferences,
} from "@/lib/supabase/data";
import type { IdentityProfile, IdentityQuestionConfig, UserPreferences } from "@/lib/supabase/types";
import type { User } from "@supabase/supabase-js";

// ── Constants ────────────────────────────────────────────────────────

const TOTAL_STEPS = 8;
const STEP_LABELS = [
  "Welcome",
  "Identity",
  "Dimensions",
  "Goals",
  "Habits",
  "AI Preferences",
  "Integrations",
  "Launch",
];

const DEFAULT_IDENTITY_QUESTIONS: IdentityQuestionConfig[] = [
  { key: "morningGrounding", label: "Did I start my day connected to my values?", helper: "Morning grounding" },
  { key: "embodiedMovement", label: "Did I move in a way that felt good in my body?", helper: "Embodied movement" },
  { key: "nutritionalAwareness", label: "Did I make intentional food choices, even if imperfect?", helper: "Nutritional awareness" },
  { key: "presentConnection", label: "Did I have one moment of genuine presence?", helper: "Present connection" },
  { key: "curiositySpark", label: "Did one thing make me genuinely curious?", helper: "Curiosity spark" },
];

const SEASON_OPTIONS = ["building", "maintaining", "exploring", "resting"];

// ── Types ────────────────────────────────────────────────────────────

type GoalDraft = {
  title: string;
  domain: string;
  description: string;
  season: string;
};

type HabitDraft = {
  title: string;
  category: string;
  kind: "check" | "amount";
  frequency: "daily" | "weekly";
  targetCount: number;
};

// ── Component ────────────────────────────────────────────────────────

export default function OnboardingPage() {
  const router = useRouter();

  // Auth
  const supabaseRef = useRef(createClient());
  const [user, setUser] = useState<User | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  // Wizard state
  const [currentStep, setCurrentStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Step 2: Identity Foundation
  const [valuesDocument, setValuesDocument] = useState("");
  const [coreValues, setCoreValues] = useState<string[]>([""]);
  const [currentPhase, setCurrentPhase] = useState("");
  const [busyDayProtocol, setBusyDayProtocol] = useState("");
  const [recoveryProtocol, setRecoveryProtocol] = useState("");

  // Step 3: Identity Dimensions
  const [identityQuestions, setIdentityQuestions] = useState<IdentityQuestionConfig[]>(
    DEFAULT_IDENTITY_QUESTIONS.map((q) => ({ ...q }))
  );

  // Step 4: Goals
  const [goals, setGoals] = useState<GoalDraft[]>([
    { title: "", domain: "", description: "", season: "building" },
  ]);

  // Step 5: Habits
  const [habits, setHabits] = useState<HabitDraft[]>([
    { title: "", category: "", kind: "check", frequency: "daily", targetCount: 1 },
  ]);

  // Step 6: AI Preferences
  const [aiTone, setAiTone] = useState<"standard" | "gentle">("standard");
  const [aiAdditionalContext, setAiAdditionalContext] = useState("");

  // Step 7: Integrations
  const [todoistConnected, setTodoistConnected] = useState(false);
  const [googleConnected, setGoogleConnected] = useState(false);

  // ── Auth check + onboarding guard ──────────────────────────────────

  useEffect(() => {
    const sb = supabaseRef.current;

    async function checkAuth() {
      const { data: { user: authUser } } = await sb.auth.getUser();

      if (!authUser) {
        window.location.href = "/login";
        return;
      }
      setUser(authUser);

      // Already onboarded? Redirect to dashboard
      const [prefs, existingGoals] = await Promise.all([
        loadUserPreferences(sb, authUser.id),
        loadGoals(sb, authUser.id),
      ]);

      if (prefs?.onboardingCompleted === true || existingGoals.length > 0) {
        window.location.href = "/";
        return;
      }

      // Check for OAuth redirect resume
      const savedStep = sessionStorage.getItem("onboarding_step");
      if (savedStep) {
        const step = parseInt(savedStep, 10);
        if (step >= 0 && step < TOTAL_STEPS) {
          setCurrentStep(step);
        }
        sessionStorage.removeItem("onboarding_step");
      }

      // Check integration status
      const { data: tokens } = await sb
        .from("user_oauth_tokens")
        .select("provider")
        .eq("user_id", authUser.id);
      if (tokens) {
        for (const t of tokens) {
          if (t.provider === "todoist") setTodoistConnected(true);
          if (t.provider === "google") setGoogleConnected(true);
        }
      }

      setAuthChecked(true);
    }

    checkAuth();
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    setCurrentStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  }, []);

  const goBack = useCallback(() => {
    setCurrentStep((s) => Math.max(s - 1, 0));
  }, []);

  // ── Save all data on final step ────────────────────────────────────

  const handleLaunch = useCallback(async () => {
    const sb = supabaseRef.current;
    if (!user) return;
    setSaving(true);
    setSaveError(null);

    try {
      // 1. Save identity profile
      const profile: IdentityProfile = {
        valuesDocument: valuesDocument || null,
        busyDayProtocol: busyDayProtocol ? { text: busyDayProtocol } : null,
        recoveryProtocol: recoveryProtocol ? { text: recoveryProtocol } : null,
        comparisonProtocol: null,
        phaseMetadata: {
          currentPhase: currentPhase || null,
          coreValues: coreValues.filter((v) => v.trim()),
        },
      };
      await saveIdentityProfile(sb, user.id, profile);

      // 2. Create goals (skip empty ones)
      const validGoals = goals.filter((g) => g.title.trim());
      for (let i = 0; i < validGoals.length; i++) {
        await createGoal(sb, user.id, {
          title: validGoals[i].title.trim(),
          domain: validGoals[i].domain.trim() || "general",
          description: validGoals[i].description.trim(),
          season: validGoals[i].season,
        }, i);
      }

      // 3. Create habits (skip empty ones)
      const validHabits = habits.filter((h) => h.title.trim());
      for (const h of validHabits) {
        await createHabit(sb, user.id, {
          title: h.title.trim(),
          type: h.category.trim() || "general",
          kind: h.kind,
          count: h.targetCount,
          period: h.frequency,
        });
      }

      // 4. Save preferences with onboarding_completed
      const hasCustomQuestions = identityQuestions.some(
        (q, i) =>
          q.label !== DEFAULT_IDENTITY_QUESTIONS[i].label ||
          q.helper !== DEFAULT_IDENTITY_QUESTIONS[i].helper
      );

      const prefs: UserPreferences = {
        aiTone,
        onboardingCompleted: true,
        identityQuestions: hasCustomQuestions ? identityQuestions : undefined,
        aiAdditionalContext: aiAdditionalContext.trim() || undefined,
      };
      await saveUserPreferences(sb, user.id, prefs);

      // Redirect to dashboard
      router.push("/");
      router.refresh();
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save. Please try again.");
      setSaving(false);
    }
  }, [
    user, valuesDocument, busyDayProtocol, recoveryProtocol,
    currentPhase, coreValues, goals, habits, identityQuestions,
    aiTone, aiAdditionalContext, router,
  ]);

  // ── Loading state ──────────────────────────────────────────────────

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <p className="text-zinc-400 text-sm">Loading...</p>
      </div>
    );
  }

  // ── Step renderers ─────────────────────────────────────────────────

  const inputClass =
    "w-full rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-600 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500";
  const textareaClass = inputClass + " min-h-[80px] resize-y";
  const labelClass = "block text-sm font-medium text-zinc-300 mb-1";

  function renderStep() {
    switch (currentStep) {
      case 0:
        return <StepWelcome />;
      case 1:
        return (
          <StepIdentity
            valuesDocument={valuesDocument}
            setValuesDocument={setValuesDocument}
            coreValues={coreValues}
            setCoreValues={setCoreValues}
            currentPhase={currentPhase}
            setCurrentPhase={setCurrentPhase}
            busyDayProtocol={busyDayProtocol}
            setBusyDayProtocol={setBusyDayProtocol}
            recoveryProtocol={recoveryProtocol}
            setRecoveryProtocol={setRecoveryProtocol}
            inputClass={inputClass}
            textareaClass={textareaClass}
            labelClass={labelClass}
          />
        );
      case 2:
        return (
          <StepDimensions
            questions={identityQuestions}
            setQuestions={setIdentityQuestions}
            defaults={DEFAULT_IDENTITY_QUESTIONS}
            inputClass={inputClass}
            labelClass={labelClass}
          />
        );
      case 3:
        return (
          <StepGoals
            goals={goals}
            setGoals={setGoals}
            inputClass={inputClass}
            textareaClass={textareaClass}
            labelClass={labelClass}
          />
        );
      case 4:
        return (
          <StepHabits
            habits={habits}
            setHabits={setHabits}
            inputClass={inputClass}
            labelClass={labelClass}
          />
        );
      case 5:
        return (
          <StepAIPreferences
            aiTone={aiTone}
            setAiTone={setAiTone}
            aiAdditionalContext={aiAdditionalContext}
            setAiAdditionalContext={setAiAdditionalContext}
            textareaClass={textareaClass}
            labelClass={labelClass}
          />
        );
      case 6:
        return (
          <StepIntegrations
            todoistConnected={todoistConnected}
            googleConnected={googleConnected}
            onConnectTodoist={() => {
              sessionStorage.setItem("onboarding_step", String(currentStep));
              window.location.href = "/api/todoist/auth/start";
            }}
            onConnectGoogle={() => {
              sessionStorage.setItem("onboarding_step", String(currentStep));
              window.location.href = "/api/google/auth/start";
            }}
          />
        );
      case 7:
        return (
          <StepSummary
            goals={goals}
            habits={habits}
            valuesDocument={valuesDocument}
            aiTone={aiTone}
            todoistConnected={todoistConnected}
            googleConnected={googleConnected}
            identityQuestions={identityQuestions}
            defaults={DEFAULT_IDENTITY_QUESTIONS}
          />
        );
      default:
        return null;
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col">
      {/* Progress indicator */}
      <div className="border-b border-zinc-800 px-4 py-3">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-center justify-between gap-1">
            {STEP_LABELS.map((label, i) => (
              <div key={label} className="flex flex-1 flex-col items-center gap-1">
                <div
                  className={`h-1.5 w-full rounded-full transition-colors ${
                    i <= currentStep ? "bg-indigo-500" : "bg-zinc-800"
                  }`}
                />
                <span
                  className={`hidden text-[10px] sm:block ${
                    i === currentStep ? "text-indigo-300 font-medium" : "text-zinc-600"
                  }`}
                >
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-8">
        <div className="mx-auto max-w-2xl">{renderStep()}</div>
      </div>

      {/* Navigation */}
      <div className="border-t border-zinc-800 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <button
            type="button"
            onClick={goBack}
            disabled={currentStep === 0}
            className="rounded-md border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed"
          >
            Back
          </button>

          <span className="text-xs text-zinc-500">
            {currentStep + 1} / {TOTAL_STEPS}
          </span>

          {currentStep < TOTAL_STEPS - 1 ? (
            <button
              type="button"
              onClick={goNext}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              {currentStep === 0 ? "Get Started" : "Next"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => handleLaunch()}
              disabled={saving}
              className="rounded-md bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Saving..." : "Launch Dashboard"}
            </button>
          )}
        </div>
        {saveError && (
          <p className="mx-auto mt-2 max-w-2xl text-sm text-red-400">{saveError}</p>
        )}
      </div>
    </div>
  );
}

// ── Step Components ──────────────────────────────────────────────────

function StepWelcome() {
  return (
    <div className="space-y-6 text-center">
      <h1 className="text-3xl font-bold text-zinc-100">Welcome to Daily System</h1>
      <div className="mx-auto max-w-lg space-y-4 text-sm text-zinc-300">
        <p>
          This system is about <span className="text-indigo-300 font-medium">who you are becoming</span>,
          not what you produce.
        </p>
        <p>
          Instead of tracking productivity, you will track identity practices &mdash; the daily
          habits and rhythms that shape the person you want to be.
        </p>
        <div className="rounded-xl border border-indigo-900/40 bg-indigo-500/5 p-4 text-left">
          <h3 className="font-semibold text-indigo-200 mb-2">How this works</h3>
          <ul className="space-y-2 text-zinc-300">
            <li><span className="text-indigo-400 mr-1.5">1.</span> 70&ndash;80% adherence is the goal, not 100%</li>
            <li><span className="text-indigo-400 mr-1.5">2.</span> Minimums are legitimate, not failure states</li>
            <li><span className="text-indigo-400 mr-1.5">3.</span> Identity practices are separate from task lists</li>
            <li><span className="text-indigo-400 mr-1.5">4.</span> AI coaching is grounded in your data, never guilt</li>
          </ul>
        </div>
        <p className="text-zinc-400">
          The next steps will help personalize your experience. Every step is optional &mdash;
          skip anything you are not ready for yet.
        </p>
      </div>
    </div>
  );
}

function StepIdentity({
  valuesDocument, setValuesDocument,
  coreValues, setCoreValues,
  currentPhase, setCurrentPhase,
  busyDayProtocol, setBusyDayProtocol,
  recoveryProtocol, setRecoveryProtocol,
  inputClass, textareaClass, labelClass,
}: {
  valuesDocument: string;
  setValuesDocument: (v: string) => void;
  coreValues: string[];
  setCoreValues: (v: string[]) => void;
  currentPhase: string;
  setCurrentPhase: (v: string) => void;
  busyDayProtocol: string;
  setBusyDayProtocol: (v: string) => void;
  recoveryProtocol: string;
  setRecoveryProtocol: (v: string) => void;
  inputClass: string;
  textareaClass: string;
  labelClass: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Identity Foundation</h2>
        <p className="mt-1 text-sm text-zinc-400">
          These shape how the AI understands and supports you. All fields are optional.
        </p>
      </div>

      <div>
        <label className={labelClass}>Who are you becoming?</label>
        <p className="text-xs text-zinc-500 mb-2">
          Describe the person you are growing into. This is your north star.
        </p>
        <textarea
          value={valuesDocument}
          onChange={(e) => setValuesDocument(e.target.value)}
          className={textareaClass}
          placeholder="I am becoming someone who..."
          rows={4}
        />
      </div>

      <div>
        <label className={labelClass}>Core values (3-5)</label>
        <div className="space-y-2">
          {coreValues.map((val, i) => (
            <div key={i} className="flex gap-2">
              <input
                value={val}
                onChange={(e) => {
                  const next = [...coreValues];
                  next[i] = e.target.value;
                  setCoreValues(next);
                }}
                className={inputClass}
                placeholder={`Value ${i + 1}`}
              />
              {coreValues.length > 1 && (
                <button
                  type="button"
                  onClick={() => setCoreValues(coreValues.filter((_, j) => j !== i))}
                  className="rounded border border-zinc-700 px-2 text-xs text-zinc-400 hover:text-red-400 hover:border-red-800"
                >
                  Remove
                </button>
              )}
            </div>
          ))}
          {coreValues.length < 5 && (
            <button
              type="button"
              onClick={() => setCoreValues([...coreValues, ""])}
              className="text-xs text-indigo-400 hover:text-indigo-300"
            >
              + Add value
            </button>
          )}
        </div>
      </div>

      <div>
        <label className={labelClass}>Current life phase</label>
        <input
          value={currentPhase}
          onChange={(e) => setCurrentPhase(e.target.value)}
          className={inputClass}
          placeholder="e.g., Career transition, new parent, graduate school..."
        />
      </div>

      <div>
        <label className={labelClass}>Busy day minimum</label>
        <p className="text-xs text-zinc-500 mb-2">
          On your hardest days, what is the absolute minimum that still counts?
        </p>
        <textarea
          value={busyDayProtocol}
          onChange={(e) => setBusyDayProtocol(e.target.value)}
          className={textareaClass}
          placeholder="e.g., 5 minutes of movement, one glass of water, a single deep breath..."
          rows={2}
        />
      </div>

      <div>
        <label className={labelClass}>Recovery approach</label>
        <p className="text-xs text-zinc-500 mb-2">
          When you fall off track, how do you want to be supported?
        </p>
        <textarea
          value={recoveryProtocol}
          onChange={(e) => setRecoveryProtocol(e.target.value)}
          className={textareaClass}
          placeholder="e.g., Gentle reminders, no catch-up pressure, focus on minimums..."
          rows={2}
        />
      </div>
    </div>
  );
}

function StepDimensions({
  questions, setQuestions, defaults, inputClass, labelClass,
}: {
  questions: IdentityQuestionConfig[];
  setQuestions: (q: IdentityQuestionConfig[]) => void;
  defaults: IdentityQuestionConfig[];
  inputClass: string;
  labelClass: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Daily Identity Dimensions</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Each day you will reflect on 5 identity dimensions. Customize these to match
          your personal journey, or keep the defaults.
        </p>
      </div>

      {questions.map((q, i) => (
        <div key={q.key} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Dimension {i + 1}
            </span>
            {(q.label !== defaults[i].label || q.helper !== defaults[i].helper) && (
              <button
                type="button"
                onClick={() => {
                  const next = [...questions];
                  next[i] = { ...defaults[i] };
                  setQuestions(next);
                }}
                className="text-[10px] text-zinc-500 hover:text-zinc-300"
              >
                Reset to default
              </button>
            )}
          </div>
          <div>
            <label className={labelClass}>Question</label>
            <input
              value={q.label}
              onChange={(e) => {
                const next = [...questions];
                next[i] = { ...next[i], label: e.target.value };
                setQuestions(next);
              }}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Short label</label>
            <input
              value={q.helper}
              onChange={(e) => {
                const next = [...questions];
                next[i] = { ...next[i], helper: e.target.value };
                setQuestions(next);
              }}
              className={inputClass}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StepGoals({
  goals, setGoals, inputClass, textareaClass, labelClass,
}: {
  goals: GoalDraft[];
  setGoals: (g: GoalDraft[]) => void;
  inputClass: string;
  textareaClass: string;
  labelClass: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Your Goals</h2>
        <p className="mt-1 text-sm text-zinc-400">
          What are you working toward right now? Goals help the AI give relevant suggestions.
        </p>
      </div>

      {goals.map((goal, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Goal {i + 1}
            </span>
            {goals.length > 1 && (
              <button
                type="button"
                onClick={() => setGoals(goals.filter((_, j) => j !== i))}
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                Remove
              </button>
            )}
          </div>
          <div>
            <label className={labelClass}>Title</label>
            <input
              value={goal.title}
              onChange={(e) => {
                const next = [...goals];
                next[i] = { ...next[i], title: e.target.value };
                setGoals(next);
              }}
              className={inputClass}
              placeholder="e.g., Build a consistent exercise habit"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Domain</label>
              <input
                value={goal.domain}
                onChange={(e) => {
                  const next = [...goals];
                  next[i] = { ...next[i], domain: e.target.value };
                  setGoals(next);
                }}
                className={inputClass}
                placeholder="e.g., health, career, learning"
              />
            </div>
            <div>
              <label className={labelClass}>Season</label>
              <select
                value={goal.season}
                onChange={(e) => {
                  const next = [...goals];
                  next[i] = { ...next[i], season: e.target.value };
                  setGoals(next);
                }}
                className={inputClass}
              >
                {SEASON_OPTIONS.map((s) => (
                  <option key={s} value={s}>
                    {s.charAt(0).toUpperCase() + s.slice(1)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelClass}>Description</label>
            <textarea
              value={goal.description}
              onChange={(e) => {
                const next = [...goals];
                next[i] = { ...next[i], description: e.target.value };
                setGoals(next);
              }}
              className={textareaClass}
              placeholder="What does success look like?"
              rows={2}
            />
          </div>
        </div>
      ))}

      {goals.length < 5 && (
        <button
          type="button"
          onClick={() =>
            setGoals([...goals, { title: "", domain: "", description: "", season: "building" }])
          }
          className="rounded-md border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-400 hover:border-indigo-600 hover:text-indigo-300 w-full"
        >
          + Add another goal
        </button>
      )}
    </div>
  );
}

function StepHabits({
  habits, setHabits, inputClass, labelClass,
}: {
  habits: HabitDraft[];
  setHabits: (h: HabitDraft[]) => void;
  inputClass: string;
  labelClass: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Your Habits</h2>
        <p className="mt-1 text-sm text-zinc-400">
          What identity practices do you want to track? These are the rhythms that shape who you are.
        </p>
      </div>

      {habits.map((habit, i) => (
        <div key={i} className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Habit {i + 1}
            </span>
            {habits.length > 1 && (
              <button
                type="button"
                onClick={() => setHabits(habits.filter((_, j) => j !== i))}
                className="text-xs text-zinc-500 hover:text-red-400"
              >
                Remove
              </button>
            )}
          </div>
          <div>
            <label className={labelClass}>Title</label>
            <input
              value={habit.title}
              onChange={(e) => {
                const next = [...habits];
                next[i] = { ...next[i], title: e.target.value };
                setHabits(next);
              }}
              className={inputClass}
              placeholder="e.g., Morning meditation, Reading, Exercise"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Category</label>
              <input
                value={habit.category}
                onChange={(e) => {
                  const next = [...habits];
                  next[i] = { ...next[i], category: e.target.value };
                  setHabits(next);
                }}
                className={inputClass}
                placeholder="e.g., mindfulness, health"
              />
            </div>
            <div>
              <label className={labelClass}>Type</label>
              <div className="flex gap-2 mt-1">
                <button
                  type="button"
                  onClick={() => {
                    const next = [...habits];
                    next[i] = { ...next[i], kind: "check" };
                    setHabits(next);
                  }}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                    habit.kind === "check"
                      ? "border-indigo-600 bg-indigo-500/20 text-indigo-200"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  Check
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const next = [...habits];
                    next[i] = { ...next[i], kind: "amount" };
                    setHabits(next);
                  }}
                  className={`flex-1 rounded-md border px-3 py-2 text-sm transition ${
                    habit.kind === "amount"
                      ? "border-indigo-600 bg-indigo-500/20 text-indigo-200"
                      : "border-zinc-700 text-zinc-400 hover:border-zinc-600"
                  }`}
                >
                  Amount
                </button>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Frequency</label>
              <select
                value={habit.frequency}
                onChange={(e) => {
                  const next = [...habits];
                  next[i] = { ...next[i], frequency: e.target.value as "daily" | "weekly" };
                  setHabits(next);
                }}
                className={inputClass}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </div>
            <div>
              <label className={labelClass}>
                {habit.kind === "check" ? "Times per period" : "Target amount"}
              </label>
              <input
                type="number"
                min={1}
                value={habit.targetCount}
                onChange={(e) => {
                  const next = [...habits];
                  next[i] = { ...next[i], targetCount: Math.max(1, parseInt(e.target.value, 10) || 1) };
                  setHabits(next);
                }}
                className={inputClass}
              />
            </div>
          </div>
        </div>
      ))}

      {habits.length < 10 && (
        <button
          type="button"
          onClick={() =>
            setHabits([
              ...habits,
              { title: "", category: "", kind: "check", frequency: "daily", targetCount: 1 },
            ])
          }
          className="rounded-md border border-dashed border-zinc-700 px-4 py-3 text-sm text-zinc-400 hover:border-indigo-600 hover:text-indigo-300 w-full"
        >
          + Add another habit
        </button>
      )}
    </div>
  );
}

function StepAIPreferences({
  aiTone, setAiTone,
  aiAdditionalContext, setAiAdditionalContext,
  textareaClass, labelClass,
}: {
  aiTone: "standard" | "gentle";
  setAiTone: (v: "standard" | "gentle") => void;
  aiAdditionalContext: string;
  setAiAdditionalContext: (v: string) => void;
  textareaClass: string;
  labelClass: string;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">AI Preferences</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Your AI coach generates daily morning briefings, selects focus items, and offers
          guidance through chat. These settings shape its personality.
        </p>
      </div>

      <div>
        <label className={labelClass}>Coaching tone</label>
        <div className="flex gap-3 mt-1">
          <button
            type="button"
            onClick={() => setAiTone("standard")}
            className={`flex-1 rounded-xl border p-4 text-left transition ${
              aiTone === "standard"
                ? "border-indigo-600 bg-indigo-500/10"
                : "border-zinc-700 hover:border-zinc-600"
            }`}
          >
            <div className="font-medium text-sm text-zinc-100">Standard</div>
            <div className="text-xs text-zinc-400 mt-1">
              Encouraging and direct. Celebrates progress while gently noting patterns.
            </div>
          </button>
          <button
            type="button"
            onClick={() => setAiTone("gentle")}
            className={`flex-1 rounded-xl border p-4 text-left transition ${
              aiTone === "gentle"
                ? "border-indigo-600 bg-indigo-500/10"
                : "border-zinc-700 hover:border-zinc-600"
            }`}
          >
            <div className="font-medium text-sm text-zinc-100">Gentle</div>
            <div className="text-xs text-zinc-400 mt-1">
              Recovery-focused. Extra warmth, emphasis on minimums, no catch-up pressure.
            </div>
          </button>
        </div>
      </div>

      <div>
        <label className={labelClass}>Anything else the AI should know about you?</label>
        <p className="text-xs text-zinc-500 mb-2">
          Context that helps the AI give better advice &mdash; health conditions, schedule
          constraints, preferences, things you are working through.
        </p>
        <textarea
          value={aiAdditionalContext}
          onChange={(e) => setAiAdditionalContext(e.target.value)}
          className={textareaClass}
          placeholder="e.g., I work night shifts, I'm recovering from an injury, mornings are my most productive time..."
          rows={4}
        />
      </div>
    </div>
  );
}

function StepIntegrations({
  todoistConnected, googleConnected,
  onConnectTodoist, onConnectGoogle,
}: {
  todoistConnected: boolean;
  googleConnected: boolean;
  onConnectTodoist: () => void;
  onConnectGoogle: () => void;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-zinc-100">Integrations</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Connect your tools to bring tasks and calendar events into the dashboard.
          You can always do this later from settings.
        </p>
      </div>

      <div className="space-y-3">
        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-zinc-100">Todoist</div>
            <div className="text-xs text-zinc-400">Import and manage your tasks</div>
          </div>
          {todoistConnected ? (
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">
              Connected
            </span>
          ) : (
            <button
              type="button"
              onClick={onConnectTodoist}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Connect
            </button>
          )}
        </div>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4 flex items-center justify-between">
          <div>
            <div className="font-medium text-sm text-zinc-100">Google Calendar</div>
            <div className="text-xs text-zinc-400">View and create calendar events</div>
          </div>
          {googleConnected ? (
            <span className="rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">
              Connected
            </span>
          ) : (
            <button
              type="button"
              onClick={onConnectGoogle}
              className="rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500"
            >
              Connect
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function StepSummary({
  goals, habits, valuesDocument, aiTone,
  todoistConnected, googleConnected,
  identityQuestions, defaults,
}: {
  goals: GoalDraft[];
  habits: HabitDraft[];
  valuesDocument: string;
  aiTone: "standard" | "gentle";
  todoistConnected: boolean;
  googleConnected: boolean;
  identityQuestions: IdentityQuestionConfig[];
  defaults: IdentityQuestionConfig[];
}) {
  const validGoals = goals.filter((g) => g.title.trim());
  const validHabits = habits.filter((h) => h.title.trim());
  const hasCustomQuestions = identityQuestions.some(
    (q, i) => q.label !== defaults[i].label || q.helper !== defaults[i].helper
  );

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-zinc-100">Ready to Launch</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Here is a summary of your setup. You can go back to adjust anything.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <SummaryCard
          label="Identity"
          value={valuesDocument ? "Values statement set" : "Skipped"}
          ok={!!valuesDocument}
        />
        <SummaryCard
          label="Dimensions"
          value={hasCustomQuestions ? "Customized" : "Using defaults"}
          ok
        />
        <SummaryCard
          label="Goals"
          value={validGoals.length > 0 ? `${validGoals.length} goal${validGoals.length > 1 ? "s" : ""}` : "None yet"}
          ok={validGoals.length > 0}
        />
        <SummaryCard
          label="Habits"
          value={validHabits.length > 0 ? `${validHabits.length} habit${validHabits.length > 1 ? "s" : ""}` : "None yet"}
          ok={validHabits.length > 0}
        />
        <SummaryCard
          label="AI Tone"
          value={aiTone === "gentle" ? "Gentle" : "Standard"}
          ok
        />
        <SummaryCard
          label="Todoist"
          value={todoistConnected ? "Connected" : "Not connected"}
          ok={todoistConnected}
        />
        <SummaryCard
          label="Google Calendar"
          value={googleConnected ? "Connected" : "Not connected"}
          ok={googleConnected}
        />
      </div>

      <p className="text-center text-xs text-zinc-500">
        Click &ldquo;Launch Dashboard&rdquo; to save everything and start using your system.
      </p>
    </div>
  );
}

function SummaryCard({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-3 flex items-center justify-between">
      <span className="text-sm text-zinc-300">{label}</span>
      <span className={`text-xs ${ok ? "text-emerald-400" : "text-zinc-500"}`}>{value}</span>
    </div>
  );
}
