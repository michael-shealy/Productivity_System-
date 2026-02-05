import { NextResponse } from "next/server";

function getEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing env var: ${name}`);
  }
  return value;
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
          "Check redirect URI match, client credentials, and that you used the same host for start and callback (localhost vs 127.0.0.1).",
      },
      { status: 400 }
    );
  }

  if (!code) {
    return NextResponse.json(
      {
        error: "Missing code",
        hint:
          "Todoist did not return an auth code. Check redirect URI and that you approved access.",
      },
      { status: 400 }
    );
  }

  const cookieState = request.headers
    .get("cookie")
    ?.match(/oauth_state_todoist=([^;]+)/)?.[1];

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

  const clientId = getEnv("TODOIST_CLIENT_ID");
  const clientSecret = getEnv("TODOIST_CLIENT_SECRET");
  const redirectUri = getEnv("TODOIST_REDIRECT_URI");

  const tokenResponse = await fetch("https://todoist.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  if (!tokenResponse.ok) {
    const errorText = await tokenResponse.text();
    return NextResponse.json(
      { error: "Token exchange failed", detail: errorText },
      { status: 500 }
    );
  }

  const tokenData = (await tokenResponse.json()) as { access_token: string };

  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(`${origin}/`);
  response.cookies.set("todoist_access_token", tokenData.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  response.cookies.set("oauth_state_todoist", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
