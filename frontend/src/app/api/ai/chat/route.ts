import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getRouteUser } from "@/lib/supabase/route";
import { getOAuthToken } from "@/lib/supabase/tokens";
import { CHAT_TOOLS, READ_ONLY_TOOLS, getChatSystemPrompt } from "@/lib/chat";
import { fetchGoogleCalendarEvents } from "@/lib/google-calendar";

type RequestBody = {
  messages: Array<{
    role: "user" | "assistant";
    content: string | Array<{ type: string; [key: string]: unknown }>;
  }>;
  context: string;
  aiTone?: "standard" | "gentle";
};

const MAX_AGENTIC_LOOPS = 3;

/** Execute a read-only tool server-side and return the result as a string. */
async function executeReadOnlyTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  googleAccessToken: string | null
): Promise<string> {
  if (toolName === "get_events") {
    if (!googleAccessToken) {
      return JSON.stringify({
        error: "Google Calendar is not connected. The user needs to connect their Google account in the app settings.",
      });
    }

    const startDate = toolInput.startDate as string | undefined;
    const endDate = toolInput.endDate as string | undefined;

    if (!startDate || !endDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
      return JSON.stringify({ error: "Invalid date format. Use YYYY-MM-DD." });
    }

    // Validate range isn't too large (max 30 days)
    const start = new Date(startDate);
    const end = new Date(endDate);
    const daysDiff = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (daysDiff < 0 || daysDiff > 30) {
      return JSON.stringify({ error: "Date range must be 0-30 days." });
    }

    const timeMinDate = new Date(startDate + "T00:00:00Z");
    const timeMaxDate = new Date(endDate + "T23:59:59Z");
    const timeMin = timeMinDate.toISOString();
    const timeMax = timeMaxDate.toISOString();

    const events = await fetchGoogleCalendarEvents(googleAccessToken, timeMin, timeMax);

    const summary = events.map((e) => ({
      id: e.id,
      title: e.title,
      start: e.start?.dateTime ?? e.start?.date ?? null,
      end: e.end?.dateTime ?? e.end?.date ?? null,
      allDay: !e.start?.dateTime,
      calendarId: e.calendarId,
    }));

    // Group events by calendar date and attach ground-truth weekday labels
    const dayMap = new Map<
      string,
      {
        date: string;
        weekday: string;
        events: typeof summary;
      }
    >();

    for (const ev of summary) {
      if (!ev.start) continue;
      // Derive the calendar date portion (YYYY-MM-DD) regardless of datetime vs date-only.
      const dateStr = ev.start.slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) continue;

      let day = dayMap.get(dateStr);
      if (!day) {
        // Use noon UTC to avoid any timezone edge cases when computing weekday.
        const d = new Date(dateStr + "T12:00:00Z");
        const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
        day = { date: dateStr, weekday, events: [] };
        dayMap.set(dateStr, day);
      }
      day.events.push(ev);
    }

    const days = Array.from(dayMap.values()).sort((a, b) =>
      a.date.localeCompare(b.date)
    );

    return JSON.stringify({
      startDate,
      endDate,
      count: summary.length,
      events: summary,
      days,
    });
  }

  return JSON.stringify({ error: `Unknown tool: ${toolName}` });
}

