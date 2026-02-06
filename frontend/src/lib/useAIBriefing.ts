"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { AIBriefingRequest, AIBriefingResponse } from "@/lib/ai";
import { getCachedBriefing, setCachedBriefing, clearBriefingCache } from "@/lib/ai";

type UseAIBriefingReturn = {
  briefing: AIBriefingResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
};

export function useAIBriefing(
  context: AIBriefingRequest | null
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
      if (!skipCache && ctx.today) {
        const cached = getCachedBriefing(ctx.today);

        // #region agent log
        void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "H1",
            location: "useAIBriefing.ts:fetchBriefing.cacheCheck",
            message: "Checked cache for AI briefing",
            data: {
              today: ctx.today,
              skipCache,
              cacheHit: Boolean(cached),
              fetchedDateRef: fetchedDateRef.current,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion

        if (cached) {
          setBriefing(cached);
          fetchedDateRef.current = ctx.today;

          // #region agent log
          void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: "debug-session",
              runId: "pre-fix",
              hypothesisId: "H1",
              location: "useAIBriefing.ts:fetchBriefing.cacheHitReturn",
              message: "Returning early from cache",
              data: {
                today: ctx.today,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion

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

        // #region agent log
        void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: "debug-session",
            runId: "pre-fix",
            hypothesisId: "H2",
            location: "useAIBriefing.ts:fetchBriefing.startNetwork",
            message: "Starting network request for briefing",
            data: {
              today: ctx.today,
              requestId,
              skipCache,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
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

          // #region agent log
          void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: "debug-session",
              runId: "pre-fix",
              hypothesisId: "H6",
              location: "useAIBriefing.ts:fetchBriefing.httpError",
              message: "Briefing API returned non-OK response",
              data: {
                today: ctx.today,
                requestId,
                status: response.status,
                payloadError:
                  typeof (payload as Record<string, unknown>).error === "string"
                    ? ((payload as Record<string, unknown>).error as string)
                    : null,
                payloadDetail: detail,
                userMessage,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion

          throw new Error(userMessage);
        }

        const data = (await response.json()) as AIBriefingResponse;
        if (mountedRef.current && requestId === requestIdRef.current) {
          setBriefing(data);
          fetchedDateRef.current = ctx.today;
          if (ctx.today) {
            setCachedBriefing(ctx.today, data);
          }

          // #region agent log
          void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: "debug-session",
              runId: "pre-fix",
              hypothesisId: "H3",
              location: "useAIBriefing.ts:fetchBriefing.success",
              message: "Briefing request succeeded and state updated",
              data: {
                today: ctx.today,
                requestId,
                hasHeadline: Boolean(data.headline),
                hasInsights: Boolean(data.insights?.length),
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        if (mountedRef.current && requestId === requestIdRef.current) {
          setError(err instanceof Error ? err.message : "Failed to fetch briefing");

          // #region agent log
          void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: "debug-session",
              runId: "pre-fix",
              hypothesisId: "H4",
              location: "useAIBriefing.ts:fetchBriefing.error",
              message: "Briefing request errored",
              data: {
                today: ctx.today,
                requestId,
                errorName: (err as Error).name,
                errorMessage: err instanceof Error ? err.message : String(err),
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }
      } finally {
        if (mountedRef.current && requestId === requestIdRef.current) {
          setLoading(false);
          abortRef.current = null;

          // #region agent log
          void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: "debug-session",
              runId: "pre-fix",
              hypothesisId: "H2",
              location: "useAIBriefing.ts:fetchBriefing.finally",
              message: "Finished network request for briefing",
              data: {
                today: ctx.today,
                requestId,
                loading: false,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        }
      }
    },
    []
  );

  // Auto-fire once when context becomes available, or on refresh
  useEffect(() => {
    if (!context) return;
    const currentDate = context.today;
    if (!currentDate) return;

    // #region agent log
    void fetch("http://127.0.0.1:7242/ingest/b0367295-de27-4337-8ba8-522b8572237d", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId: "debug-session",
        runId: "pre-fix",
        hypothesisId: "H5",
        location: "useAIBriefing.ts:autoEffect",
        message: "Auto effect deciding to fetch briefing",
        data: {
          hasContext: Boolean(context),
          today: currentDate,
          refreshCounter,
          fetchedDateRef: fetchedDateRef.current,
          autoRequestedDateRef: autoRequestedDateRef.current,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

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
    clearBriefingCache();
    setBriefing(null);
    fetchedDateRef.current = null;
    setRefreshCounter((c) => c + 1);
  }, [context]);

  return { briefing, loading, error, refresh };
}
