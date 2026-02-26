import type { TaskContract, CalendarEventContract } from "@/lib/contracts";
import type { Goal } from "@/lib/goals";
import type { Habit, HabitSession } from "@/lib/habits";
import type { WeeklyReflection } from "@/lib/supabase/types";
import type { ChatMessage, ChatMessageContent } from "@/lib/supabase/data";
import type { WeatherData } from "@/lib/weather";

// ── SSE Event Types ─────────────────────────────────────────────────────

export type ChatSSEEvent =
  | { type: "text_delta"; text: string }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "status"; message: string }
  | { type: "done" }
  | { type: "error"; message: string };

// ── Tool Definitions ────────────────────────────────────────────────────

/** Tools that execute server-side without user confirmation */
export const READ_ONLY_TOOLS = new Set(["get_events"]);

export const CHAT_TOOLS = [
  {
    name: "get_events",
    description:
      "Fetch the user's Google Calendar events for a date range. ALWAYS use this before creating events to check availability. Read-only, executes automatically. The tool_result JSON includes an `events` array and a `days` array, where each entry has `date` (YYYY-MM-DD), `weekday` (e.g. 'Sunday'), and `events` for that date; always trust the `weekday` field instead of recomputing the day of week yourself.",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Start date as YYYY-MM-DD" },
        endDate: { type: "string", description: "End date as YYYY-MM-DD (inclusive)" },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "create_task",
    description: "Create a new task in the user's Todoist. Use when the user asks to add a task, reminder, or todo item.",
    input_schema: {
      type: "object" as const,
      properties: {
        content: { type: "string", description: "Task title/content" },
        description: { type: "string", description: "Optional task description" },
        due_string: { type: "string", description: "Natural language due date, e.g. 'tomorrow', 'next Monday', '2025-03-15'" },
        priority: { type: "number", description: "Priority 1-4 (4 is highest/most urgent)" },
      },
      required: ["content"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing Todoist task. Use when the user wants to change a task's title, description, due date, or priority.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The Todoist task ID to update" },
        content: { type: "string", description: "New task title" },
        description: { type: "string", description: "New task description" },
        due_string: { type: "string", description: "New due date in natural language" },
        priority: { type: "number", description: "New priority 1-4" },
      },
      required: ["id"],
    },
  },
  {
    name: "complete_task",
    description: "Mark a Todoist task as complete. Use when the user says they finished, completed, or done with a task.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The Todoist task ID to complete" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a Todoist task entirely. Use when the user wants to remove a task (not complete it).",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The Todoist task ID to delete" },
      },
      required: ["id"],
    },
  },
  {
    name: "create_event",
    description: "Create a new Google Calendar event. Use when the user wants to schedule something.",
    input_schema: {
      type: "object" as const,
      properties: {
        summary: { type: "string", description: "Event title" },
        start: { type: "string", description: "Start time as ISO 8601 datetime string" },
        end: { type: "string", description: "End time as ISO 8601 datetime string" },
        description: { type: "string", description: "Optional event description" },
        location: { type: "string", description: "Optional event location" },
      },
      required: ["summary", "start", "end"],
    },
  },
  {
    name: "update_event",
    description: "Update an existing Google Calendar event.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The Google Calendar event ID" },
        calendarId: { type: "string", description: "Calendar ID (defaults to primary)" },
        summary: { type: "string", description: "New event title" },
        start: { type: "string", description: "New start time as ISO 8601" },
        end: { type: "string", description: "New end time as ISO 8601" },
        location: { type: "string", description: "New location" },
      },
      required: ["id"],
    },
  },
  {
    name: "delete_event",
    description: "Delete a Google Calendar event.",
    input_schema: {
      type: "object" as const,
      properties: {
        id: { type: "string", description: "The Google Calendar event ID" },
        calendarId: { type: "string", description: "Calendar ID (defaults to primary)" },
      },
      required: ["id"],
    },
  },
  {
    name: "log_habit",
    description: "Log a habit session for the user. Use when they mention completing a habit or want to track an activity.",
    input_schema: {
      type: "object" as const,
      properties: {
        habitId: { type: "string", description: "The habit ID to log a session for" },
        amount: { type: "number", description: "Amount completed (for 'amount' type habits)" },
        note: { type: "string", description: "Optional note about the session" },
      },
      required: ["habitId"],
    },
  },
];

