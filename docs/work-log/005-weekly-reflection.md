# 005 — Weekly reflection (habit review loop)

## What Changed

Added the Week 3 habit review loop: a **Weekly reflection** section in the Practice tab that shows a habit summary and persists the four identity-focused reflection questions from CURRENT_STATE. Data is stored in a new `weekly_reflections` table and saved with debounced upserts.

**Update (Sunday-only, previous week):** The section is shown only on **Sundays**, or on other days if the user hasn’t filled out the reflection for the **previous week** (with a reminder: “You didn’t fill out last week’s reflection. Complete it below for the week of [date range].”). The reflection and all metrics (e.g. “Last week: X of Y practices touched”) always refer to the **previous week** (the week that just ended), not the current week in progress.

## Architecture

### New table: `weekly_reflections`

- **Migration**: `supabase/migrations/003_weekly_reflections.sql`
- Columns: `id`, `user_id`, `week_start_date` (date, Sunday-based), `what_went_well`, `what_mattered`, `learnings`, `capability_growth` (boolean, nullable), `created_at`, `updated_at`
- Unique on `(user_id, week_start_date)`. RLS restricts access to the owning user.
- Habit summary is **not** stored; it is computed at display time from existing `habit_sessions` and `habitStats` (same “this week” logic as the existing “Weekly practice review” box).

### Data layer

- **Types** ([frontend/src/lib/supabase/types.ts](frontend/src/lib/supabase/types.ts)): `DbWeeklyReflection` (DB row), `WeeklyReflection` (client shape with camelCase).
- **Data** ([frontend/src/lib/supabase/data.ts](frontend/src/lib/supabase/data.ts)):
  - `loadWeeklyReflection(supabase, userId, weekStartDate)` — fetches one row for that week or returns null.
  - `upsertWeeklyReflection(supabase, userId, weekStartDate, payload)` — insert or update the four content fields; uses `onConflict: "user_id,week_start_date"`.

Week boundary matches the rest of the app: `getWeekStartKey(date)` in `page.tsx` (Sunday = start of week).

### UI: Weekly reflection block

- **Visibility**: Shown only on **Sundays**, or on any day when the reflection for the **previous week** has not been filled out (reminder copy + same form).
- **Location**: Practice tab, after the “Weekly practice review” / “Minimums are valid” grid and before the habit cards.
- **Content**:
  - On Sunday: “Take a few minutes to reflect on the week that just ended (Sunday evening).”
  - On other days (reminder): “You didn’t fill out last week’s reflection. Complete it below for the week of [date range].”
  - Metrics use the **previous week** only: “Last week: X of Y practices touched.” (from `previousWeekHabitSummary`, computed from `habitStats` for the week starting `previousWeekKey`).
  - Four prompts (identity-framed, non-punitive):
    1. What went well? (textarea)
    2. What mattered? (textarea)
    3. Learnings? (textarea)
    4. Am I more capable than I was 7 days ago? (Yes / No radio; optional “Saving…” when debounce is in progress.)
- **State**: `weeklyReflection` (form values for the **previous** week being reflected on), `weeklyReflectionSaving` (boolean). `previousWeekKey` = week start of (current week start − 7 days). `isSunday` derived from `todayKey`; `previousWeekHabitSummary` computed from `habitStats` for that week.
- **Load**: On mount (and when `previousWeekKey` changes), set default empty reflection for the previous week, then fetch from Supabase and replace if a row exists. A ref (`weeklyReflectionSkipSaveRef`) prevents the initial set from triggering a save.
- **Save**: Debounced 600 ms after any change; calls `upsertWeeklyReflection(supabase, userId, weeklyReflection.weekStartDate, …)` so we always persist the reflection for the week that just ended.

## Key Concepts

**Habit review loop**: The “loop” is closed by usage: user opens Practice tab → sees habit check-in and weekly summary → fills the four questions → data is auto-saved. No separate “review due” notification in this implementation.

**Pattern-focused**: The new block uses calm, identity-focused copy (“What showed up for you?”, “What felt meaningful?”). Existing “Weekly practice review” and “Most consistent … last 365 days” are unchanged; no streak counts were added to habit cards.

## Files Changed

| File | Change |
|------|--------|
| `supabase/migrations/003_weekly_reflections.sql` | New table + RLS |
| `frontend/src/lib/supabase/types.ts` | `DbWeeklyReflection`, `WeeklyReflection` |
| `frontend/src/lib/supabase/data.ts` | `loadWeeklyReflection`, `upsertWeeklyReflection`, `UpsertWeeklyReflectionPayload` |
| `frontend/src/app/page.tsx` | State, load/save effects, Weekly reflection section (Sunday-only + previous-week metrics and reminder) |
| `docs/ideas/weekly-reflection-use-ideas.md` | Ideas for using reflection data to improve briefing, recovery, monthly review, and goals (not implemented) |
