## System Design Overview (Public)

This document summarizes the core design philosophy of the productivity system **without** embedding any specific user's life circumstances, dates, or personal narrative. It is safe to ship with a public, multi-user repository.

---

## Identity-First Productivity

- The system is built on an **identity-first** model: success is measured by how consistently a person lives in line with their values, not by how many tasks they complete.
- Two broad categories are always kept **separate**:
  - **Identity practices**: recurring behaviors that express who the person is becoming (morning grounding, reflection, movement, learning, connection).
  - **Operational tasks**: concrete items with clear completion states (emails, errands, project milestones, coordination tasks).
- Mixing these domains into a single checklist tends to create **checkbox mentality** for identity work, so the app enforces a dual-view architecture.

---

## Dual-View Architecture

- The UI is organized into two primary views:
  - **Practice view**: tracks identity practices, habits, and identity metrics.
  - **Tasks view**: surfaces operational tasks and deadlines (often synced from external tools like Todoist and Google Calendar).
- Each view uses different **visuals, interactions, and success metrics**:
  - Practice view emphasizes patterns over streaks, minimum/normal/stretch standards, and gentle, non-punitive framing.
  - Tasks view emphasizes clarity, ordering, and realistic prioritization (e.g., top 3 for the day).

---

## Identity Metrics and Standards

- Each user defines a small set of **daily identity metrics** (for example: grounding, movement, intentional choices, presence, curiosity).
- The app treats “**3–5 identity metrics met**” as a successful day, even when all tasks are not complete.
- Every key identity practice is modeled with **minimum / normal / stretch** tiers:
  - **Minimum** is a fully valid expression (e.g., 60 seconds of grounding, a few minutes of movement).
  - **Normal** is the target most days.
  - **Stretch** is explicitly optional, for when there is surplus time and energy.
- UI and copy must always present minimums as **legitimate, non-failure** outcomes.

---

## Data Model (High-Level)

At a high level the app persists:

- **Goals**: high-level identity- and outcome-oriented goals per user.
- **Habits / Identity Practices**: definitions with minimum/normal/stretch standards and metadata (periodicity, type, etc.).
- **Habit Sessions**: logged practice instances.
- **Identity Metrics**: per-day flags or scores capturing how the user showed up.
- **Tasks / Events**: normalized views of external task and calendar systems.
- **Reflections / Reviews**: weekly, monthly, and “phase” reflections captured as free text.
- **User Preferences**: tone, AI behavior, and UI defaults.
- **(Optional) Identity Profiles**: structured + free-text fields describing the user’s values, protocols, and long-term identity themes.

All data is stored **per-user** (e.g., in Supabase with row-level security), and the repo does not ship with any real user’s identity configuration.

---

## External Integrations

- The app is designed to integrate with external systems such as:
  - Todoist (tasks)
  - Google Calendar (events and focus blocks)
  - AI providers (for daily briefings and planning suggestions)
- Integrations are **optional per user**. Configuration lives in environment variables and per-user OAuth tokens, not in source files.

---

## AI and Coaching Principles

AI features (e.g., daily briefings, focus suggestions, gentle coaching) follow these principles:

- Frame guidance around **“the person you are becoming”** rather than output metrics.
- Avoid guilt, shame, or “behind” language; normalize 70–80% adherence as healthy.
- Use identity data (goals, habits, reflections, identity metrics) to explain *why* a suggestion is being made.
- When the user is struggling, favor **reflective questions and recovery protocols** over adding more tasks.

---

## Multi-User and Multi-Identity Support

- The core repo contains **no hard-coded goals, timelines, or identity narratives** for any particular person.
- Each authenticated user stores:
  - Their own goal set.
  - Their own practices and minimum/normal/stretch standards.
  - Their own reflections, identity metrics, and optional identity profile.
- Any example data (e.g., seed scripts or demo content) must use **generic, clearly fictitious** examples and can be safely removed in production environments.

---

## What Does *Not* Live in the Repo

To keep the project public-ready and multi-user:

- No raw exports from personal task, calendar, or habit tools.
- No markdown documents that encode a specific individual’s life story, therapy notes, employer names, or dated personal timelines.
- No personal email addresses, calendar names, or OAuth credentials.

All such information belongs either in:

- A private notes system owned by the user, or
- Structured Supabase tables keyed by `user_id` in a private deployment.

