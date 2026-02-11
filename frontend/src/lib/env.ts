/**
 * Environment variable validation.
 * Client vars (NEXT_PUBLIC_*) are available in the browser.
 * Server vars are only available in API routes / server components.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] || fallback;
}

/** Server-only env vars — call from API routes only */
export function getServerEnv() {
  return {
    TODOIST_CLIENT_ID: required("TODOIST_CLIENT_ID"),
    TODOIST_CLIENT_SECRET: required("TODOIST_CLIENT_SECRET"),
    TODOIST_REDIRECT_URI: required("TODOIST_REDIRECT_URI"),
    GOOGLE_CLIENT_ID: required("GOOGLE_CLIENT_ID"),
    GOOGLE_CLIENT_SECRET: required("GOOGLE_CLIENT_SECRET"),
    GOOGLE_REDIRECT_URI: required("GOOGLE_REDIRECT_URI"),
    ANTHROPIC_API_KEY: required("ANTHROPIC_API_KEY"),
  };
}

/** Client-safe env vars — available in browser + server */
export function getPublicEnv() {
  return {
    NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    NEXT_PUBLIC_APP_URL: optional("NEXT_PUBLIC_APP_URL", "http://localhost:3000"),
  };
}
