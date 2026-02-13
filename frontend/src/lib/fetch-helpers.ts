export class ApiError extends Error {
  status: number;
  detail?: string;

  constructor(message: string, status: number, detail?: string) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

/**
 * Fetch a local API route and return parsed JSON.
 * Throws ApiError with status-specific messages for 401/429/other failures.
 * If `silent401` is true, returns `null` on 401 instead of throwing.
 */
export async function apiFetch<T>(
  url: string,
  opts?: RequestInit & { silent401?: boolean; label?: string }
): Promise<T | null> {
  const { silent401, label = "API request", ...fetchOpts } = opts ?? {};

  const response = await fetch(url, fetchOpts);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    if (silent401 && response.status === 401) return null;
    if (response.status === 401) {
      throw new ApiError(
        payload.detail ?? payload.error ?? `${label} — not connected`,
        401
      );
    }
    if (response.status === 429) {
      throw new ApiError(
        `Rate limit hit. Try again in a minute.`,
        429
      );
    }
    throw new ApiError(
      payload.detail ?? payload.error ?? `${label} failed`,
      response.status
    );
  }
  return (await response.json()) as T;
}
