# Todoist API v1 Migration Reference

Todoist deprecated REST API v2 and Sync API v9 in favor of a unified **API v1**.

## Endpoint Mapping

| Old Endpoint | New Endpoint |
|---|---|
| `rest/v2/tasks` | `api/v1/tasks` |
| `rest/v2/tasks/{id}` | `api/v1/tasks/{id}` |
| `rest/v2/tasks/{id}/close` | `api/v1/tasks/{id}/close` |
| `rest/v2/tasks/{id}/reopen` | `api/v1/tasks/{id}/reopen` |
| `rest/v2/projects` | `api/v1/projects` |
| `sync/v9/completed/get` | `api/v1/tasks/completed/by_completion_date` |

Base URL: `https://api.todoist.com`

## Response Shape Changes

### Active Tasks (GET /api/v1/tasks)

**Before (v2):** flat array `[task1, task2, ...]`

**After (v1):** wrapped with cursor pagination
```json
{ "results": [task1, task2, ...], "nextCursor": "..." }
```

### Projects (GET /api/v1/projects)

Same change — flat array → `{ results: [...], nextCursor: "..." }`

### Completed Tasks (GET /api/v1/tasks/completed/by_completion_date)

Response key stays `items` (similar to old sync API):
```json
{ "items": [...], "nextCursor": "..." }
```

Query param `since` still used for date filtering.

## Task Object Field Changes

- `created_at` → `added_at` (renamed)
- `completed_at` — unchanged
- `due` object — unchanged (`date`, `datetime`, `timezone`, `is_recurring`, `string`, `lang`)
- New fields (unused by our code): `checked`, `user_id`, `duration`, `deadline`, `updated_at`

## Auth

No changes. Bearer token auth and OAuth flow (`todoist.com/oauth/authorize`, `todoist.com/oauth/access_token`) remain the same.

## Pagination

API v1 uses cursor-based pagination via `nextCursor`. Our code currently fetches a single page (same as before). Noted as tech debt.