// ── System Prompt ───────────────────────────────────────────────────────

const CHAT_SYSTEM_PROMPT_BASE = `You are an identity-focused coaching companion embedded in a personal productivity system. You are conversational, warm, and grounded.

Core principles:
- Frame everything through identity ("who you're becoming") rather than output metrics
- Never shame, guilt, or use deficit language ("you failed", "you didn't", "you're behind")
- Use language of invitation, observation, and gentle encouragement
- 70-80% adherence is healthy — never imply 100% is the standard
- When the user seems stuck, stressed, or overwhelmed, ask reflective questions rather than giving more tasks
- Proactively offer to create tasks, events, or log habits when it would be helpful — don't just advise, offer to act
- Cite specific data from the user's context when giving advice (a specific task, habit streak, goal, etc.)
- Keep responses concise — 2-4 sentences for simple questions, longer only when reflecting or coaching

You have tools to create/update/complete/delete tasks and calendar events, and to log habit sessions. When proposing an action, explain what you'll do and why. The user will confirm before execution.

You cannot modify the app structure, settings, or identity metrics directly. You can only CRUD tasks, events, and habit sessions.

Scheduling intelligence:
- ALWAYS call get_events before proposing a new calendar event — never guess at availability
- Resolve relative dates ("this weekend", "next Tuesday", "tomorrow") from today's date in context
- When interpreting calendar data from get_events, always trust the \`weekday\` field provided for each date in the \`days\` array of the tool_result JSON. Do NOT recompute the day-of-week from raw date strings.
- Find free slots considering: waking hours (7am-10pm), 15-minute buffer between events, time-of-day preference (errands mid-day, social events evening, workouts morning)
- Infer durations for common activities: Grocery/errands: 1hr, Workout: 1hr, Coffee/casual meeting: 45min, Study/deep work: 2hr, Quick errand: 30min, Doctor appointment: 1hr
- For unusual or specific activities (thesis defense, interviews, etc.), ask the user how long they expect
- If Google Calendar is not connected, inform the user gracefully and suggest connecting it in settings
- Use the user's timezone (provided in context) for all event times
- Weather data is available for context. Reference it only when the user asks about weather directly, or when it would significantly affect a suggested activity (e.g., recommending indoor movement instead of an outdoor run due to storms). Do not volunteer weather commentary unless it materially changes your recommendation.`;

const CHAT_SYSTEM_PROMPT_GENTLE = `
Additional tone: The user has chosen "Gentle" mode. Use recovery-focused language. When habit adherence was low or the user mentions difficulty, emphasize minimums and that no catch-up is needed. Never guilt or deficit language. Be extra warm and affirming.`;

export function getChatSystemPrompt(aiTone?: "standard" | "gentle"): string {
  return CHAT_SYSTEM_PROMPT_BASE + (aiTone === "gentle" ? CHAT_SYSTEM_PROMPT_GENTLE : "");
}

// ── Context Builder ─────────────────────────────────────────────────────

export type ChatContext = {
  today: string;
  timezone?: string;
  goals: Goal[];
  tasks: TaskContract[];
  completedTasks: TaskContract[];
  events: CalendarEventContract[];
  habits: Habit[];
  habitSessions: HabitSession[];
  identityMetrics: {
    morningGrounding: boolean;
    embodiedMovement: boolean;
    nutritionalAwareness: boolean;
    presentConnection: boolean;
    curiositySpark: boolean;
  };
  yesterdayIdentityMetrics?: {
    morningGrounding: boolean;
    embodiedMovement: boolean;
    nutritionalAwareness: boolean;
    presentConnection: boolean;
    curiositySpark: boolean;
  } | null;
  focus3: Array<{ id: string; label: string; type: string }>;
  morningFlowStatus: string;
  latestReflection?: WeeklyReflection | null;
  identityProfile?: {
    valuesDocument?: string;
    currentPhase?: string;
    coreValues?: string[];
  } | null;
  aiAdditionalContext?: string;
  aiObservations?: Array<{ category: string; observation: string; dateRef: string }>;
  weather?: WeatherData | null;
};

