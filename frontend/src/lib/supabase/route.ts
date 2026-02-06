import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Create a Supabase client for use in API route handlers.
 * Returns the client and a helper to get the authenticated user.
 */
export async function createRouteClient() {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Ignored in read-only contexts
          }
        },
      },
    }
  );

  return supabase;
}

/**
 * Get the authenticated user from an API route, or return null.
 */
export async function getRouteUser() {
  const supabase = await createRouteClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return { supabase, user };
}
