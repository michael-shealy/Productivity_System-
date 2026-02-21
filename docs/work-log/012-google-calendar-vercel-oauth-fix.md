# 012 — Google Calendar OAuth 404 on Vercel (DEPLOYMENT_NOT_FOUND)

## What was the problem?

On Vercel, after clicking "Connect Google Calendar" and authorizing with Google, the browser was redirected to the OAuth callback URL and showed:

- **404: NOT_FOUND**  
- **Code: DEPLOYMENT_NOT_FOUND**  
- **ID: iad1::…**

The site loaded but no calendar events appeared (connection never completed).

## Why it happened

`DEPLOYMENT_NOT_FOUND` is a **Vercel** error: the request reached Vercel’s edge, but no deployment existed for that URL. In this flow:

1. User clicks Connect → app redirects to Google with `redirect_uri` from env (`GOOGLE_REDIRECT_URI`).
2. User authorizes → Google redirects the browser to that `redirect_uri` (e.g. `https://something.vercel.app/api/google/auth/callback?code=...`).
3. If that URL pointed to a **wrong or old** host (typo, deleted preview, previous project name, or env from another project), Vercel returns 404 DEPLOYMENT_NOT_FOUND.

So the failure was almost certainly a **redirect_uri** that didn’t match the deployment the user was actually using.

## What we changed

1. **Request-based redirect_uri in production**  
   In both `/api/google/auth/start` and `/api/google/auth/callback`, the redirect URI is now derived from the **incoming request** when `NODE_ENV === "production"`:
   - `origin = new URL(request.url).origin`
   - `redirect_uri = origin + "/api/google/auth/callback"`
   So the callback always goes to the **same host** the user is on (the deployment that served the page). No dependency on `GOOGLE_REDIRECT_URI` in production.

2. **Development**  
   In development we still use `GOOGLE_REDIRECT_URI` if set, otherwise the request origin (so localhost works with or without the env var).

3. **Start route receives `request`**  
   The auth start handler was updated from `GET()` to `GET(request: Request)` so we can read `request.url` and build the redirect URI.

4. **Optional `GOOGLE_REDIRECT_URI`**  
   `.env.example` was updated to document that `GOOGLE_REDIRECT_URI` is optional; in production the app uses the request host.

5. **Debug instrumentation**  
   Temporary logs were added (with `#region agent log`) in the start and callback routes to record `requestOrigin`, `redirectUri`, and `requestUrl` for verification. These can be removed after confirming the fix.

## What you need to do

- **Google Cloud Console**  
  In your OAuth client’s **Authorized redirect URIs**, add the **exact** production URL:
  - `https://<your-vercel-production-domain>/api/google/auth/callback`  
  Example: `https://productivity-system.vercel.app/api/google/auth/callback`.  
  You can remove any old or preview URLs that you no longer use.

- **Vercel**  
  You do **not** need to set `GOOGLE_REDIRECT_URI` in Vercel for production. If it’s set to an old or wrong URL, you can remove it; the app will use the request origin. Redeploy after any env change.

- **Events not showing**  
  Once the OAuth callback succeeds (no more 404), the token is stored and calendar events should load. If events still don’t appear, check the browser network tab for `/api/google/events` and any errors in Vercel function logs.

## Concepts

- **OAuth redirect_uri**: Must match exactly between (1) what you send to the provider (Google), (2) what’s registered in the provider’s console, and (3) the URL the user is actually sent to. Using the request origin in production keeps (1) and (3) in sync with the deployment the user is on.
- **Vercel DEPLOYMENT_NOT_FOUND**: The host/path in the request doesn’t correspond to any existing deployment (wrong domain, deleted deployment, or typo in the URL).
