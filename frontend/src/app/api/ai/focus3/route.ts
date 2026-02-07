import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Focus3AIRequest, Focus3AIResponse } from "@/lib/ai";
import { getRouteUser } from "@/lib/supabase/route";

const SYSTEM_PROMPT = `You are a calm, identity-focused daily coach embedded in a personal productivity system.

Your job: select exactly 3 focus items for today from the provided options (tasks, events, habits, identity metrics).

Process:
1. Review the user's active goals with their seasons/phases to understand current priorities.
2. Summarize which goals are in an active building phase vs. maintenance phase, and weight selections accordingly.
3. Select exactly 3 items, considering:
   - Habit streaks worth protecting (high streaks should not be broken)
   - Weekday patterns (e.g., lighter focus on weekends)
   - How items connect to active goals and their current phase
   - Identity score gaps (unfilled identity metrics are opportunities)
   - Schedule constraints (events that are immovable anchors)
   - Interconnections between items (e.g., gym + nutritional awareness reinforce the same health goal)
4. Each selected item must use an "id" that exactly matches one of the provided option IDs.
5. Return a 1-2 sentence "reasoning" explaining why these 3 were chosen, referencing the user's current phase/priorities and interconnections.

Tone rules:
- Never shame, guilt, or use deficit language.
- Use language of invitation, observation, and gentle encouragement.
- Frame everything through identity ("the person you are becoming") rather than output metrics.

Output ONLY valid JSON matching this exact structure (no markdown fences, no extra text):
{
  "items": [
    { "id": "exact-option-id", "label": "Item label", "type": "Item type" },
    { "id": "exact-option-id", "label": "Item label", "type": "Item type" },
    { "id": "exact-option-id", "label": "Item label", "type": "Item type" }
  ],
  "reasoning": "1-2 sentence explanation citing specific data and interconnections."
}`;

function buildUserPrompt(ctx: Focus3AIRequest): string {
  const sections: string[] = [];

  sections.push(`Today: ${ctx.today} (${ctx.weekday})`);
  sections.push(`Identity score: ${ctx.identityScore}/5`);

  if (ctx.goals.length > 0) {
    sections.push(
      `Active goals:\n${ctx.goals.map((g) => `- ${g.title} (${g.domain}, season: ${g.season})${g.description ? ` — ${g.description}` : ""}`).join("\n")}`
    );
  }

  sections.push("--- AVAILABLE OPTIONS (select exactly 3 by ID) ---");

  if (ctx.tasks.length > 0) {
    sections.push(
      `Tasks:\n${ctx.tasks.map((t) => `- id="${t.id}" | ${t.title} | priority=${t.priority} | status=${t.status}`).join("\n")}`
    );
  }

  if (ctx.events.length > 0) {
    sections.push(
      `Events:\n${ctx.events.map((e) => `- id="${e.id}" | ${e.title} | time=${e.time}`).join("\n")}`
    );
  }

  if (ctx.habits.length > 0) {
    sections.push(
      `Habits:\n${ctx.habits.map((h) => `- id="${h.id}" | ${h.title} | streak=${h.activeStreak} days | adherence=${h.adherencePercent}% | last7=${h.last7Sum} | period=${h.period}`).join("\n")}`
    );
  }

  const identityOptions = [
    { key: "morningGrounding", label: "Morning grounding", done: ctx.identityMetrics.morningGrounding },
    { key: "embodiedMovement", label: "Embodied movement", done: ctx.identityMetrics.embodiedMovement },
    { key: "nutritionalAwareness", label: "Nutritional awareness", done: ctx.identityMetrics.nutritionalAwareness },
    { key: "presentConnection", label: "Present connection", done: ctx.identityMetrics.presentConnection },
    { key: "curiositySpark", label: "Curiosity spark", done: ctx.identityMetrics.curiositySpark },
  ];
  sections.push(
    `Identity metrics:\n${identityOptions.map((q) => `- id="identity-${q.key}" | ${q.label} | ${q.done ? "already checked" : "not yet checked"}`).join("\n")}`
  );

  return sections.join("\n\n");
}

function parseResponse(text: string): Focus3AIResponse {
  try {
    const parsed = JSON.parse(text);
    return validateResponse(parsed);
  } catch {
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      const parsed = JSON.parse(fenceMatch[1]);
      return validateResponse(parsed);
    }
    throw new Error("Could not parse AI response as JSON");
  }
}

function validateResponse(obj: Record<string, unknown>): Focus3AIResponse {
  const items = Array.isArray(obj.items)
    ? (obj.items as Array<Record<string, unknown>>)
        .filter(
          (i) =>
            typeof i.id === "string" &&
            typeof i.label === "string" &&
            typeof i.type === "string"
        )
        .slice(0, 3)
        .map((i) => ({
          id: i.id as string,
          label: i.label as string,
          type: i.type as string,
        }))
    : [];

  const reasoning = typeof obj.reasoning === "string" ? obj.reasoning : "";

  return { items, reasoning };
}

const DEBUG_LOG = (msg: string, data: Record<string, unknown>) => {
  fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ location: "api/ai/focus3/route.ts", message: msg, data, timestamp: Date.now(), hypothesisId: "H3" }) }).catch(() => {});
};

export async function POST(request: Request) {
  const { user } = await getRouteUser();
  // #region agent log
  DEBUG_LOG("POST entry", { hasUser: !!user });
  // #endregion
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    DEBUG_LOG("no API key", {});
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  let ctx: Focus3AIRequest;
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch (e) {
    DEBUG_LOG("body read error", { err: String(e) });
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }
  if (!rawBody?.trim()) {
    DEBUG_LOG("empty body", {});
    return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
  }
  try {
    ctx = JSON.parse(rawBody) as Focus3AIRequest;
  } catch {
    DEBUG_LOG("invalid JSON", { bodyLen: rawBody.length, preview: rawBody.slice(0, 100) });
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    // #region agent log
    DEBUG_LOG("calling Anthropic", {});
    // #endregion
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: buildUserPrompt(ctx),
        },
      ],
    });

    const textBlock = message.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json(
        { error: "No text in AI response" },
        { status: 502 }
      );
    }

    const focus3 = parseResponse(textBlock.text);
    // #region agent log
    DEBUG_LOG("success", { itemsLen: focus3.items.length });
    // #endregion
    return NextResponse.json(focus3);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    // #region agent log
    DEBUG_LOG("catch", { detail });
    // #endregion
    console.error("AI Focus 3 generation failed", error);
    return NextResponse.json(
      { error: "AI Focus 3 generation failed", detail },
      { status: 502 }
    );
  }
}
