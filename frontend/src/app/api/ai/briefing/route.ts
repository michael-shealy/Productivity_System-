import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import type { AIBriefingRequest, AIBriefingResponse, AIInsightCard } from "@/lib/ai";
import { getRouteUser } from "@/lib/supabase/route";

const SYSTEM_PROMPT_BASE = `You are a calm, identity-focused daily coach embedded in a personal productivity system.

Your tone rules:
- Never shame, guilt, or use deficit language ("you failed", "you didn't", "you're behind").
- Use language of invitation, observation, and gentle encouragement.
- Frame everything through identity ("the person you are becoming") rather than output metrics.
- Be concise — headline ≤ 2 sentences, valuesFocus ≤ 1 sentence, each whyBullet ≤ 1 sentence.
- Every suggestion must cite at least one piece of data from the context (a streak, a task, a habit stat, an event).`;

const SYSTEM_PROMPT_GENTLE = `
Additional tone (user chose "Gentle" mode): Use recovery-focused language. When habit adherence was low or the user reflected on difficulty, emphasize minimums and that no catch-up is needed. Optionally cite their reflection: "Last week you reflected that …" where relevant. Never guilt or deficit language.`;

const SYSTEM_PROMPT_JSON = `
Output ONLY valid JSON matching this exact structure (no markdown fences, no extra text):
{
  "headline": "A 1-2 sentence personalized morning briefing based on today's context.",
  "valuesFocus": "A short values-focus phrase for the day (e.g. 'Values focus: presence, grounded confidence, curiosity').",
  "whyBullets": [
    "Reason 1 citing specific data.",
    "Reason 2 citing specific data.",
    "Reason 3 citing specific data."
  ],
  "insights": [
    {
      "title": "Short insight title",
      "body": "1-2 sentence actionable suggestion.",
      "why": ["Data-backed reason for this insight."]
    }
  ]
}

Rules for insights array:
- Generate 2-4 insight cards.
- Each must have a "why" array with 1-2 reasons grounded in the provided data.
- Prioritize identity practices, habit streaks worth protecting, and today's schedule constraints.
- Never generate more than 4 insights.`;

function getSystemPrompt(aiTone?: "standard" | "gentle"): string {
  const gentle = aiTone === "gentle" ? SYSTEM_PROMPT_GENTLE : "";
  return SYSTEM_PROMPT_BASE + gentle + SYSTEM_PROMPT_JSON;
}

function buildUserPrompt(ctx: AIBriefingRequest): string {
  const sections: string[] = [];

  sections.push(`Today: ${ctx.today}`);
  sections.push(`Morning flow status: ${ctx.morningFlowStatus}`);
  sections.push(`Identity score (yesterday, 5 daily checks): ${ctx.identityScore}/5 — use this for context; the user has not yet completed today's checks.`);

  if (ctx.goals.length > 0) {
    sections.push(
      `Active goals:\n${ctx.goals.map((g) => `- ${g.title} (${g.domain}, ${g.season})`).join("\n")}`
    );
  }

  if (ctx.tasks.length > 0) {
    sections.push(
      `Tasks due today (${ctx.tasks.length}):\n${ctx.tasks.map((t) => `- [P${t.priority}] ${t.title}${t.due ? ` (due ${t.due})` : ""}`).join("\n")}`
    );
  } else {
    sections.push("Tasks due today: none");
  }

  if (ctx.completedTasks.length > 0) {
    sections.push(
      `Already completed today (${ctx.completedTasks.length}):\n${ctx.completedTasks.map((t) => `- ${t.title}`).join("\n")}`
    );
  }

  if (ctx.events.length > 0) {
    sections.push(
      `Calendar events today (${ctx.events.length}):\n${ctx.events.map((e) => `- ${e.time}: ${e.title}`).join("\n")}`
    );
  } else {
    sections.push("Calendar events today: none");
  }

  if (ctx.habitStats.length > 0) {
    sections.push(
      `Top habit streaks:\n${ctx.habitStats.map((h) => `- ${h.title}: ${h.activeStreak}-day streak, ${h.adherencePercent}% adherence, ${h.last7Sum} in last 7 days`).join("\n")}`
    );
  }

  if (ctx.focus3.length > 0) {
    sections.push(
      `Focus 3 for today:\n${ctx.focus3.map((f) => `- ${f.label} (${f.type})`).join("\n")}`
    );
  }

  if (ctx.latestReflection) {
    const r = ctx.latestReflection;
    const cap = r.capabilityGrowth === true ? "yes" : r.capabilityGrowth === false ? "no" : "not answered";
    sections.push(
      `Latest weekly reflection (week of ${r.weekStartDate}):\nWhat went well: ${r.whatWentWell || "(empty)"}\nWhat mattered: ${r.whatMattered || "(empty)"}\nLearnings: ${r.learnings || "(empty)"}\nMore capable than 7 days ago: ${cap}`
    );
  }

  return sections.join("\n\n");
}

function parseResponse(text: string): AIBriefingResponse {
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

function validateResponse(obj: Record<string, unknown>): AIBriefingResponse {
  const headline = typeof obj.headline === "string" ? obj.headline : "";
  const valuesFocus = typeof obj.valuesFocus === "string" ? obj.valuesFocus : "";
  const whyBullets = Array.isArray(obj.whyBullets)
    ? (obj.whyBullets as string[]).filter((b) => typeof b === "string").slice(0, 5)
    : [];
  const insights = Array.isArray(obj.insights)
    ? (obj.insights as Array<Record<string, unknown>>)
        .filter(
          (i) =>
            typeof i.title === "string" &&
            typeof i.body === "string" &&
            Array.isArray(i.why)
        )
        .slice(0, 4)
        .map(
          (i, idx): AIInsightCard => ({
            id: `ai-insight-${idx}`,
            title: i.title as string,
            body: i.body as string,
            why: (i.why as string[]).filter((w) => typeof w === "string").slice(0, 3),
          })
        )
    : [];

  return { headline, valuesFocus, whyBullets, insights };
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

  let ctx: AIBriefingRequest;
  try {
    ctx = (await request.json()) as AIBriefingRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 1024,
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

    const briefing = parseResponse(textBlock.text);
    return NextResponse.json(briefing);
  } catch (error) {
    console.error("AI briefing generation failed", error);
    const detail = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "AI briefing generation failed", detail },
      { status: 502 }
    );
  }
}