export function buildChatContextMessage(ctx: ChatContext): string {
  const sections: string[] = [];

  const dayName = new Date(ctx.today + "T12:00:00").toLocaleDateString("en-US", { weekday: "long" });
  sections.push(`Today: ${ctx.today} (${dayName})`);
  if (ctx.timezone) sections.push(`Timezone: ${ctx.timezone}`);
  sections.push(`Morning flow status: ${ctx.morningFlowStatus}`);

  const todayScore = Object.values(ctx.identityMetrics).filter(Boolean).length;
  sections.push(`Today's identity score: ${todayScore}/5`);
  if (ctx.yesterdayIdentityMetrics) {
    const yScore = Object.values(ctx.yesterdayIdentityMetrics).filter(Boolean).length;
    sections.push(`Yesterday's identity score: ${yScore}/5`);
  }

  if (ctx.goals.length > 0) {
    sections.push(
      `Active goals:\n${ctx.goals.map((g) => `- ${g.title} [${g.domain}, ${g.season}]: ${g.description}`).join("\n")}`
    );
  }

  if (ctx.tasks.length > 0) {
    sections.push(
      `Active tasks (${ctx.tasks.length}):\n${ctx.tasks.slice(0, 20).map((t) => `- [ID: ${t.id}] [P${t.priority}] ${t.title}${t.due?.dateTime ? ` (due ${t.due.dateTime})` : t.due?.date ? ` (due ${t.due.date})` : ""}`).join("\n")}`
    );
  } else {
    sections.push("Active tasks: none");
  }

  if (ctx.completedTasks.length > 0) {
    sections.push(
      `Completed today (${ctx.completedTasks.length}):\n${ctx.completedTasks.slice(0, 10).map((t) => `- ${t.title}`).join("\n")}`
    );
  }

  const formatEventTime = (e: CalendarEventContract) => {
    if (!e.start?.dateTime) return "All day";
    const d = new Date(e.start.dateTime);
    if (Number.isNaN(d.getTime())) return "All day";
    const end = e.end?.dateTime ? new Date(e.end.dateTime) : null;
    const startStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const endStr = end ? end.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    return endStr ? `${startStr}-${endStr}` : startStr;
  };

  if (ctx.events.length > 0) {
    sections.push(
      `Calendar events today (${ctx.events.length}):\n${ctx.events.slice(0, 15).map((e) => `- [ID: ${e.id}] [Cal: ${e.calendarId}] ${formatEventTime(e)}: ${e.title}${e.location ? ` @ ${e.location}` : ""}`).join("\n")}`
    );
  } else {
    sections.push("Calendar events today: none");
  }

  if (ctx.habits.length > 0) {
    const todayStr = ctx.today;
    const habitLines = ctx.habits.filter((h) => !h.archivedAt).map((h) => {
      const todaySessions = ctx.habitSessions.filter(
        (s) => s.habitId === h.id && s.createdAt.startsWith(todayStr)
      );
      const loggedToday = todaySessions.length > 0;
      return `- [ID: ${h.id}] ${h.title} (${h.kind}, ${h.period})${loggedToday ? " [logged today]" : ""}`;
    });
    sections.push(`Habits (${habitLines.length}):\n${habitLines.join("\n")}`);
  }

  if (ctx.focus3.length > 0) {
    sections.push(
      `Focus 3 for today:\n${ctx.focus3.map((f) => `- ${f.label} (${f.type})`).join("\n")}`
    );
  }

  if (ctx.latestReflection) {
    const r = ctx.latestReflection;
    sections.push(
      `Latest weekly reflection (week of ${r.weekStartDate}):\nWhat went well: ${r.whatWentWell || "(empty)"}\nWhat mattered: ${r.whatMattered || "(empty)"}\nLearnings: ${r.learnings || "(empty)"}`
    );
  }

  if (ctx.identityProfile) {
    const ip = ctx.identityProfile;
    const parts: string[] = [];
    if (ip.valuesDocument) parts.push(`Identity statement: ${ip.valuesDocument}`);
    if (ip.coreValues?.length) parts.push(`Core values: ${ip.coreValues.join(", ")}`);
    if (ip.currentPhase) parts.push(`Current life phase: ${ip.currentPhase}`);
    if (parts.length > 0) {
      sections.push(`User identity profile:\n${parts.join("\n")}`);
    }
  }

  if (ctx.aiAdditionalContext) {
    sections.push(`Additional user context: ${ctx.aiAdditionalContext}`);
  }

  if (ctx.aiObservations && ctx.aiObservations.length > 0) {
    sections.push(
      `AI memory (longitudinal patterns):\n${ctx.aiObservations.map((o) => `- [${o.category}] ${o.observation} (from ${o.dateRef})`).join("\n")}`
    );
  }

  if (ctx.weather) {
    const w = ctx.weather;
    const todayForecast = w.forecast[0];
    const lines = [`Current: ${w.current.emoji} ${w.current.temperature}°F, ${w.current.condition} in ${w.location.name}`];
    if (todayForecast) {
      lines.push(`Today: H:${todayForecast.tempHigh}°F L:${todayForecast.tempLow}°F, ${todayForecast.precipChance}% precip, sunrise ${todayForecast.sunrise}, sunset ${todayForecast.sunset}`);
    }
    sections.push(`Weather:\n${lines.join("\n")}`);
  }

  return sections.join("\n\n");
}

