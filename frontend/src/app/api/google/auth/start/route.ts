import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/supabase/route";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

/** Build public origin so redirect_uri matches Google Console (Vercel can expose internal request.url). */
function getOrigin(request: Request): string {
  if (process.env.NODE_ENV !== "production") {
    return new URL(request.url).origin;
  }
  const host = request.headers.get("x-forwarded-host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) {
    return `${proto}://${host}`;
  }
  const vercelUrl = process.env.VERCEL_URL;
  if (vercelUrl) {
    return `https://${vercelUrl}`;
  }
  return new URL(request.url).origin;
}

function getRedirectUri(request: Request): string {
  const origin = getOrigin(request);
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
