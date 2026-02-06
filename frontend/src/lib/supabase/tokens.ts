import type { SupabaseClient } from "@supabase/supabase-js";
import type { OAuthProvider } from "./types";

type TokenResult = { access_token: string } | null;

export async function getOAuthToken(
  supabase: SupabaseClient,
  userId: string,
  provider: OAuthProvider
): Promise<TokenResult> {
  const { data, error } = await supabase
    .from("user_oauth_tokens")
    .select("access_token, refresh_token, token_expires_at")
    .eq("user_id", userId)
    .eq("provider", provider)
    .single();

  if (error || !data) return null;

  // For Google: auto-refresh if expired
  if (provider === "google" && data.token_expires_at && data.refresh_token) {
    const expiresAt = new Date(data.token_expires_at).getTime();
    const now = Date.now();
    // Refresh if expires within 5 minutes
    if (now > expiresAt - 5 * 60 * 1000) {
      const refreshed = await refreshGoogleToken(
        supabase,
        userId,
        data.refresh_token
      );
      if (refreshed) return { access_token: refreshed };
    }
  }

  return { access_token: data.access_token };
}

async function refreshGoogleToken(
  supabase: SupabaseClient,
  userId: string,
  refreshToken: string
): Promise<string | null> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!response.ok) {
    console.error("Google token refresh failed", await response.text());
    return null;
  }

  const tokenData = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

  await supabase
    .from("user_oauth_tokens")
    .update({
      access_token: tokenData.access_token,
      token_expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("provider", "google");

  return tokenData.access_token;
}

export async function upsertOAuthToken(
  supabase: SupabaseClient,
  userId: string,
  provider: OAuthProvider,
  accessToken: string,
  refreshToken?: string | null,
  expiresIn?: number | null
) {
  const tokenExpiresAt = expiresIn
    ? new Date(Date.now() + expiresIn * 1000).toISOString()
    : null;

  const { error } = await supabase.from("user_oauth_tokens").upsert(
    {
      user_id: userId,
      provider,
      access_token: accessToken,
      refresh_token: refreshToken ?? null,
      token_expires_at: tokenExpiresAt,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,provider" }
  );

  if (error) {
    console.error(`Failed to upsert ${provider} token`, error);
    throw error;
  }
}
