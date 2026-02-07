# 006 — Richer AI briefing, Focus 3, and 4-week review

## What Changed

1. **Richer AI briefing and Focus 3**: The most recent weekly reflection (what went well, what mattered, learnings, capability growth) is now passed into both the morning briefing and Focus 3 API. The AI can reference it in the headline, insights, and Focus 3 reasoning so today’s plan connects to recent reflection.

2. **Gentle tone (persistent option)**: Users can choose "AI tone: Standard | Gentle" in the Practice tab (next to Morning Briefing). Gentle mode adds recovery-focused instructions: emphasize minimums when adherence was low, optionally cite "Last week you reflected that …", no guilt or deficit language. The choice is stored in a new `user_preferences` table and used for both briefing and Focus 3.

3. **Every-4-Sundays review**: On the 4th Sunday of each 4-Sunday cycle (epoch: 2026-01-05), a "4-Week review" block appears in the Practice tab. It shows the last 4 weekly reflections (what mattered, learnings), an optional "Which goal did this 4-week period best support?" dropdown (goals + None), and an optional "Anything to adjust in your systems?" text area. Selections are saved to `four_week_reviews` (one row per user per period).

## Architecture

### New tables

- **`user_preferences`** (migration 004): `user_id` (unique), `preferences` (jsonb, e.g. `{ "ai_tone": "standard" | "gentle" }`), `updated_at`. RLS: user can manage own row.
- **`four_week_reviews`** (migration 005): `user_id`, `period_end_date` (the Sunday that ends the 4-week block), `reflection_summary` (optional), `goal_id` (nullable FK to goals), `system_adjustment_notes` (optional), `created_at`, `updated_at`. Unique on `(user_id, period_end_date)`. RLS: user can manage own rows.

### Data layer

- **Reflections**: `loadLatestWeeklyReflection(supabase, userId)` — most recent reflection for AI context. `loadRecentWeeklyReflections(supabase, userId, limit)` — last N for 4-week review.
- **Preferences**: `loadUserPreferences(supabase, userId)`, `saveUserPreferences(supabase, userId, preferences)` — read/upsert `user_preferences`.
- **4-week review**: `loadFourWeekReview(supabase, userId, periodEndDate)`, `upsertFourWeekReview(supabase, userId, periodEndDate, payload)` — payload includes optional `goalId`, `systemAdjustmentNotes`, `reflectionSummary`.

### AI types and prompts

- **`AIBriefingRequest`** and **`Focus3AIRequest`** (in [frontend/src/lib/ai.ts](frontend/src/lib/ai.ts)) now accept optional `latestReflection` (weekStartDate, whatWentWell, whatMattered, learnings, capabilityGrowth) and `aiTone` ("standard" | "gentle").
- **Briefing route**: `buildUserPrompt` appends a "Latest weekly reflection (week of X): …" block when `ctx.latestReflection` is set. When `ctx.aiTone === "gentle"`, the system prompt adds recovery-focused instructions.
- **Focus 3 route**: Same: reflection block in user prompt; when gentle, system prompt adds instructions to weight "what mattered" and "learnings" and use recovery-friendly framing.

### Client

- **page.tsx**: Loads `latestWeeklyReflection` and `userPreferences` on mount. Passes them into `buildBriefingContext` and into the Focus 3 request body (via `focus3ContextRef`). AI tone toggle (Standard / Gentle) next to Morning Briefing saves via `saveUserPreferences`.
- **4-week review**: `isFourthSunday` is true when today is Sunday and `sundaysSinceEpoch % 4 === 0` (epoch 2026-01-05). When true, `periodEndDateForFourWeek = todayKey`; we load the last 4 reflections and the existing `four_week_reviews` row, then render the block with goal dropdown and system-adjustment notes. "Save 4-week review" calls `upsertFourWeekReview`.

## Key concepts

- **Richer context**: The briefing and Focus 3 already had goals, tasks, events, habits, identity score. Adding the latest reflection lets the model tie today’s suggestions to what the user recently said mattered and what they learned.
- **Gentle mode**: A single persisted preference that changes how both the briefing and Focus 3 are prompted (recovery-focused, minimums, no guilt). No automatic detection of "low adherence" in this implementation — the user opts in.
- **4-week cadence**: Fixed epoch (first Sunday of 2026) so "every 4 Sundays" is deterministic. The period is the four completed weeks ending on this Sunday; we store one optional goal and optional notes per period.

## Files changed

| File | Change |
|------|--------|
| `supabase/migrations/004_user_preferences.sql` | New table user_preferences |
| `supabase/migrations/005_four_week_reviews.sql` | New table four_week_reviews |
| `frontend/src/lib/supabase/types.ts` | UserPreferences, FourWeekReview, Db* types |
| `frontend/src/lib/supabase/data.ts` | loadLatestWeeklyReflection, loadRecentWeeklyReflections; load/saveUserPreferences; load/upsertFourWeekReview |
| `frontend/src/lib/ai.ts` | LatestReflectionForAI; AIBriefingRequest/Focus3AIRequest + latestReflection, aiTone; buildBriefingContext opts |
| `frontend/src/app/api/ai/briefing/route.ts` | Reflection block in user prompt; getSystemPrompt(aiTone) with gentle addendum |
| `frontend/src/app/api/ai/focus3/route.ts` | Reflection block in user prompt; getSystemPrompt(aiTone) with gentle addendum |
| `frontend/src/app/page.tsx` | latestWeeklyReflection, userPreferences state + load effects; pass into briefing + Focus 3; AI tone toggle; isFourthSunday, 4-week review block (load, goal picker, notes, save) |
