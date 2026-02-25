import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { Focus3AIRequest, Focus3AIResponse } from "@/lib/ai";
import { getRouteUser } from "@/lib/supabase/route";

const SYSTEM_PROMPT_BASE = `You are a calm, identity-focused daily coach embedded in a personal productivity system.

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
   - If "Latest weekly reflection" is provided: weight "what mattered" and "learnings" so today's focus can connect to recent reflection.
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

const SYSTEM_PROMPT_GENTLE = `

Additional (user chose "Gentle" mode): Prefer recovery-friendly framing. When recent reflection mentions difficulty or low energy, favor minimums and identity anchors. Weight "what mattered" and "learnings" from their reflection when selecting focus items.`;

function getSystemPrompt(aiTone?: "standard" | "gentle"): string {
  const gentle = aiTone === "gentle" ? SYSTEM_PROMPT_GENTLE : "";
  return SYSTEM_PROMPT_BASE + gentle;
}

function buildUserPrompt(ctx: Focus3AIRequest): string {
  const sections: string[] = [];

  sections.push(`Today: ${ctx.today} (${ctx.weekday})`);
  sections.push(`Identity score (yesterday, 5 daily checks): ${ctx.identityScore}/5 — today's checks not yet completed.`);

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
      `Habits:\n${ctx.habits
        .map(
          (h) =>
            `- id="${h.id}" | ${h.title} | streak=${h.activeStreak} days | adherence=${h.adherenceLast365}% over the last 365 days, ${h.adherenceCurrentYear}% this calendar year | last7=${h.last7Sum} | period=${h.period}`
        )
        .join("\n")}`
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
    `Identity metrics (yesterday — use for context; today's not yet done):\n${identityOptions.map((q) => `- id="identity-${q.key}" | ${q.label} | ${q.done ? "checked yesterday" : "not checked yesterday"}`).join("\n")}`
  );

  if (ctx.latestReflection) {
    const r = ctx.latestReflection;
    const cap = r.capabilityGrowth === true ? "yes" : r.capabilityGrowth === false ? "no" : "not answered";
    sections.push(
      `Latest weekly reflection (week of ${r.weekStartDate}):\nWhat mattered: ${r.whatMattered || "(empty)"}\nLearnings: ${r.learnings || "(empty)"}\nMore capable than 7 days ago: ${cap}`
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
      `Recent AI observations (for context):\n${ctx.aiObservations.map((o) => `- [${o.category}] ${o.observation}`).join("\n")}`
    );
  }

  return sections.join("\n\n");
}

function parseResponse(text: string): Focus3AIResponse {
  const attemptParse = (raw: string) => {
    const trimmed = raw.trim();
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    const core =
      firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace
        ? trimmed.slice(firstBrace, lastBrace + 1)
        : trimmed;

    // Fix common model mistakes like trailing commas before ] or }
    const sanitized = core.replace(/,\s*([}\]])/g, "$1");
    return JSON.parse(sanitized);
  };

  try {
    const parsed = attemptParse(text);
    return validateResponse(parsed as Record<string, unknown>);
  } catch {
    const fenceMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (fenceMatch) {
      const parsed = attemptParse(fenceMatch[1]);
      return validateResponse(parsed as Record<string, unknown>);
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

export async function POST(request: Request) {
  const { user } = await getRouteUser();
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

  let ctx: Focus3AIRequest;
  let rawBody: string;
  try {
    rawBody = await request.text();
  } catch {
    return NextResponse.json({ error: "Failed to read request body" }, { status: 400 });
  }
  if (!rawBody?.trim()) {
    return NextResponse.json({ error: "Request body is empty" }, { status: 400 });
  }
  try {
    ctx = JSON.parse(rawBody) as Focus3AIRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 512,
      system: getSystemPrompt(ctx.aiTone),
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
    return NextResponse.json(focus3);
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    console.error("AI Focus 3 generation failed", error);
    return NextResponse.json(
      { error: "AI Focus 3 generation failed", detail },
      { status: 502 }
    );
  }
}
