// App-level configuration constants for the mobile app.
// All Supabase env vars use EXPO_PUBLIC_ prefix (exposed to client bundle).
// Service role keys must NEVER appear here.
export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const APP_SCHEME = "inputenglish";
export const AUTH_CALLBACK_URL = `${APP_SCHEME}://auth/callback`;
