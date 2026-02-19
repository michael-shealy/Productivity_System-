# 011 — User Onboarding System

## What Changed

Added self-service signup and a multi-step onboarding wizard that collects identity, goals, habits, and AI preferences for new users.

### New Features
1. **Signup on login page** — Toggle between sign-in and sign-up modes. New accounts redirect to `/onboarding`.
2. **Onboarding wizard** (`/onboarding`) — 8-step flow:
   - Welcome (system philosophy)
   - Identity Foundation (values, core values, life phase, busy day minimum, recovery approach)
   - Identity Dimensions (customize 5 daily check questions)
   - Goals (create 1-5 goals with domain/season)
   - Habits (create 1-10 habits with kind/frequency/target)
   - AI Preferences (tone + freeform context)
   - Integrations (Todoist/Google Calendar OAuth with session persistence)
   - Summary & Launch
3. **Onboarding gate** — Dashboard (`page.tsx`) checks `onboardingCompleted` preference. New users without goals are redirected to `/onboarding`. Existing users (who have goals) bypass the gate.
4. **Custom identity questions** — `IdentityCheck` component now accepts `customQuestions` prop, merging user-customized labels over defaults.
5. **AI personalization** — All AI routes (briefing, focus3, chat) now receive identity profile data (values, core values, life phase) and user-provided additional context.

### Data Layer Additions
- `loadIdentityProfile` / `saveIdentityProfile` — CRUD for `identity_profiles` table
- `createGoal` / `updateGoal` / `deleteGoal` — Goal CRUD with auto-generated slugs
- `createHabit` / `updateHabit` / `deleteHabit` — Habit CRUD
- `UserPreferences` expanded: `onboardingCompleted`, `identityQuestions`, `aiAdditionalContext`
- `IdentityQuestionConfig` type for custom identity check labels

### Bug Fix
- `loadUserPreferences` used `.single()` which throws `PGRST116` when no row exists (new users). Changed to `.maybeSingle()`.

## Key Concepts

### Multi-Step Wizard Pattern
The onboarding wizard is a single `"use client"` component with a `currentStep` state variable. Each step is a separate sub-component rendered via a switch statement. All data is held in React state and saved atomically when the user clicks "Launch Dashboard" on the final step.

**Why save everything at the end?** Progressive saves would require handling partial state (what if the user abandons mid-wizard?), and the atomicity means either all data is saved or none is — no orphaned records.

### OAuth Redirect Survival
When connecting Todoist or Google Calendar during onboarding, the OAuth flow redirects away from the app and back. The wizard saves its `currentStep` to `sessionStorage` before navigating to the OAuth URL. When the user returns, the onboarding gate redirects them back to `/onboarding`, which reads `sessionStorage` and resumes at the correct step.

**`sessionStorage` vs `localStorage`**: `sessionStorage` is scoped to the browser tab and cleared when the tab closes, making it ideal for transient wizard state that shouldn't persist across sessions.

### Onboarding Gate Strategy
Rather than modifying the Next.js middleware (which would add a DB query to every request), the gate runs client-side in the dashboard's init `useEffect`. It loads preferences and checks two conditions:
1. `onboardingCompleted !== true` in preferences
2. User has zero goals (to distinguish new users from existing users who predate the onboarding feature)

This avoids breaking existing users while ensuring new users get onboarded.

### Identity Profile Architecture
The `identity_profiles` table stores free-text fields (`values_document`, `busy_day_protocol`, `recovery_protocol`) and a JSONB `phase_metadata` column for structured data like `coreValues` and `currentPhase`. The protocols are stored as `{ text: "..." }` objects since the DB columns are typed as `jsonb`.

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/lib/supabase/types.ts` | Added `IdentityQuestionConfig`, expanded `UserPreferences` |
| `frontend/src/lib/supabase/data.ts` | Fixed `.single()` bug, expanded preferences, added identity/goal/habit CRUD |
| `frontend/src/app/login/page.tsx` | Added signup mode with confirm password |
| `frontend/src/app/onboarding/page.tsx` | **NEW** — 8-step onboarding wizard |
| `frontend/src/app/page.tsx` | Onboarding gate, load identity profile, pass to AI contexts |
| `frontend/src/components/IdentityCheck.tsx` | `customQuestions` prop for user-customized labels |
| `frontend/src/lib/ai.ts` | `IdentityProfileForAI` type, expanded request types and context builder |
| `frontend/src/lib/chat.ts` | Added identity profile and additional context to chat context |
| `frontend/src/app/api/ai/briefing/route.ts` | Identity profile sections in user prompt |
| `frontend/src/app/api/ai/focus3/route.ts` | Identity profile sections in user prompt |
| `frontend/src/components/ChatPanel.tsx` | New props for identity profile and additional context |
