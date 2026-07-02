// @MX:ANCHOR: [AUTO] GET /auth/callback — OAuth/OTP session establishment + UserProfile upsert.
// @MX:REASON: [AUTO] Fan-in from all 3 web auth flows (Google OAuth, Apple OAuth, email OTP —
//   see login-actions.ts). Establishes the SSR cookie session via exchangeCodeForSession, then
//   ensures a UserProfile row exists (idempotent upsert — never duplicates an existing row,
//   EC-001-C) before branching to onboarding or learning home (REQ-WEB-001-E2).
//   Onboarding-complete is gated on `onboarding_completed_at` (an existing timestamptz
//   column already used as the canonical completion signal on mobile — see
//   apps/mobile/app/onboarding.tsx/_layout.tsx), NOT `il_index`: Task 3.1's band-seed
//   route writes an intermediate, un-cross-validated il_index before Task 3.2's
//   finalize-band runs, so a user who drops off mid-onboarding would otherwise be sent
//   straight to the learning home with a never-validated IL value. Task 3.3's
//   select-course route sets onboarding_completed_at as the true final onboarding step.
// @MX:SPEC: SPEC-WEB-001 - Phase 1 (REQ-WEB-001-E2), Phase 3 (onboarding-complete gate fix)
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
    .select("onboarding_completed_at, plan")
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

  // Onboarding-complete gate: onboarding_completed_at (set by Task 3.3's
  // select-course route, the final onboarding step), not il_index — see
  // @MX:REASON above for why il_index alone is not a safe signal.
  const onboardingComplete =
    existing?.onboarding_completed_at !== null &&
    existing?.onboarding_completed_at !== undefined;

  return redirectTo(request, onboardingComplete ? "/" : "/onboarding");
}
