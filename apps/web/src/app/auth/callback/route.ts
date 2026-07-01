// @MX:ANCHOR: [AUTO] GET /auth/callback — OAuth/OTP session establishment + UserProfile upsert.
// @MX:REASON: [AUTO] Fan-in from all 3 web auth flows (Google OAuth, Apple OAuth, email OTP —
//   see login-actions.ts). Establishes the SSR cookie session via exchangeCodeForSession, then
//   ensures a UserProfile row exists (idempotent upsert — never duplicates an existing row,
//   EC-001-C) before branching to onboarding or learning home (REQ-WEB-001-E2).
// @MX:SPEC: SPEC-WEB-001 - Phase 1 (REQ-WEB-001-E2)
import { NextRequest, NextResponse } from "next/server";
import { createAdminClient, createClient } from "@/utils/supabase/server";

function redirectTo(request: NextRequest, pathname: string): NextResponse {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  url.search = "";
  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");

  if (!code) {
    return redirectTo(request, "/login");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data?.session?.user) {
    console.error("[auth/callback] code exchange failed", {
      error: error?.message ?? null,
    });
    return redirectTo(request, "/login");
  }

  const user = data.session.user;
  const admin = createAdminClient();

  // Check for an existing UserProfile row first so we can decide the correct
  // onboarding/home branch without relying on upsert return semantics alone.
  const { data: existing } = await admin
    .from("users")
    .select("il_index, plan")
    .eq("id", user.id)
    .maybeSingle();

  // Idempotent upsert (EC-001-C): never creates a duplicate row for an
  // existing user. plan defaults to FREE only for genuinely new rows —
  // upsert with onConflict preserves other columns for existing rows since
  // we only set fields that should be safe to (re)assert on every login.
  await admin.from("users").upsert(
    {
      id: user.id,
      plan: existing?.plan ?? "FREE",
      created_at: user.created_at ?? new Date().toISOString(),
    },
    { onConflict: "id" },
  );

  const ilIndexSet =
    existing?.il_index !== null && existing?.il_index !== undefined;

  return redirectTo(request, ilIndexSet ? "/" : "/onboarding");
}
