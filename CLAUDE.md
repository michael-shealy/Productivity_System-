# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal productivity system that unifies tasks (Todoist), calendar (Google Calendar), habit tracking, and AI-powered daily briefings into a single identity-focused dashboard. The core design principle is **identity-based measurement over productivity-based measurement** — identity practices (morning ritual, exercise, learning) must be visually and functionally separated from operational tasks (homework, errands, deadlines).

## Commands

All commands run from the `frontend/` directory:

```bash
cd frontend
npm run dev      # Start dev server (Next.js on localhost:3000)
npm run build    # Production build
npm run lint     # ESLint
npm run start    # Start production server
```

There are no test scripts configured yet.

## Environment Setup

Copy `frontend/.env.example` to `frontend/.env.local` and fill in:
- `TODOIST_CLIENT_ID` / `TODOIST_CLIENT_SECRET` — Todoist OAuth app credentials
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — Google OAuth app credentials
- `ANTHROPIC_API_KEY` — for AI briefing generation (uses Claude Sonnet 4.5)

## Architecture

### Stack
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + TypeScript
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`) — server-side only via API route
- **Auth**: OAuth tokens stored in cookies (Todoist, Google) — no Supabase yet
- **State**: All client state lives in `page.tsx` via `useState` — no state management library
- **Data persistence**: localStorage for habits cache and AI briefing cache; no database yet

### Key Architectural Decisions

**Single-page app**: The entire dashboard is a single `"use client"` component at `frontend/src/app/page.tsx`. All UI state (tasks, events, habits, identity metrics, morning flow, focus3) is managed here with React hooks. This file is very large.

**Data contracts layer** (`frontend/src/lib/contracts.ts`): Normalizer functions (`normalizeTodoistTask`, `normalizeGoogleEvent`) convert external API shapes into internal `TaskContract` and `CalendarEventContract` types. All API routes return normalized data.

**Dual-view architecture**: The UI has two tabs — "Practice" (identity/habits) and "Tasks" (operational). This separation is fundamental to the system's philosophy and must be preserved.

**AI briefing pipeline**:
1. `frontend/src/lib/ai.ts` — types, context builder (`buildBriefingContext`), and localStorage cache (4-hour TTL)
2. `frontend/src/lib/useAIBriefing.ts` — React hook that manages fetch lifecycle, caching, and abort control
3. `frontend/src/app/api/ai/briefing/route.ts` — server route that calls Anthropic API with an identity-focused system prompt and returns structured JSON

**Goals are hardcoded** in `frontend/src/lib/goals.ts` as a static array (7 goals across domains: Health, Emotional Growth, Marriage, graduate program, Career, Relationships, Daily Identity).

**Habit data import**: CSV files from a habit tracking app export live at the repo root (`export_1770248675244/`). The API route at `/api/habits/import` reads these CSVs server-side, parses them with `frontend/src/lib/habits.ts`, and the client caches the result in localStorage via `frontend/src/lib/habitStore.ts`.

### API Routes

All under `frontend/src/app/api/`:

| Route | Methods | Purpose |
|---|---|---|
| `todoist/auth/start` | GET | Initiates Todoist OAuth |
| `todoist/auth/callback` | GET | Handles OAuth callback, sets cookie |
| `todoist/tasks` | GET, POST, PATCH, DELETE | Full CRUD for Todoist tasks |
| `todoist/projects` | GET | List Todoist projects |
| `google/auth/start` | GET | Initiates Google OAuth |
| `google/auth/callback` | GET | Handles OAuth callback, sets cookie |
| `google/events` | GET, POST | Read/create Google Calendar events |
| `google/calendars` | GET | List Google calendars |
| `habits/import` | GET | Parse CSV exports into habit data |
| `ai/briefing` | POST | Generate AI morning briefing via Anthropic |

OAuth callbacks redirect back to `/` after storing tokens in cookies.

## Critical Design Principles

These are derived from `CURRENT_STATE_AND_REQUIREMENTS.md` (the source of truth):

1. **Identity vs productivity separation**: Identity practices (morning ritual, exercise, learning blocks) must NEVER be in the same task list as operational tasks. They use different visualizations, interactions, and success metrics.
2. **Non-punitive tone**: No streak pressure, no guilt messaging, no "behind" language. 70-80% adherence is the target, not "not quite 100%".
3. **Minimum/normal/stretch tiers**: Every practice has three tiers. Minimums are legitimate, not failure states. The UI must make it easy to select minimum with no guilt.
4. **5 daily identity metrics**: Morning grounding, embodied movement, nutritional awareness, present connection, curiosity spark. These are the primary success dashboard (stored in client state as `identityMetrics`).
5. **Morning flow**: A guided sequence (briefing -> focus3 -> identity check -> habits) tracked in `morningFlowSteps` state.
6. **AI framing**: All AI suggestions must be identity-framed ("the person you are becoming"), cite specific data, and never use deficit language.

## Key Reference Documents

- `CURRENT_STATE_AND_REQUIREMENTS.md` — **Source of truth** for all system specs, user context, and design philosophy
- `PRD.md` — Original product requirements (stack, data model, integrations, milestones)
- `HANDOFF_SUMMARY.md` — Summary of completed work, current state, and next steps
- `Finalized_System_Architecture.md` — Final architecture post one-month review
- `Perfectionism_Protocols.md` — Recovery protocols for comparison anxiety and all-or-nothing collapse

## Work Log Convention

After completing a feature or meaningful change, always add a numbered `.md` file to `docs/work-log/` (e.g., `002-feature-name.md`). These explain what was done, why, and teach relevant software development concepts. The audience is a data scientist (Python/R/SQL background) learning web development via vibe coding — keep explanations concise and practical.

## Known Issues / Tech Debt

- `useAIBriefing.ts` contains extensive debug logging (`#region agent log` blocks posting to `127.0.0.1:7242`) that should be removed for production
- The same debug logging exists in `api/ai/briefing/route.ts`
- `page.tsx` is a single very large component — state and UI should eventually be decomposed
- No database — all persistence is cookies (OAuth tokens) and localStorage (habits, briefing cache)
- No test suite
- Goals are hardcoded rather than user-configurable
