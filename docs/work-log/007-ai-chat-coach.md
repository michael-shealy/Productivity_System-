# 007 — AI Chat Coach Panel

## What was done

Added a conversational AI chat panel that slides in from the right side of the dashboard. The user can ask questions, get identity-focused coaching advice, and the AI can propose CRUD actions (create/update/complete/delete tasks, calendar events, habit sessions) with confirmation cards.

### Files created
- `supabase/migrations/007_chat_messages.sql` — New `daily_chat_messages` table with RLS
- `frontend/src/lib/chat.ts` — Chat types, 8 tool definitions, system prompt, context builder, message converter
- `frontend/src/app/api/ai/chat/route.ts` — Streaming SSE endpoint using Anthropic SDK
- `frontend/src/components/ChatPanel.tsx` — Side panel component with message display, streaming, tool confirmation

### Files modified
- `frontend/src/lib/supabase/data.ts` — Added `loadChatMessages`, `saveChatMessage`, `updateChatMessageContent` + types
- `frontend/src/app/page.tsx` — Added ChatPanel import, `chatOpen` state, toggle button in header, ChatPanel render

### Pre-existing fix
- Fixed `onConflict: ["user_id", "week_start_date"]` → `"user_id,week_start_date"` in `upsertWeeklyReflection` (Supabase client expects a comma-separated string, not an array)

## Key concepts

### Server-Sent Events (SSE)
The chat uses SSE for streaming — a one-way protocol where the server pushes `data: {json}\n\n` lines over a long-lived HTTP response. The client reads with `response.body.getReader()` and parses each event. This is simpler than WebSockets for one-way streaming.

### Tool use with human-in-the-loop
The Anthropic API returns `tool_use` content blocks when the AI wants to take action. Instead of executing them server-side, the API route relays them as SSE events. The frontend shows confirmation cards and only executes after user approval — a "human-in-the-loop" pattern.

### Message converter for multi-turn tool conversations
When rebuilding conversation history for Anthropic, executed tools need `tool_result` messages (as `role: "user"`) paired with the original `tool_use` blocks. The `toAnthropicMessages` function reconstructs this from the flat `ChatMessage[]` stored in Supabase.

## What to verify
1. Run migration: apply `007_chat_messages.sql` to your Supabase instance
2. Click "Chat" button in header — panel slides in
3. Send a message — AI responds with streaming text
4. Ask to create a task — confirmation card appears, Confirm executes it
5. Close/reopen — messages persist for the day
