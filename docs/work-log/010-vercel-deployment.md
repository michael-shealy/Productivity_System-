# 010 — Vercel Deployment via GitHub

## What this doc covers

Step-by-step procedure to deploy the Daily System (Next.js app in `frontend/`) to Vercel using the remote GitHub repo. The app lives in a **subdirectory** (`frontend/`), so Vercel project settings must be configured accordingly.

## Pre-deploy checklist (Vercel project settings)

| Item | What to do |
|------|------------|
| **Root directory** | In Vercel → Project → Settings → General, set **Root Directory** to `frontend`. Leave "Include source files outside of the Root Directory" unchecked. |
| **Build & output** | Defaults are fine: **Build Command** `npm run build`, **Output Directory** default (Next.js). |
| **Node version** | Vercel default (e.g. 20.x). Override only if you hit compatibility issues. |
| **Environment variables** | Add all vars from `frontend/.env.example` in Vercel → Settings → Environment Variables with **production** values (see below). |
| **OAuth redirect URIs** | After the first deploy you get a URL like `https://<project>.vercel.app`. Add that base and callback paths in **Todoist** and **Google** OAuth app settings, and set the same URLs in Vercel env. |

## Environment variables in Vercel

Add in **Vercel → Project → Settings → Environment Variables**. Use **Production** (and optionally Preview if you want branch deploys to work with OAuth).

| Variable | Production value | Notes |
|----------|------------------|--------|
| `NEXT_PUBLIC_APP_URL` | `https://<your-vercel-domain>` | e.g. `https://productivity-system.vercel.app` or custom domain |
| `TODOIST_CLIENT_ID` | (same as local) | From Todoist OAuth app |
| `TODOIST_CLIENT_SECRET` | (same as local) | From Todoist OAuth app |
| `TODOIST_REDIRECT_URI` | `https://<your-vercel-domain>/api/todoist/auth/callback` | Must match exactly what you register in Todoist |
| `GOOGLE_CLIENT_ID` | (same as local) | From Google Cloud OAuth client |
| `GOOGLE_CLIENT_SECRET` | (same as local) | From Google Cloud OAuth client |
| `GOOGLE_REDIRECT_URI` | *(optional in production)* | In production the app uses the request host. Only set for local dev or proxy; see work-log 012. |
| `ANTHROPIC_API_KEY` | (same as local) | For AI briefing API route |
| `NEXT_PUBLIC_SUPABASE_URL` | (same as local) | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (same as local) | Supabase anon key |

**Order of operations:** Deploy once to get the Vercel URL, then add that exact callback URL in Todoist and Google OAuth apps, and set `NEXT_PUBLIC_APP_URL` and both `*_REDIRECT_URI` vars in Vercel. Redeploy after adding or changing env.

**Optional:** If you use Supabase Auth redirect URLs (e.g. email confirmation), add `https://<your-vercel-domain>/**` in Supabase Dashboard → Authentication → URL Configuration.

## Confirm Vercel is connected to GitHub

- Log in at [vercel.com](https://vercel.com) and open the project (or create it by importing the repo).
- **Settings → Git**: confirm **Connected Git Repository** is your repo and the correct GitHub org/user.
- **Production branch**: usually `main`. Pushes to this branch trigger production deploys.

If the project is not yet created: **Add New → Project**, import from GitHub, select the repo, then set **Root Directory** to `frontend` in the import wizard (or in Settings → General right after).

**Project name:** Vercel pre-fills the name from the repo (`Productivity_System`). That name is rejected because project names must be **lowercase** only (and digits, `.`, `_`, `-`). Change the project name to e.g. `productivity-system` or `daily-system` before creating the project to avoid the error.

## Deploy procedure (via remote GitHub repo)

1. **Commit and push to the production branch (e.g. `main`):**
   ```bash
   git add .
   git commit -m "Your message"
   git push origin main
   ```
2. **Vercel auto-builds** on push. Open Vercel dashboard → **Deployments** to see status (Building → Ready).
3. Open the deployment URL from the Deployments list, or the default production URL (e.g. `https://<project>.vercel.app`).
4. **If you added or changed environment variables**, trigger a redeploy: **Deployments → … on latest → Redeploy**, or push an empty commit: `git commit --allow-empty -m "Redeploy" && git push origin main`.

No need to run the Vercel CLI locally for normal deploys once Git integration is set up.

## Local verification before push

From the repo root:

```bash
cd frontend
npm run build
```

If the build fails locally, it will fail on Vercel. Fix any errors before relying on the GitHub → Vercel pipeline.

## Notes

- **Custom domain:** If you add a custom domain in Vercel, set `NEXT_PUBLIC_APP_URL` and both redirect URIs to that domain, and update Todoist/Google OAuth apps with the same callback URLs.
- **Preview deploys:** To use OAuth on preview URLs (e.g. branch deploys), add those callback URLs in Todoist and Google (they allow multiple redirect URIs).
- **Existing project with wrong root:** If the Vercel project was created with Root Directory at repo root, change **Settings → General → Root Directory** to `frontend` and save; the next deploy will use the correct directory.
