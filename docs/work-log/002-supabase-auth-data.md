# 002 — Supabase Auth + Data Persistence

## What Changed

Replaced browser-only storage (localStorage + cookies) with Supabase for authentication and all data persistence. The app now has a real login system and a PostgreSQL database.

### Before
- No login — anyone who opens the URL sees the dashboard
- OAuth tokens (Todoist, Google) stored in HTTP-only cookies — lost on clear
- Identity metrics, morning flow, focus3, AI briefings cached in localStorage — lost on clear or device switch
- Habits imported from CSV files via an API route, cached in localStorage
- Goals hardcoded in `goals.ts`

### After
- Email/password login via Supabase Auth
- All data persisted per-user in Supabase (PostgreSQL) with Row Level Security
- OAuth tokens stored in `user_oauth_tokens` table — auto-reconnect on login
- Google tokens auto-refresh when expired
- Daily data (identity metrics, morning flow, focus3, AI briefings) saved with debounced writes
- Goals and habits stored in database, seeded from original data

## Key Concepts

### Supabase SSR (`@supabase/ssr`)
Supabase provides a special package for server-rendered frameworks like Next.js. It handles auth cookies across three contexts:
1. **Browser client** (`createBrowserClient`) — used in `"use client"` components
2. **Server client** (`createServerClient` + `cookies()`) — used in API routes
3. **Middleware client** — refreshes auth sessions on every request

### Row Level Security (RLS)
Every table has a policy: `auth.uid() = user_id`. This means even if someone guesses an API key, they can only access their own data. The database enforces this at the SQL level.

### Middleware Auth Pattern
Next.js middleware runs before every request. We use it to:
1. Refresh the Supabase session (keeps you logged in)
2. Redirect unauthenticated users to `/login`
3. Allow API routes through (they check auth themselves)

### Debounced Saves
When you toggle an identity metric, we don't save immediately — we wait 500ms. If you toggle another one within that window, the timer resets. This prevents hammering the database when rapidly clicking checkboxes.

## Files Added
- `frontend/src/lib/supabase/` — 7 files (client, server, route, middleware, tokens, data, types)
- `frontend/src/middleware.ts` — Next.js middleware for auth
- `frontend/src/app/login/page.tsx` — Login page
- `supabase/migrations/001_initial_schema.sql` — Database schema (8 tables)
- `supabase/seed.sql` — Seed script for goals

## Files Removed
- `frontend/src/lib/habitStore.ts` — replaced by `supabase/data.ts`
- `frontend/src/app/api/habits/import/route.ts` — replaced by database seed
- All `#region agent log` debug blocks in `page.tsx`, `useAIBriefing.ts`, `api/ai/briefing/route.ts`, and `api/google/events/route.ts`

## Setup Steps
1. Create a Supabase project at supabase.com
2. Run `supabase/migrations/001_initial_schema.sql` in the SQL Editor
3. Create a user account in Authentication > Users > Add user
4. Replace `YOUR_USER_ID_HERE` in `supabase/seed.sql` with your user UUID, then run it
5. Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local`
6. Optionally import habits from CSVs using the Supabase dashboard CSV import
