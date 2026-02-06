import { NextResponse } from "next/server";
import { getRouteUser } from "@/lib/supabase/route";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
}

export async function GET() {
  const { user } = await getRouteUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const clientId = getEnv("TODOIST_CLIENT_ID");
  const redirectUri = getEnv("TODOIST_REDIRECT_URI");
  const state = crypto.randomUUID();

  const params = new URLSearchParams({
    client_id: clientId,
    scope: "data:read_write",
    redirect_uri: redirectUri,
    state,
  });

  const response = NextResponse.redirect(
    `https://todoist.com/oauth/authorize?${params.toString()}`
  );
  response.cookies.set("oauth_state_todoist", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });

  return response;
}
