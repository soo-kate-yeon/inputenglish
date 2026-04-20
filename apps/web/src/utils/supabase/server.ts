import { createServerClient } from "@supabase/ssr";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  const payload = token.split(".")[1];
  if (!payload) {
    return null;
  }

  try {
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      "=",
    );
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function getSupabaseUrlHost(url: string | undefined): string | null {
  if (!url) {
    return null;
  }

  try {
    return new URL(url).host;
  } catch {
    return null;
  }
}

function getAdminSupabaseUrl(): string {
  const configuredUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleClaims = decodeJwtPayload(
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
  const serviceRoleRef =
    typeof serviceRoleClaims?.ref === "string" ? serviceRoleClaims.ref : null;

  if (!serviceRoleRef) {
    return configuredUrl;
  }

  const derivedUrl = `https://${serviceRoleRef}.supabase.co`;
  const configuredHost = getSupabaseUrlHost(configuredUrl);
  const derivedHost = getSupabaseUrlHost(derivedUrl);

  if (configuredHost && derivedHost && configuredHost !== derivedHost) {
    console.warn("[SupabaseServer] Admin client URL mismatch detected:", {
      configuredHost,
      derivedHost,
    });
  }

  return derivedUrl;
}

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
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
              cookieStore.set(name, value, options),
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
}

// Service role client for admin API routes — bypasses RLS entirely.
// Never expose this to the browser; use only in server-side API routes.
export function createAdminClient() {
  return createSupabaseClient(
    getAdminSupabaseUrl(),
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