export async function POST(request: Request) {
  const { supabase, user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (!body.messages?.length) {
    return NextResponse.json({ error: "No messages provided" }, { status: 400 });
  }

  // Pre-fetch Google token for potential get_events calls
  const googleTokenResult = await getOAuthToken(supabase, user.id, "google");
  const googleAccessToken = googleTokenResult?.access_token ?? null;

  const client = new Anthropic({ apiKey });
  const systemPrompt = getChatSystemPrompt(body.aiTone);

  const encoder = new TextEncoder();
  const readable = new ReadableStream({
    async start(controller) {
      try {
        // Mutable messages array that grows with agentic loop iterations
        const messages = [...body.messages] as Anthropic.MessageParam[];
        let loopCount = 0;

        while (loopCount < MAX_AGENTIC_LOOPS) {
          loopCount++;

          const stream = await client.messages.create({
            model: "claude-sonnet-4-5-20250929",
            max_tokens: 2048,
            system: systemPrompt,
            messages,
            tools: CHAT_TOOLS as Anthropic.Tool[],
            stream: true,
          });

          // Accumulate all content blocks from this turn
          const contentBlocks: Anthropic.ContentBlock[] = [];
          let currentTextContent = "";
          let currentToolId = "";
          let currentToolName = "";
          let toolInputJson = "";
          let inToolInput = false;
          let stopReason: string | null = null;

          for await (const event of stream) {
            if (event.type === "content_block_start") {
              if (event.content_block.type === "text") {
                currentTextContent = "";
              } else if (event.content_block.type === "tool_use") {
                currentToolId = event.content_block.id;
                currentToolName = event.content_block.name;
                toolInputJson = "";
                inToolInput = true;
              }
            } else if (event.type === "content_block_delta") {
              if (event.delta.type === "text_delta") {
                currentTextContent += event.delta.text;
                // Always stream text deltas to the client
                const sseData = JSON.stringify({
                  type: "text_delta",
                  text: event.delta.text,
                });
                controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
              } else if (event.delta.type === "input_json_delta") {
                toolInputJson += event.delta.partial_json;
              }
            } else if (event.type === "content_block_stop") {
              if (inToolInput) {
                let parsedInput: Record<string, unknown> = {};
                try {
                  parsedInput = JSON.parse(toolInputJson || "{}");
                } catch {
                  // If parsing fails, use empty object
                }

                // Accumulate the tool_use block
                contentBlocks.push({
                  type: "tool_use",
                  id: currentToolId,
                  name: currentToolName,
                  input: parsedInput,
                } as Anthropic.ToolUseBlock);

                if (!READ_ONLY_TOOLS.has(currentToolName)) {
                  // Write tool — relay to client for confirmation
                  const sseData = JSON.stringify({
                    type: "tool_use",
                    id: currentToolId,
                    name: currentToolName,
                    input: parsedInput,
                  });
                  controller.enqueue(encoder.encode(`data: ${sseData}\n\n`));
                }
                // Read-only tools: don't send tool_use to client

                inToolInput = false;
                currentToolId = "";
                currentToolName = "";
                toolInputJson = "";
              } else if (currentTextContent) {
                contentBlocks.push({
                  type: "text",
                  text: currentTextContent,
                } as Anthropic.TextBlock);
                currentTextContent = "";
              }
            } else if (event.type === "message_delta") {
              stopReason = event.delta.stop_reason ?? null;
            }
          }

          // Check if we need to handle read-only tool calls
          const toolUseBlocks = contentBlocks.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
          );
          const readOnlyBlocks = toolUseBlocks.filter((b) => READ_ONLY_TOOLS.has(b.name));

          if (stopReason === "tool_use" && readOnlyBlocks.length > 0 && readOnlyBlocks.length === toolUseBlocks.length) {
            // All tool calls are read-only — execute server-side and loop
            // Send status to client
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "status", message: "Checking your calendar..." })}\n\n`
              )
            );

            // Append assistant turn with all content blocks
            messages.push({
              role: "assistant",
              content: contentBlocks as Anthropic.ContentBlockParam[],
            });

            // Execute each read-only tool and collect results
            const toolResults: Anthropic.ToolResultBlockParam[] = [];
            for (const block of readOnlyBlocks) {
              const result = await executeReadOnlyTool(
                block.name,
                block.input as Record<string, unknown>,
                googleAccessToken
              );
              toolResults.push({
                type: "tool_result",
                tool_use_id: block.id,
                content: result,
              });
            }

            // Append tool results as user turn
            messages.push({
              role: "user",
              content: toolResults,
            });

            // Continue the loop — the AI will generate a new response
            continue;
          }

          // Not a read-only-only tool call (or no tool calls, or mixed) — we're done
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
          );
          break;
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : "Stream error";
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ type: "error", message })}\n\n`
          )
        );
      } finally {
        controller.close();
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
