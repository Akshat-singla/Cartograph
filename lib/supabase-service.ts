// Service-role Supabase client — bypasses RLS entirely.
// Used only inside the pipeline runner, which runs in server-side code and
// writes rows on behalf of a user whose org_id we supply explicitly.
//
// Never import this from a component, a route handler that handles user input
// without pre-validation, or anything that runs in a browser.
// The service key must stay server-only (no NEXT_PUBLIC_ prefix).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { env } from "./env";

let _client: SupabaseClient | null = null;

// Singleton — one service client for the process lifetime.
// The service key doesn't change, so there's no reason to create a new
// client per request the way the auth client does.
export function createSupabaseServiceClient(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(env.supabaseUrl, env.supabaseServiceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  return _client;
}
