// Validated at module load time — any missing var crashes the process immediately
// with a clear message rather than producing a confusing error later.
// Server-only vars (no NEXT_PUBLIC_ prefix) are only validated when this module
// is imported from server code, which is intentional.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `[cartograph] Missing required environment variable: ${name}\n` +
        `Add it to .env.local and restart the dev server.`,
    );
  }
  return value;
}

export const env = {
  supabaseUrl: requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  // Server-only — never sent to the browser.
  supabaseJwtSecret: requireEnv("SUPABASE_JWT_SECRET"),
} as const;
