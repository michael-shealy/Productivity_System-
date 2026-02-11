# Handoff Summary (Productivity System Project)

## Context
This repository is a productivity system frontend built in Next.js (App Router + Tailwind). The app integrates Todoist and Google Calendar, uses OAuth, normalizes data via data contracts, and provides a UI dashboard with tasks, calendar views, habit check-ins, and connection controls. The design must preserve the **identity vs productivity separation** (see `SYSTEM_DESIGN_OVERVIEW.md`).

## Key Documents to Reference
- `SYSTEM_DESIGN_OVERVIEW.md` — Core design philosophy and architecture overview
- `PRD.md` — Product requirements and functional specifications

## Major Work Completed
### Frontend Setup
- Created `frontend/` Next.js app with Tailwind/App Router.
- UI skeleton built and expanded into a live dashboard.
- Dark theme applied (cool tones).

### OAuth + API Wiring
**Todoist**
1) OAuth start/callback:
   - `frontend/src/app/api/todoist/auth/start/route.ts`
   - `frontend/src/app/api/todoist/auth/callback/route.ts`
2) Tasks API:
   - `frontend/src/app/api/todoist/tasks/route.ts` (GET/POST)
3) Projects API:
   - `frontend/src/app/api/todoist/projects/route.ts`

**Google Calendar**
1) OAuth start/callback:
   - `frontend/src/app/api/google/auth/start/route.ts`
   - `frontend/src/app/api/google/auth/callback/route.ts`
2) Events API:
   - `frontend/src/app/api/google/events/route.ts` (GET/POST)
3) Calendars list:
   - `frontend/src/app/api/google/calendars/route.ts`

OAuth callbacks now **redirect back to `/`** instead of showing `{ok: true}` JSON.

### Data Contracts
Added `frontend/src/lib/contracts.ts`:
- `TaskContract`
- `CalendarEventContract` (includes `colorId`)
- `normalizeTodoistTask`, `normalizeGoogleEvent`

### UI Features Implemented
- **Auto-load data on page load** for Todoist tasks and Google events (silent if not connected).
- **Tasks block**:
  - Task count displays **only tasks due today**.
  - Tasks sorted by **due date ASC**, then **priority DESC**.
  - "Due Today" list shows all tasks due today.
  - "Remaining Tasks" shows max 3 tasks.
  - Task metadata shown (priority, due date/time, project name).
  - Priority display corrected (Todoist priority mapping fixed).
- **Focus 3**:
  - Now uses tasks/events + focus area keyword mapping to select 3 themes.
  - Labels show "Task"/"Event" and prioritize diverse focus areas.
- **Morning Briefing**:
  - Uses tasks/events to generate a curated briefing.
  - Includes "Why this briefing" rationale.
- **Calendar Views**:
  - **Month view** (current month) full width with event snippets.
  - **Today's agenda**: shows today's events only.
  - All-day events show "All day" (no incorrect time).
  - Agenda excludes events from the "Todoist" calendar.
  - Agenda uses Google color IDs (mapped to muted background styles).
- **Calendar selection**:
  - Month view includes calendar checkbox pills ("Calendars shown").
  - Calendars are chosen from whatever the Google Calendar API returns (for example, a primary calendar plus any others the user selects in the UI).
- **Connections section**:
  - Connect buttons moved to top.
  - Create Task + Create Event forms remain in Connections.
  - Create Event supports calendar selection + color.

### Stability Pass
- API routes log errors (status + detail).
- Rate limiting handled (429s returned).
- UI shows friendly messages for 401/429.

## Key Paths / Files
Frontend:
- `frontend/src/app/page.tsx` (main UI)
- `frontend/src/lib/contracts.ts`

API routes:
- `frontend/src/app/api/todoist/auth/start/route.ts`
- `frontend/src/app/api/todoist/auth/callback/route.ts`
- `frontend/src/app/api/todoist/tasks/route.ts` (GET/POST)
- `frontend/src/app/api/todoist/projects/route.ts`
- `frontend/src/app/api/google/auth/start/route.ts`
- `frontend/src/app/api/google/auth/callback/route.ts`
- `frontend/src/app/api/google/events/route.ts` (GET/POST)
- `frontend/src/app/api/google/calendars/route.ts`

Env:
- `frontend/.env.local` (created, secrets go here)
- `frontend/.env.example`
- `.gitignore` updated to include `frontend/.env.local` and `frontend/.env.example`

## Current State / Known Behaviors
- OAuth works; callbacks redirect to `/`.
- Tasks and events load correctly after connect.
- Google event creation uses ISO timestamps + timezone and colorId.
- Todoist create task supports content, description, due_string, priority, labels, project_id, section_id, parent_id.
- Project selection uses actual Todoist project IDs, not labels.
- Month view and agenda show Google events across selected calendars.

## Remaining / Suggested Next Steps
1) **Focus 3 + Morning Briefing refinement**:
   - Currently keyword-based heuristics.
   - Should be upgraded to use structured goals from user's Supabase data.
2) **Identity vs productivity separation**:
   - Consider separate views/tabs for identity practices vs operational tasks.
3) **UI polish**:
   - Improve task table readability and spacing in dark theme.
4) **Bi-sync update/delete**:
   - Not implemented yet (create only).
5) **Habit integration**:
   - Historical habit data can be imported via scripts or Supabase dashboard; import functionality not yet wired into UI.

## Notes for Next Agent
- Keep dark UI with "cool" feeling.
- Focus 3 and Morning Briefing must be grounded in **identity goals** and user-defined systems (stored in Supabase), not productivity metrics.
- Refer to `SYSTEM_DESIGN_OVERVIEW.md` for core design principles.
