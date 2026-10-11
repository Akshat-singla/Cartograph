// Browser-side Supabase client.
// Uses the Clerk session token so RLS policies see the correct org claim.
// @clerk/nextjs exports useAuth() for client components — getToken() on that
// hook returns the active session JWT the same way the server-side auth() does.
//
// This module is intentionally client-only: it calls useAuth() at the call
// site (not here), so callers must pass getToken in rather than importing
// useAuth here (which would make this file a React module and break tree-shaking
// for server paths).
//
// Pattern: call createSupabaseBrowserClient(getToken) once per component mount,
// memoised in a ref so the client is stable for the lifetime of the component.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ vars are available in the browser bundle.
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type GetToken = () => Promise<string | null>;

export function createSupabaseBrowserClient(getToken: GetToken): SupabaseClient {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    accessToken: getToken,
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Create a browser Supabase client and set the realtime auth token explicitly.
 * Call this inside a useEffect after getToken() has resolved — the accessToken
 * constructor option calls getToken() synchronously at creation time, which
 * returns null before Clerk has hydrated and silently breaks the realtime
 * websocket auth.
 */
export async function createSupabaseBrowserClientWithAuth(
  getToken: GetToken,
): Promise<SupabaseClient> {
  const token = await getToken();
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    accessToken: () => Promise.resolve(token),
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  if (token) {
    client.realtime.setAuth(token);
  }
  return client;
}
