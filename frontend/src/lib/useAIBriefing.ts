"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AIBriefingRequest, AIBriefingResponse } from "@/lib/ai";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadAIBriefing, saveAIBriefing, deleteAIBriefing } from "@/lib/supabase/data";

type UseAIBriefingReturn = {
  briefing: AIBriefingResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useAIBriefing(
  context: AIBriefingRequest | null,
  supabase: SupabaseClient | null,
  userId: string | null
): UseAIBriefingReturn {
  const [briefing, setBriefing] = useState<AIBriefingResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshCounter, setRefreshCounter] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const fetchedDateRef = useRef<string | null>(null);
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const autoRequestedDateRef = useRef<string | null>(null);

  const todayKey = context?.today ?? null;

  // Reset on date change
  useEffect(() => {
    if (todayKey && fetchedDateRef.current && fetchedDateRef.current !== todayKey) {
      setBriefing(null);
      setError(null);
      fetchedDateRef.current = null;
      autoRequestedDateRef.current = null;
    }
  }, [todayKey]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (abortRef.current) {
        abortRef.current.abort();
      }
    };
  }, []);

  const fetchBriefing = useCallback(
    async (ctx: AIBriefingRequest, skipCache: boolean) => {
      // Check Supabase cache first
      if (!skipCache && ctx.today && supabase && userId) {
        const cached = await loadAIBriefing(supabase, userId, ctx.today);
        if (cached) {
          setBriefing(cached);
          fetchedDateRef.current = ctx.today;
          return;
        }
      }

      // Abort any in-flight request
      if (abortRef.current) {
        abortRef.current.abort();
      }
      const controller = new AbortController();
      abortRef.current = controller;

      requestIdRef.current += 1;
      const requestId = requestIdRef.current;

      if (mountedRef.current) {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetch("/api/ai/briefing", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(ctx),
          signal: controller.signal,
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => ({}));

          const rawError =
            typeof (payload as Record<string, unknown>).error === "string"
              ? ((payload as Record<string, unknown>).error as string)
              : null;

          const detail =
            typeof (payload as Record<string, unknown>).detail === "string"
              ? ((payload as Record<string, unknown>).detail as string)
              : null;

          const detailLower = detail?.toLowerCase() ?? "";

          let userMessage: string;

          if (response.status === 503 && rawError === "ANTHROPIC_API_KEY not configured") {
            userMessage =
              "AI briefing unavailable — Anthropic API key is not configured on the server.";
          } else if (detailLower.includes("credit balance is too low")) {
            userMessage =
              "AI briefing unavailable — no Anthropic API credits are currently available.";
          } else if (
            response.status === 401 ||
            detailLower.includes("invalid api key") ||
            detailLower.includes("authentication") ||
            detailLower.includes("unauthorized")
          ) {
            userMessage =
              "AI briefing unavailable — Anthropic API key is invalid or has expired.";
          } else if (
            response.status === 429 ||
            detailLower.includes("rate limit") ||
            detailLower.includes("too many requests")
          ) {
            userMessage =
              "AI briefing temporarily unavailable — Anthropic rate limit has been reached. Try again in a moment.";
          } else if (
            response.status >= 500 ||
            detailLower.includes("server error") ||
            detailLower.includes("unavailable")
          ) {
            userMessage =
              "AI briefing temporarily unavailable — Anthropic service is experiencing issues.";
          } else {
            userMessage =
              rawError ??
              "AI briefing unavailable due to an unexpected error connecting to Anthropic.";
          }

          throw new Error(userMessage);
        }

        const data = (await response.json()) as AIBriefingResponse;
        if (mountedRef.current && requestId === requestIdRef.current) {
          setBriefing(data);
          fetchedDateRef.current = ctx.today;
          // Save to Supabase cache
          if (ctx.today && supabase && userId) {
            saveAIBriefing(supabase, userId, ctx.today, data).catch(() => {});
          }
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (mountedRef.current && requestId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : "Failed to fetch briefing");
        }
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false);
          abortRef.current = null;
        }
      }
    },
    [supabase, userId]
  );

  // Auto-fire once when context becomes available, or on refresh
  useEffect(() => {
    if (!context) return;
    const currentDate = context.today;
    if (!currentDate) return;

    if (refreshCounter === 0) {
      if (autoRequestedDateRef.current === currentDate) {
        return;
      }
      autoRequestedDateRef.current = currentDate;
      fetchBriefing(context, false);
    } else {
      fetchedDateRef.current = null;
      fetchBriefing(context, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, fetchBriefing, refreshCounter]);

  const refresh = useCallback(() => {
    if (!context) return;
    // Delete Supabase cache for today
    if (context.today && supabase && userId) {
      deleteAIBriefing(supabase, userId, context.today).catch(() => {});
    }
    setBriefing(null);
    fetchedDateRef.current = null;
    setRefreshCounter((c) => c + 1);
  }, [context, supabase, userId]);

  return { briefing, loading, error, refresh };
}
