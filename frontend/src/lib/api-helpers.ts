import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/supabase/route";
import { getOAuthToken } from "@/lib/supabase/tokens";

type TokenResult =
  | { token: string; error?: undefined }
  | { token?: undefined; error: NextResponse };

/**
 * Fetch the OAuth access token for a provider (todoist or google).
 * Returns `{ token }` on success, or `{ error: NextResponse }` on failure (401).
 */
export async function requireProviderToken(
  provider: "todoist" | "google"
): Promise<TokenResult> {
  const { supabase, user } = await getRouteUser();
  if (!user) {
    return {
      error: NextResponse.json(
        { error: `Missing ${provider} token` },
        { status: 401 }
      ),
    };
  }
  const result = await getOAuthToken(supabase, user.id, provider);
  const accessToken = result?.access_token ?? null;
  if (!accessToken) {
    return {
      error: NextResponse.json(
        { error: `Missing ${provider} token` },
        { status: 401 }
      ),
    };
  }
  return { token: accessToken };
}

/**
 * Log an API error and return a JSON error response.
 * Preserves 429 status; all other errors become 500.
 */
export function apiErrorResponse(
  label: string,
  status: number,
  detail: string
): NextResponse {
  console.error(label, { status, detail });
  return NextResponse.json(
    { error: label, detail },
    { status: status === 429 ? 429 : 500 }
  );
}
