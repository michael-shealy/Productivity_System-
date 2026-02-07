# 004 — AI-Driven Focus 3

## What Changed

Replaced the rule-based Focus 3 auto-selection with an AI-powered flow. Previously, the system just grabbed the first 3 tasks/events and showed them. Now, Claude Sonnet analyzes your full daily context — tasks, events, habits, identity metrics, goals, and their seasons — to propose 3 focus items with a reasoning explanation.

## Architecture

### New API Route: `/api/ai/focus3`

- **POST** endpoint that receives the day's context and returns 3 AI-selected items + reasoning
- Follows the same pattern as `/api/ai/briefing` — auth via `getRouteUser()`, Anthropic SDK, JSON parse + validate
- System prompt instructs the AI to consider goal seasons/phases, habit streaks, weekday patterns, identity gaps, and interconnections between items
- Uses the same identity-focused, non-punitive tone as the briefing

### State Machine

The Focus 3 section now operates as a 4-state machine:

```
loading → proposing → submitted ↔ editing
```

- **loading**: App just started, checking Supabase for today's saved Focus 3
- **proposing**: AI generated suggestions, shown in editable dropdowns with a submit button
- **submitted**: User locked in their Focus 3, shown as cards with reasoning text
- **editing**: User clicked "Edit" on a submitted Focus 3, dropdowns reappear

### Database Migration

Added `ai_reasoning` text column to `daily_focus3` table so the AI's explanation persists across page reloads.

### Dropdown UI

Each focus slot uses a `<select>` with `<optgroup>` sections grouping all available options (Tasks, Events, Habits, Identity). A "Custom..." option reveals a text input for write-in items.

## Key Concepts

**Server-side AI calls**: The Anthropic SDK runs only on the server (API route), not in the browser. The client just sends context via `fetch()` and receives JSON back. This keeps the API key secure.

**Structured AI output**: We tell the model to return exact JSON, then parse and validate it server-side. The `validateResponse` function ensures the response has the right shape even if the model gets creative with its output format.

**State machine pattern**: Instead of multiple booleans (`isEditing`, `isLoading`, `hasData`), a single `focus3Status` string with 4 possible values eliminates impossible states. You can't be both "editing" and "loading" simultaneously.

## Files Changed

| File | Change |
|------|--------|
| `frontend/src/app/api/ai/focus3/route.ts` | New AI endpoint |
| `frontend/src/lib/ai.ts` | Added `Focus3AIRequest` + `Focus3AIResponse` types |
| `frontend/src/lib/supabase/types.ts` | Added `ai_reasoning` to `DbDailyFocus3` |
| `frontend/src/lib/supabase/data.ts` | Updated `loadFocus3`/`saveFocus3` for reasoning |
| `frontend/src/app/page.tsx` | Replaced Focus 3 state, logic, and UI |
| `supabase/migrations/002_focus3_reasoning.sql` | Schema migration |
