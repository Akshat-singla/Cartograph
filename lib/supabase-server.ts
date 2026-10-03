// Server-only. Never import this from a client component.
// Sessions belong to Clerk. Supabase receives the Clerk JWT on every request
// via the accessToken option, which makes the org claim available inside RLS
// policies through auth.jwt() -> org_id.
// @supabase/ssr is intentionally NOT used here — it owns its own cookie-based
// session system that conflicts with Clerk owning the session.

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { auth } from "@clerk/nextjs/server";
import { env } from "./env";

export function createSupabaseServerClient(): SupabaseClient {
  return createClient(env.supabaseUrl, env.supabaseAnonKey, {
    // accessToken is called per request. Clerk's getToken() returns the
    // active session JWT, which Supabase verifies against SUPABASE_JWT_SECRET.
    accessToken: async () => {
      const { getToken } = await auth();
      return getToken();
    },
    auth: {
      // Disable Supabase Auth entirely — Clerk owns the session.
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
