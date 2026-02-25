"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { TaskContract, CalendarEventContract } from "@/lib/contracts";
import type { Goal } from "@/lib/goals";
import type { Habit, HabitSession } from "@/lib/habits";
import type { WeeklyReflection } from "@/lib/supabase/types";
import type { ChatMessage, ChatMessageContent } from "@/lib/supabase/data";
import {
  loadChatMessages,
  saveChatMessage,
  updateChatMessageContent,
  insertHabitSession,
  deleteChatMessagesForDate,
} from "@/lib/supabase/data";
import {
  buildChatContextMessage,
  toAnthropicMessages,
  type ChatSSEEvent,
} from "@/lib/chat";

// ── Types ────────────────────────────────────────────────────────────────

type ToolUseEntry = {
  id: string;
  name: string;
  input: Record<string, unknown>;
  status: "pending" | "confirmed" | "rejected" | "executing" | "executed" | "error";
  result?: string;
};

type ChatPanelProps = {
  isOpen: boolean;
  onClose: () => void;
  supabase: SupabaseClient;
  userId: string;
  todayKey: string;
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
  aiTone?: "standard" | "gentle";
  identityProfile?: {
    valuesDocument?: string;
    currentPhase?: string;
    coreValues?: string[];
  } | null;
  aiAdditionalContext?: string;
  aiObservations?: Array<{ category: string; observation: string; dateRef: string }>;
  onTasksChanged: () => void;
  onEventsChanged: () => void;
  onHabitSessionAdded: (session: HabitSession) => void;
};

// ── Tool Descriptions (for confirmation cards) ──────────────────────────

function describeToolAction(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "create_task":
      return `Create task: "${input.content}"${input.due_string ? ` (due ${input.due_string})` : ""}`;
    case "update_task":
      return `Update task ${input.id}${input.content ? `: "${input.content}"` : ""}`;
    case "complete_task":
      return `Complete task ${input.id}`;
    case "delete_task":
      return `Delete task ${input.id}`;
    case "create_event":
      return `Create event: "${input.summary}"`;
    case "update_event":
      return `Update event ${input.id}${input.summary ? `: "${input.summary}"` : ""}`;
    case "delete_event":
      return `Delete event ${input.id}`;
    case "log_habit":
      return `Log habit session for habit ${input.habitId}`;
    default:
      return `${name}`;
  }
}

// ── Component ───────────────────────────────────────────────────────────