// ── Message Converter ───────────────────────────────────────────────────

type AnthropicMessage = {
  role: "user" | "assistant";
  content: string | Array<{ type: string; [key: string]: unknown }>;
};

export function toAnthropicMessages(
  chatHistory: ChatMessage[],
  contextMessage: string
): AnthropicMessage[] {
  const messages: AnthropicMessage[] = [];

  for (let i = 0; i < chatHistory.length; i++) {
    const msg = chatHistory[i];

    if (msg.role === "user") {
      let text = msg.content.text;
      // Prepend context to the first user message
      if (i === 0) {
        text = `[Current context for your reference — do not repeat this back to the user]\n${contextMessage}\n\n[User message]\n${text}`;
      }
      messages.push({ role: "user", content: text });
    } else {
      // Assistant message
      const blocks: Array<{ type: string; [key: string]: unknown }> = [];

      if (msg.content.text) {
        blocks.push({ type: "text", text: msg.content.text });
      }

      // Add tool_use blocks for any proposed actions
      if (msg.content.toolUses) {
        for (const tu of msg.content.toolUses) {
          blocks.push({
            type: "tool_use",
            id: tu.id,
            name: tu.name,
            input: tu.input,
          });
        }
      }

      if (blocks.length > 0) {
        messages.push({ role: "assistant", content: blocks });
      }

      // Add tool_result messages for executed tools
      if (msg.content.toolUses) {
        const toolResults = msg.content.toolUses
          .filter((tu) => tu.status === "executed" || tu.status === "error" || tu.status === "rejected")
          .map((tu) => ({
            type: "tool_result",
            tool_use_id: tu.id,
            content: tu.status === "rejected"
              ? "User declined this action."
              : tu.result ?? (tu.status === "executed" ? "Action completed successfully." : "Action failed."),
            is_error: tu.status === "error",
          }));

        if (toolResults.length > 0) {
          messages.push({ role: "user", content: toolResults });
        }
      }
    }
  }

  return messages;
}
