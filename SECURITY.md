## Security overview

This project is designed to be safe to open source as long as all sensitive credentials live **only in local environment files**, never in git.

- **Secrets are provided via env vars**:
  - `TODOIST_CLIENT_ID` / `TODOIST_CLIENT_SECRET`
  - `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`
  - `ANTHROPIC_API_KEY`
  - `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- **Environment files**:
  - `frontend/.env.local` (local only, never committed)
  - `frontend/.env.example` (safe template with placeholders)

The repo and its git history have been scanned for common secret patterns and project-specific env names; no actual API keys, OAuth client secrets, passwords, or private keys were found in tracked files or commits.

## Managing secrets

- **Never commit env files**:
  - `.env`, `.env.local`, `frontend/.env`, and `frontend/.env.local` are ignored by git (`.env*` in `frontend/.gitignore` and standard patterns in the root `.gitignore`).
  - Always use `frontend/.env.example` as the template and keep it placeholder-only.
- **Rotate your own credentials** before using this repo in production:
  - Create your own Todoist OAuth app and set `TODOIST_CLIENT_ID` / `TODOIST_CLIENT_SECRET`.
  - Create your own Google OAuth app and set `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET`.
  - Create your own Anthropic API key and set `ANTHROPIC_API_KEY`.
  - Create your own Supabase project and use its `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- **If any secret is ever committed**:
  1. Rotate the secret immediately in the provider dashboard.
  2. (Optional) scrub it from git history using `git filter-repo` or equivalent, then force-push.

## GitHub security settings (recommended)

In the GitHub repository settings for `your-username/Productivity_System`:

- Enable **Secret scanning** and **Push protection** (if available) so GitHub can block accidental pushes of secrets.
- Enable **Dependabot alerts** for vulnerable dependencies.
- Optionally enable **Code scanning** (e.g. CodeQL) for additional static analysis.

These settings live in GitHub and cannot be toggled from this codebase, but they are strongly recommended before running this in production.