export default function ChatPanel({
  isOpen,
  onClose,
  supabase,
  userId,
  todayKey,
  goals,
  tasks,
  completedTasks,
  events,
  habits,
  habitSessions,
  identityMetrics,
  yesterdayIdentityMetrics,
  focus3,
  morningFlowStatus,
  latestReflection,
  aiTone,
  identityProfile,
  aiAdditionalContext,
  aiObservations,
  onTasksChanged,
  onEventsChanged,
  onHabitSessionAdded,
}: ChatPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingToolUses, setPendingToolUses] = useState<ToolUseEntry[]>([]);
  const [loaded, setLoaded] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Load messages when panel opens for the current day
  useEffect(() => {
    if (!isOpen || loaded) return;
    let cancelled = false;
    (async () => {
      const msgs = await loadChatMessages(supabase, userId, todayKey);
      if (!cancelled) {
        setMessages(msgs);
        setLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, loaded, supabase, userId, todayKey]);

  // Reset loaded state when the date changes so a new day's chat starts fresh
  useEffect(() => {
    setLoaded(false);
    setMessages([]);
  }, [todayKey]);

  // Auto-scroll on new messages or streaming text
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingText, pendingToolUses, statusMessage]);

  // Focus input when panel opens
  useEffect(() => {
    if (isOpen && loaded) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen, loaded]);

  // Abort stream on close
  useEffect(() => {
    if (!isOpen && abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, [isOpen]);

  const buildContext = useCallback(() => {
    return buildChatContextMessage({
      today: todayKey,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      goals,
      tasks,
      completedTasks,
      events,
      habits,
      habitSessions,
      identityMetrics,
      yesterdayIdentityMetrics,
      focus3,
      morningFlowStatus,
      latestReflection,
      identityProfile,
      aiAdditionalContext,
      aiObservations,
    });
  }, [
    todayKey, goals, tasks, completedTasks, events, habits, habitSessions,
    identityMetrics, yesterdayIdentityMetrics, focus3, morningFlowStatus, latestReflection,
    identityProfile, aiAdditionalContext, aiObservations,
  ]);

  // ── Send Message ───────────────────────────────────────────────────────

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    setInput("");
    setStreaming(true);
    setStreamingText("");
    setPendingToolUses([]);

    // Save user message to Supabase
    const userMsg = await saveChatMessage(supabase, userId, todayKey, "user", { text });
    if (!userMsg) {
      setStreaming(false);
      return;
    }

    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);

    // Build context and Anthropic messages
    const context = buildContext();
    const anthropicMessages = toAnthropicMessages(updatedMessages, context);

    const abortController = new AbortController();
    abortRef.current = abortController;

    let fullText = "";
    const collectedTools: ToolUseEntry[] = [];

    try {
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: anthropicMessages,
          context,
          aiTone: aiTone ?? "standard",
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error((errData as { error?: string }).error ?? `HTTP ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response body");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed.startsWith("data: ")) continue;
          const jsonStr = trimmed.slice(6);

          let event: ChatSSEEvent;
          try {
            event = JSON.parse(jsonStr) as ChatSSEEvent;
          } catch {
            continue;
          }

          if (event.type === "text_delta") {
            fullText += event.text;
            setStreamingText(fullText);
            setStatusMessage(null);
          } else if (event.type === "status") {
            setStatusMessage(event.message);
          } else if (event.type === "tool_use") {
            collectedTools.push({
              id: event.id,
              name: event.name,
              input: event.input,
              status: "pending",
            });
            setPendingToolUses([...collectedTools]);
          } else if (event.type === "error") {
            fullText += `\n\n[Error: ${event.message}]`;
            setStreamingText(fullText);
          }
          // "done" — handled after loop
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        fullText += fullText ? `\n\n[Error: ${errMsg}]` : `Sorry, I encountered an error: ${errMsg}`;
        setStreamingText(fullText);
      }
    }

    // Save assistant message
    const assistantContent: ChatMessageContent = {
      text: fullText,
      toolUses: collectedTools.length > 0 ? collectedTools : undefined,
    };
    const assistantMsg = await saveChatMessage(
      supabase, userId, todayKey, "assistant", assistantContent
    );

    if (assistantMsg) {
      setMessages((prev) => [...prev, assistantMsg]);
    }

    setStreaming(false);
    setStreamingText("");
    setStatusMessage(null);
    abortRef.current = null;
  }, [input, streaming, messages, supabase, userId, todayKey, buildContext, aiTone]);

  // ── Tool Execution ────────────────────────────────────────────────────

  const executeToolAction = useCallback(
    async (messageId: string, toolEntry: ToolUseEntry) => {
      // Update status to executing
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: {
                  ...m.content,
                  toolUses: m.content.toolUses?.map((tu) =>
                    tu.id === toolEntry.id ? { ...tu, status: "executing" as const } : tu
                  ),
                },
              }
            : m
        )
      );

      let result = "Action completed successfully.";
      let success = true;

      try {
        const { name, input: toolInput } = toolEntry;

        if (name === "create_task") {
          const res = await fetch("/api/todoist/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toolInput),
          });
          if (!res.ok) throw new Error(`Failed to create task: ${res.status}`);
          const data = await res.json();
          result = `Task created: "${(data as { content?: string }).content ?? toolInput.content}"`;
          onTasksChanged();
        } else if (name === "update_task") {
          const res = await fetch("/api/todoist/tasks", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toolInput),
          });
          if (!res.ok) throw new Error(`Failed to update task: ${res.status}`);
          result = "Task updated.";
          onTasksChanged();
        } else if (name === "complete_task") {
          const res = await fetch("/api/todoist/tasks", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: toolInput.id, action: "close" }),
          });
          if (!res.ok) throw new Error(`Failed to complete task: ${res.status}`);
          result = "Task completed.";
          onTasksChanged();
        } else if (name === "delete_task") {
          const res = await fetch(`/api/todoist/tasks?id=${toolInput.id}`, {
            method: "DELETE",
          });
          if (!res.ok) throw new Error(`Failed to delete task: ${res.status}`);
          result = "Task deleted.";
          onTasksChanged();
        } else if (name === "create_event") {
          const res = await fetch("/api/google/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toolInput),
          });
          if (!res.ok) throw new Error(`Failed to create event: ${res.status}`);
          result = `Event created: "${toolInput.summary}"`;
          onEventsChanged();
        } else if (name === "update_event") {
          const res = await fetch("/api/google/events", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(toolInput),
          });
          if (!res.ok) throw new Error(`Failed to update event: ${res.status}`);
          result = "Event updated.";
          onEventsChanged();
        } else if (name === "delete_event") {
          const calId = (toolInput.calendarId as string) ?? "primary";
          const res = await fetch(
            `/api/google/events?id=${toolInput.id}&calendarId=${encodeURIComponent(calId)}`,
            { method: "DELETE" }
          );
          if (!res.ok) throw new Error(`Failed to delete event: ${res.status}`);
          result = "Event deleted.";
          onEventsChanged();
        } else if (name === "log_habit") {
          const session = await insertHabitSession(supabase, userId, {
            habitId: toolInput.habitId as string,
            amount: toolInput.amount as number | undefined,
            data: toolInput.note as string | undefined,
          });
          if (!session) throw new Error("Failed to log habit session");
          result = "Habit session logged.";
          onHabitSessionAdded(session);
        } else {
          throw new Error(`Unknown tool: ${name}`);
        }
      } catch (err) {
        success = false;
        result = err instanceof Error ? err.message : "Action failed.";
      }

      const newStatus = success ? ("executed" as const) : ("error" as const);

      // Update message in local state
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: {
                  ...m.content,
                  toolUses: m.content.toolUses?.map((tu) =>
                    tu.id === toolEntry.id ? { ...tu, status: newStatus, result } : tu
                  ),
                },
              }
            : m
        )
      );

      // Persist updated content to Supabase
      const msg = messages.find((m) => m.id === messageId);
      if (msg) {
        const updatedContent: ChatMessageContent = {
          ...msg.content,
          toolUses: msg.content.toolUses?.map((tu) =>
            tu.id === toolEntry.id ? { ...tu, status: newStatus, result } : tu
          ),
        };
        updateChatMessageContent(supabase, userId, messageId, updatedContent).catch(() => {});
      }
    },
    [messages, supabase, userId, onTasksChanged, onEventsChanged, onHabitSessionAdded]
  );

  const rejectToolAction = useCallback(
    async (messageId: string, toolId: string) => {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                content: {
                  ...m.content,
                  toolUses: m.content.toolUses?.map((tu) =>
                    tu.id === toolId ? { ...tu, status: "rejected" as const } : tu
                  ),
                },
              }
            : m
        )
      );

      const msg = messages.find((m) => m.id === messageId);
      if (msg) {
        const updatedContent: ChatMessageContent = {
          ...msg.content,
          toolUses: msg.content.toolUses?.map((tu) =>
            tu.id === toolId ? { ...tu, status: "rejected" as const } : tu
          ),
        };
        updateChatMessageContent(supabase, userId, messageId, updatedContent).catch(() => {});
      }
    },
    [messages, supabase, userId]
  );

  const handleClearChat = useCallback(async () => {
    // Stop any in-flight stream
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }

    setStreaming(false);
    setStreamingText("");
    setStatusMessage(null);
    setPendingToolUses([]);
    setMessages([]);

    // Best-effort delete of today's messages for this user
    deleteChatMessagesForDate(supabase, userId, todayKey).catch(() => {});
  }, [supabase, userId, todayKey]);

  // ── Render ────────────────────────────────────────────────────────────

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className={`overscroll-contain fixed right-0 top-0 bottom-0 z-50 flex w-full flex-col border-l border-zinc-800 bg-zinc-950 transition-transform duration-300 ease-in-out md:w-[400px] ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-zinc-400 hover:text-zinc-200 md:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
            aria-label="Close chat"
          >
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M13 4l-6 6 6 6" />
            </svg>
          </button>
          <h2 className="text-sm font-medium text-zinc-200">Chat</h2>
          <button
            type="button"
            onClick={handleClearChat}
            className="rounded px-2 py-1.5 text-xs text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            Clear chat
          </button>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="hidden min-h-[44px] min-w-[44px] items-center justify-center rounded p-1 text-zinc-500 hover:text-zinc-300 md:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          aria-label="Close chat"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="flex h-full items-center justify-center">
            <p className="text-sm text-zinc-500">How can I help you today?</p>
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id}>
            {/* Message bubble */}
            <div
              className={`rounded-lg px-3 py-2 text-sm ${
                msg.role === "user"
                  ? "ml-8 bg-indigo-900/40 text-zinc-200"
                  : "mr-8 bg-zinc-900 text-zinc-300"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="whitespace-pre-wrap leading-relaxed">
                  <ReactMarkdown>{msg.content.text}</ReactMarkdown>
                </div>
              ) : (
                <div className="whitespace-pre-wrap">{msg.content.text}</div>
              )}
            </div>

            {/* Tool use cards */}
            {msg.role === "assistant" && msg.content.toolUses?.map((tu) => (
              <div
                key={tu.id}
                className={`mt-2 mr-8 rounded-lg border px-3 py-2 text-xs ${
                  tu.status === "pending"
                    ? "border-amber-800/60 bg-amber-950/30 text-amber-200"
                    : tu.status === "executing"
                    ? "border-blue-800/60 bg-blue-950/30 text-blue-200"
                    : tu.status === "executed"
                    ? "border-emerald-800/60 bg-emerald-950/30 text-emerald-200"
                    : tu.status === "error"
                    ? "border-red-800/60 bg-red-950/30 text-red-200"
                    : "border-zinc-800 bg-zinc-900/50 text-zinc-400"
                }`}
              >
                <div className="mb-1 font-medium">
                  {tu.status === "executing" ? "Executing..." : describeToolAction(tu.name, tu.input)}
                </div>
                {tu.status === "executed" && tu.result && (
                  <div className="text-emerald-300/80">{tu.result}</div>
                )}
                {tu.status === "error" && tu.result && (
                  <div className="text-red-300/80">{tu.result}</div>
                )}
                {tu.status === "rejected" && (
                  <div className="text-zinc-500">Skipped</div>
                )}
                {tu.status === "pending" && (
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => executeToolAction(msg.id, tu)}
                      className="rounded bg-amber-700/60 px-2 py-1 text-xs font-medium text-amber-100 hover:bg-amber-700/80"
                    >
                      Confirm
                    </button>
                    <button
                      type="button"
                      onClick={() => rejectToolAction(msg.id, tu.id)}
                      className="rounded bg-zinc-800 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-200"
                    >
                      Skip
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        ))}

        {/* Streaming text */}
        {streaming && streamingText && (
          <div className="mr-8 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-300">
            <div className="whitespace-pre-wrap leading-relaxed">
              <ReactMarkdown>{streamingText}</ReactMarkdown>
            </div>
          </div>
        )}

        {/* Streaming pending tools */}
        {streaming && pendingToolUses.map((tu) => (
          <div
            key={tu.id}
            className="mt-2 mr-8 rounded-lg border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-xs text-amber-200"
          >
            <div className="font-medium">{describeToolAction(tu.name, tu.input)}</div>
            <div className="mt-1 text-amber-300/60">Waiting for response to complete...</div>
          </div>
        ))}

        {/* Streaming indicator */}
        {streaming && !streamingText && pendingToolUses.length === 0 && (
          <div className="mr-8 rounded-lg bg-zinc-900 px-3 py-2 text-sm text-zinc-500">
            <span className="animate-pulse">{statusMessage ?? "Thinking..."}</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-zinc-800 px-4 py-3">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={streaming ? "Waiting for response..." : "Ask anything..."}
            disabled={streaming}
            className="flex-1 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-2 text-sm text-zinc-200 placeholder-zinc-600 outline-none focus:border-indigo-700 disabled:opacity-50"
          />
          <button
            type="button"
            onClick={() => sendMessage()}
            disabled={streaming || !input.trim()}
            className="rounded-lg bg-indigo-700 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
