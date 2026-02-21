import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/supabase/route";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

/** Use request origin in production so callback always hits the same deployment (fixes Vercel 404 DEPLOYMENT_NOT_FOUND). Env override only in development or proxy setups. */
function getRedirectUri(request: Request): string {
  const origin = new URL(request.url).origin;
  const fromRequest = `${origin}/api/google/auth/callback`;
  if (process.env.NODE_ENV === "production") return fromRequest;
  return process.env.GOOGLE_REDIRECT_URI || fromRequest;
}

export async function GET(request: Request) {
  const { user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const clientId = getEnv("GOOGLE_CLIENT_ID");
  const redirectUri = getRedirectUri(request);
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "https://www.googleapis.com/auth/calendar",
    access_type: "offline",
    prompt: "consent",
    state,
  });

  const response = NextResponse.redirect(
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
  );
  response.cookies.set("oauth_state_google", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
