# Identity Data Storage Overview

This document clarifies where user-specific identity data lives in this system and how the public repository relates to private user data.

## What Lives in Supabase (Per-User, Private)

All identity-related data is stored in Supabase tables, keyed by `user_id` with Row Level Security (RLS) policies ensuring each user can only access their own data:

### Core Identity Data Tables

- **`goals`** — User-defined goals (title, domain, description, season, active status)
- **`habits`** — Habit definitions (title, type, kind, period, target)
- **`habit_sessions`** — Logged habit instances (amount, duration, notes)
- **`daily_identity_metrics`** — Daily identity checks (5 boolean metrics per date)
- **`daily_morning_flow`** — Morning flow completion status and steps
- **`daily_focus3`** — Daily focus items (JSONB array)
- **`daily_ai_briefings`** — Cached AI briefing responses
- **`weekly_reflections`** — Weekly reflection entries (what went well, what mattered, learnings)
- **`four_week_reviews`** — Four-week review entries (reflection summary, goal associations, adjustment notes)
- **`user_preferences`** — User preferences (e.g., AI tone settings)
- **`identity_profiles`** — High-level identity configuration (values document, protocols, phase metadata)

### How Data is Accessed

All data access happens through helper functions in `frontend/src/lib/supabase/data.ts`:
- `loadGoals(supabase, userId)` — fetches active goals for a user
- `loadHabits(supabase, userId)` — fetches habits for a user
- `loadIdentityMetrics(supabase, userId, date)` — fetches daily identity metrics
- `loadIdentityProfile(supabase, userId)` — fetches identity profile
- And similar functions for all other entities

These functions always filter by `user_id`, ensuring complete data isolation between users.

## What Lives in the Public Repository

The public repository contains:

- **Database schemas** (`supabase/migrations/*.sql`) — table definitions, RLS policies, indexes
- **TypeScript types** (`frontend/src/lib/supabase/types.ts`) — type definitions matching database schemas
- **Data access helpers** (`frontend/src/lib/supabase/data.ts`) — generic CRUD functions that work with any user's data
- **Application code** — UI components, API routes, business logic
- **Generic documentation** — design philosophy, architecture overview, product requirements

The repository does **not** contain:
- Any real user goals, habits, or identity data
- Personal email addresses, calendar names, or identifiers
- User-specific identity protocols or values documents
- Historical habit exports or personal notes

## Seed Data Policy

The `supabase/seed.sql` file intentionally does **not** insert any real-user data. It contains only:
- Comments explaining the seed policy
- Optional commented-out examples of generic, clearly fictitious goals (for local development only)

In production, users create their own goals and habits through the app UI, which writes to Supabase tables.

## Migration Path for Personal Data

If you have personal identity data (goals, habits, protocols) that you want to preserve:

1. **Store it in Supabase** — Use the Supabase dashboard or a one-off script to insert your personal data into your private Supabase project
2. **Do not commit it** — Keep personal data out of version control
3. **Use the app** — Once data is in Supabase, the app will read it via the standard data access functions

## Summary

- **Private data** = Supabase tables (per-user, RLS-protected)
- **Public repo** = Schemas, types, helpers, and generic application code
- **No personal data** should ever be committed to this repository
