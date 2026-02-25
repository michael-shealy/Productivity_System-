# 013 — AI Persistent Memory & Longitudinal Pattern Intelligence

## What Was Done

Added a persistent "observation ledger" where the AI records pattern insights at tiered frequencies, consolidates them over time, and injects the most relevant ones into every AI prompt. A new "Patterns" tab provides visibility into what the AI has noticed.

### Key Changes

1. **Database**: New `ai_observations` table (`supabase/migrations/009_ai_observations.sql`) with RLS policies. Stores compact interpretive text (~300 bytes/observation) referencing existing data by ID. Hard cap of 200 active rows per user (~60KB ceiling).

2. **Types**: Added `AIObservation`, `ObservationScope`, `ObservationCategory`, `AnalysisDepth`, `DismissReason`, `EntityRef` types to `supabase/types.ts`.

3. **Data Layer**: 10+ new CRUD functions in `data.ts` for loading, inserting, dismissing, undismissing, superseding, pruning, and querying observations. Also added `loadIdentityMetricsRange` for fetching historical identity metric rows.

4. **Analysis Pipeline** (`lib/ai-observations.ts`): New file implementing tiered analysis:
   - **7-day** (daily): Short-term patterns from last week's identity metrics + habit stats
   - **30-day** (every ~5 days): Medium-term trends with 4 recent reflections
   - **Full** (every ~2 weeks): Deep identity evolution from all-time data
   - Consolidation logic: daily observations → weekly summaries → quarterly summaries
   - Dismissed observations are fed back to the AI with their correction reasons

5. **Briefing Route**: Modified to run the observation pipeline before generating each briefing. Observations are injected as a "Longitudinal patterns" section in the briefing prompt. Non-blocking — pipeline failures don't break briefing generation.

6. **Chat Integration**: Added `aiObservations` to `ChatContext` type and `buildChatContextMessage`. Up to 8 active observations injected as "AI memory" section.

7. **Focus 3 Integration**: Added `aiObservations` to `Focus3AIRequest` type. Up to 3 relevant observations (filtered to `habit_trend` + `identity_pattern` categories) injected into the Focus 3 prompt.

8. **Patterns Tab**: Third tab alongside Practice/Tasks in `DashboardHeader` with amber color scheme. New `PatternsPanel` component showing:
   - Active observations grouped by category with colored badges
   - Confidence dots (1-5), analysis depth labels, date + age
   - Dismiss flow with required reason (intentional/outdated/incorrect) + optional note
   - Collapsed dismissed section with restore option

9. **page.tsx Wiring**: New `aiObservations` state, loaded in init effect, refreshed after briefing generation, passed to ChatPanel and Focus 3 request. Dismiss/undismiss handlers with optimistic local state updates.

## Concepts

### Tiered Analysis
Instead of running one expensive AI call analyzing all history every day, the system uses three tiers. Daily analysis is cheap (~$0.003) and catches short-term patterns. Deeper analysis runs less frequently and examines longer time windows. This keeps API costs at ~$0.15/month per user.

### Consolidation
Over time, daily observations get synthesized into weekly summaries, and old weekly summaries into quarterly observations. The original rows are "superseded" (not deleted — still visible in the Patterns tab). This natural compression keeps the active observation count at ~40-60 instead of growing unboundedly.

### Dismissed Observation Feedback
When a user dismisses an observation with a reason ("intentional", "outdated", "incorrect"), that correction is fed back into the next analysis prompt. This teaches the AI: if Monday movement gaps are dismissed as "intentional", the AI learns not to flag them again. Dismissed corrections expire from the analysis context after 30 days.

### Ref Pattern for Effect Dependencies
When an `aiObservations` array is used inside a `useEffect` that should only re-trigger on specific conditions (not on every state change), a `useRef` captures the latest value without adding it to the dependency array. This is the same pattern already used by `focus3ContextRef` in the codebase.

## API Cost Estimate

| Tier | Frequency | Per-call cost | Monthly cost |
|------|-----------|--------------|-------------|
| 7-day | Daily | ~$0.003 | ~$0.09 |
| 30-day | Every 5 days | ~$0.006 | ~$0.04 |
| Full | Every 2 weeks | ~$0.01 | ~$0.02 |
| **Total** | | | **~$0.15/month** |

## Files Changed

- `supabase/migrations/009_ai_observations.sql` (new)
- `frontend/src/lib/supabase/types.ts`
- `frontend/src/lib/supabase/data.ts`
- `frontend/src/lib/ai-observations.ts` (new)
- `frontend/src/lib/ai.ts`
- `frontend/src/lib/chat.ts`
- `frontend/src/app/api/ai/briefing/route.ts`
- `frontend/src/app/api/ai/focus3/route.ts`
- `frontend/src/components/DashboardHeader.tsx`
- `frontend/src/components/PatternsPanel.tsx` (new)
- `frontend/src/components/ChatPanel.tsx`
- `frontend/src/app/page.tsx`

## Next Steps

1. Run the migration SQL in Supabase dashboard
2. Generate a briefing to test observation creation
3. Verify the Patterns tab shows observations
4. Test dismiss/undismiss flow
5. After 5+ days, verify 30-day analysis runs automatically
