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
- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase anonymous/public API key

## Architecture

### Stack
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS 4 + TypeScript
- **AI**: Anthropic SDK (`@anthropic-ai/sdk`) — server-side only via API route
- **Auth**: Supabase Auth (email/password) — session managed via `@supabase/ssr` middleware
- **Database**: Supabase (PostgreSQL) with Row Level Security — all user data persisted per-user
- **OAuth**: Todoist + Google tokens stored in `user_oauth_tokens` table (per-user, auto-refreshed for Google)
- **State**: Client state lives in `page.tsx` via `useState`, loaded from Supabase on mount, saved via debounced writes

### Key Architectural Decisions

**Single-page app**: The entire dashboard is a single `"use client"` component at `frontend/src/app/page.tsx`. All UI state (tasks, events, habits, identity metrics, morning flow, focus3) is managed here with React hooks. This file is very large.

**Data contracts layer** (`frontend/src/lib/contracts.ts`): Normalizer functions (`normalizeTodoistTask`, `normalizeGoogleEvent`) convert external API shapes into internal `TaskContract` and `CalendarEventContract` types. All API routes return normalized data.

**Dual-view architecture**: The UI has two tabs — "Practice" (identity/habits) and "Tasks" (operational). This separation is fundamental to the system's philosophy and must be preserved.

**Supabase data layer** (`frontend/src/lib/supabase/`):
- `client.ts` — browser-side Supabase client (`createBrowserClient`)
- `server.ts` — server-side client for Server Components (`cookies()`)
- `route.ts` — server-side client for API route handlers
- `middleware.ts` — session validation + redirect logic
- `tokens.ts` — OAuth token fetch/upsert with auto-refresh for Google
- `data.ts` — all CRUD operations for daily data (identity metrics, morning flow, focus3, goals, habits, AI briefings)
- `types.ts` — TypeScript types for all database rows

**Auth flow**: Next.js middleware validates the Supabase session on every request. Unauthenticated users are redirected to `/login`. API routes check auth via `getRouteUser()`. Login is email/password only — accounts are created in the Supabase dashboard.

**AI briefing pipeline**:
1. `frontend/src/lib/ai.ts` — types and context builder (`buildBriefingContext`)
2. `frontend/src/lib/useAIBriefing.ts` — React hook that manages fetch lifecycle, Supabase-backed caching, and abort control
3. `frontend/src/app/api/ai/briefing/route.ts` — server route that calls Anthropic API with an identity-focused system prompt and returns structured JSON

**Goals** stored in `goals` table in Supabase. The `Goal` type is defined in `frontend/src/lib/goals.ts`. Seeded via `supabase/seed.sql`.

**Habits + sessions** stored in `habits` and `habit_sessions` tables. Historical data can be imported via one-off scripts in `scripts/` or the Supabase dashboard, but those exports should remain private and are not checked into this repo.

### Database Schema

Defined in `supabase/migrations/001_initial_schema.sql`. All tables have RLS policies restricting access to the owning user.

| Table | Purpose |
|---|---|
| `user_oauth_tokens` | Todoist + Google OAuth tokens per user |
| `goals` | User goals (seeded from original hardcoded list) |
| `habits` | Habit definitions |
| `habit_sessions` | Individual habit log entries |
| `daily_identity_metrics` | 5 daily identity checks per date |
| `daily_morning_flow` | Morning flow status + step completion per date |
| `daily_focus3` | Focus 3 items (jsonb) per date |
| `daily_ai_briefings` | Cached AI briefing responses per date |

### API Routes

All under `frontend/src/app/api/`:

| Route | Methods | Purpose |
|---|---|---|
| `todoist/auth/start` | GET | Initiates Todoist OAuth (requires auth) |
| `todoist/auth/callback` | GET | Handles OAuth callback, stores token in DB |
| `todoist/tasks` | GET, POST, PATCH, DELETE | Full CRUD for Todoist tasks |
| `todoist/projects` | GET | List Todoist projects |
| `google/auth/start` | GET | Initiates Google OAuth (requires auth) |
| `google/auth/callback` | GET | Handles OAuth callback, stores token in DB |
| `google/events` | GET, POST, PATCH, DELETE | Full CRUD for Google Calendar events |
| `google/calendars` | GET | List Google calendars |
| `ai/briefing` | POST | Generate AI morning briefing via Anthropic |

All API routes verify Supabase auth and read OAuth tokens from the database.

## Critical Design Principles

These principles are encoded in the public system design and should guide any changes:

1. **Identity vs productivity separation**: Identity practices (morning ritual, movement, learning blocks) must NEVER be in the same task list as operational tasks. They use different visualizations, interactions, and success metrics.
2. **Non-punitive tone**: No streak pressure, no guilt messaging, no "behind" language. 70–80% adherence is the target, not "not quite 100%".
3. **Minimum/normal/stretch tiers**: Every practice has three tiers. Minimums are legitimate, not failure states. The UI must make it easy to select minimum with no guilt.
4. **Daily identity metrics**: A small set of daily identity checks (e.g., grounding, movement, intentional choices, presence, curiosity) is the primary success dashboard, persisted per user.
5. **Morning flow**: A guided sequence (briefing → focus3 → identity check → habits) tracked in state and persisted per day.
6. **AI framing**: All AI suggestions must be identity-framed ("the person you are becoming"), cite specific data, and never use deficit language.

## Key Reference Documents

- `SYSTEM_DESIGN_OVERVIEW.md` — Public-safe summary of system philosophy and architecture
- `PRD.md` — Product requirements (stack, data model, integrations, milestones)
- `HANDOFF_SUMMARY.md` — Summary of completed work, current state, and next steps

## Work Log Convention

After completing a feature or meaningful change, always add a numbered `.md` file to `docs/work-log/` (e.g., `002-feature-name.md`). These explain what was done, why, and teach relevant software development concepts. The audience is a data scientist (Python/R/SQL background) learning web development via vibe coding — keep explanations concise and practical.

## Known Issues / Tech Debt

- `page.tsx` is a single very large component — state and UI should eventually be decomposed
- No test suite
- Pre-existing lint errors: `@typescript-eslint/no-explicit-any` in API route normalizer calls
- Habits import from CSV is now a one-time seed — consider a UI for creating/editing habits directly
