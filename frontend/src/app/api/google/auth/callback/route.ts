import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/supabase/route";
import { upsertOAuthToken } from "@/lib/supabase/tokens";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

/** Must match the redirect_uri used in auth start (request-based so callback hits same deployment). */
function getRedirectUri(request: Request): string {
  const origin = new URL(request.url).origin;
  const fromRequest = `${origin}/api/google/auth/callback`;
  if (process.env.NODE_ENV === "production") return fromRequest;
  return process.env.GOOGLE_REDIRECT_URI || fromRequest;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");
  const errorDescription = searchParams.get("error_description");

  if (error) {
    return NextResponse.json(
      {
        error,
        errorDescription,
        hint:
          "Google denied access. Verify OAuth consent screen, test users, and redirect URI in Google Cloud Console.",
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      {
        error: "Missing code",
        hint:
          "Google did not return an auth code. Check consent screen and redirect URI.",
      },
      { status: 400 }
    );
  }

  const cookieState = request.headers
    .get("cookie")
    ?.match(/oauth_state_google=([^;]+)/)?.[1];

  if (!state || !cookieState || state !== cookieState) {
    return NextResponse.json(
      {
        error: "Invalid state",
        hint:
          "State mismatch. Ensure you started auth from the same browser/host and cookies are enabled.",
      },
      { status: 400 }
    );
  }

  const { supabase, user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const clientId = getEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = getRedirectUri(request);

  const params = new URLSearchParams({
    code,
    client_id: clientId,
    client_secret: clientSecret,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!tokenResponse.ok) {
    const detail = await tokenResponse.text();
    return NextResponse.json(
      { error: "Token exchange failed", detail },
      { status: 500 }
    );
  }

  const tokenData = (await tokenResponse.json()) as {
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
  };

  await upsertOAuthToken(
    supabase,
    user.id,
    "google",
    tokenData.access_token,
    tokenData.refresh_token,
    tokenData.expires_in
  );

  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(`${origin}/`);
  // Clear the CSRF state cookie
  response.cookies.set("oauth_state_google", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
