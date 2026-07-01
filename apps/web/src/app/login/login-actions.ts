import { createClient } from "@/utils/supabase/client";

// SPEC-WEB-001 Phase 1, Task 1.1 (REQ-WEB-001-E1) — login CTA handlers.
// Mirrors the mobile AuthContext provider shape (Google/Apple OAuth PKCE +
// email OTP/magic link), adapted for Next.js SSR: redirect-based OAuth instead
// of expo-auth-session deep links.

function getAuthCallbackUrl(): string {
  const origin =
    typeof window !== "undefined"
      ? window.location.origin
      : (process.env.NEXT_PUBLIC_SITE_URL ?? "");
  return `${origin}/auth/callback`;
}

export async function startGoogleLogin(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: getAuthCallbackUrl(),
    },
  });

  if (error) {
    throw error;
  }
}

export async function startAppleLogin(): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOAuth({
    provider: "apple",
    options: {
      redirectTo: getAuthCallbackUrl(),
    },
  });

  if (error) {
    throw error;
  }
}

export async function startEmailOtpLogin(email: string): Promise<void> {
  if (!email || !email.trim()) {
    throw new Error("Email is required");
  }

  const supabase = createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: getAuthCallbackUrl(),
    },
  });

  if (error) {
    throw error;
  }
}
