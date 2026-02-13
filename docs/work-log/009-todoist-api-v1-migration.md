# 009 — Todoist API v1 Migration

## What Changed

Todoist deprecated their REST API v2 and Sync API v9 in favor of a unified API v1. All Todoist integration was broken — every API call returned a deprecation error. This session migrated every endpoint.

## Key Changes

### URL Migration
- `rest/v2/tasks` → `api/v1/tasks`
- `rest/v2/projects` → `api/v1/projects`
- `sync/v9/completed/get` → `api/v1/tasks/completed/by_completion_date`

Extracted a `TODOIST_API_BASE` constant in `src/lib/todoist.ts` so the base URL is defined once.

### Response Shape Changes
The v1 API wraps list responses in `{ results: [...] }` instead of returning flat arrays. Both the tasks and projects GET handlers were updated to unwrap this.

### Field Rename
The task object's `created_at` field was renamed to `added_at` in v1. Updated the `TodoistTaskApi` type and `normalizeTodoistTask` function in `contracts.ts`.

### First Test Suite
Added Vitest as the test framework. Wrote 15 tests across 4 files:
- `todoist.test.ts` — constant value
- `contracts.test.ts` — normalizer functions (active + completed tasks, edge cases)
- `tasks/route.test.ts` — route handler tests with mocked fetch/auth (GET, POST, PATCH, DELETE)
- `projects/route.test.ts` — projects route handler test

## Concepts

**API versioning and migration**: When a third-party API deprecates an old version, you often need to update: (1) endpoint URLs, (2) response parsing for new shapes, (3) request field names. The actual auth usually doesn't change.

**Response shape wrapping**: APIs evolve from flat arrays to wrapped objects (`{ results: [...], nextCursor: "..." }`) when they add pagination. The wrapper lets them include metadata alongside the data without changing the item shape.

**Test mocking with `vi.mock`**: Vitest's `vi.mock` hoists mock declarations to the top of the file, so you can mock a module before importing the code that uses it. For HTTP calls, `vi.spyOn(global, "fetch")` lets you intercept fetch without changing production code.

## Files Changed
- `frontend/package.json` — added vitest + test scripts
- `frontend/vitest.config.ts` — new, configures path aliases
- `frontend/src/lib/todoist.ts` — new, `TODOIST_API_BASE` constant
- `frontend/src/lib/contracts.ts` — `created_at` → `added_at`
- `frontend/src/app/api/todoist/tasks/route.ts` — v1 URLs + response parsing
- `frontend/src/app/api/todoist/projects/route.ts` — v1 URL + response parsing
- `frontend/src/lib/todoist.test.ts` — new
- `frontend/src/lib/contracts.test.ts` — new
- `frontend/src/app/api/todoist/tasks/route.test.ts` — new
- `frontend/src/app/api/todoist/projects/route.test.ts` — new
- `docs/todoist-api-v1-reference.md` — new, API reference
