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

  const clientId = getEnv("GOOGLE_CLIENT_ID");
  const clientSecret = getEnv("GOOGLE_CLIENT_SECRET");
  const redirectUri = getEnv("GOOGLE_REDIRECT_URI");

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
  };

  const origin = new URL(request.url).origin;
  const response = NextResponse.redirect(`${origin}/`);
  response.cookies.set("google_access_token", tokenData.access_token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  if (tokenData.refresh_token) {
    response.cookies.set("google_refresh_token", tokenData.refresh_token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
    });
  }
  response.cookies.set("oauth_state_google", "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });

  return response;
}
