import { beforeEach, describe, expect, it, vi } from "vitest";

// SPEC-WEB-001 Phase 1, Task 1.1 (REQ-WEB-001-E1, AC-001-1/3) — login CTA handlers.
// Tests the pure/async logic extracted from LoginActions.tsx (the "use client"
// component itself is a thin JSX wrapper with no independent logic to unit test,
// consistent with this app's existing convention of testing logic modules, not
// component rendering — see file-reading-optimization / no .test.tsx precedent).

const signInWithOAuth = vi.fn();
const signInWithOtp = vi.fn();

vi.mock("@/utils/supabase/client", () => ({
  createClient: () => ({
    auth: { signInWithOAuth, signInWithOtp },
  }),
}));

describe("login-actions", () => {
  beforeEach(() => {
    signInWithOAuth.mockReset();
    signInWithOtp.mockReset();
  });

  describe("startGoogleLogin", () => {
    it("initiates Google OAuth (PKCE) with the auth callback redirect", async () => {
      signInWithOAuth.mockResolvedValue({ data: {}, error: null });

      const { startGoogleLogin } = await import("./login-actions");
      await startGoogleLogin();

      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "google",
        options: {
          redirectTo: expect.stringContaining("/auth/callback"),
        },
      });
    });

    it("throws when Supabase returns an OAuth error", async () => {
      signInWithOAuth.mockResolvedValue({
        data: null,
        error: new Error("oauth failed"),
      });

      const { startGoogleLogin } = await import("./login-actions");
      await expect(startGoogleLogin()).rejects.toThrow("oauth failed");
    });
  });

  describe("startAppleLogin", () => {
    it("initiates Apple OAuth (PKCE) with the auth callback redirect", async () => {
      signInWithOAuth.mockResolvedValue({ data: {}, error: null });

      const { startAppleLogin } = await import("./login-actions");
      await startAppleLogin();

      expect(signInWithOAuth).toHaveBeenCalledWith({
        provider: "apple",
        options: {
          redirectTo: expect.stringContaining("/auth/callback"),
        },
      });
    });
  });

  describe("startEmailOtpLogin", () => {
    it("sends an email magic link / OTP to the given address", async () => {
      signInWithOtp.mockResolvedValue({ data: {}, error: null });

      const { startEmailOtpLogin } = await import("./login-actions");
      await startEmailOtpLogin("user@example.com");

      expect(signInWithOtp).toHaveBeenCalledWith({
        email: "user@example.com",
        options: {
          emailRedirectTo: expect.stringContaining("/auth/callback"),
        },
      });
    });

    it("rejects an empty email without calling Supabase", async () => {
      const { startEmailOtpLogin } = await import("./login-actions");

      await expect(startEmailOtpLogin("")).rejects.toThrow("Email is required");
      expect(signInWithOtp).not.toHaveBeenCalled();
    });

    it("throws when Supabase returns an OTP error", async () => {
      signInWithOtp.mockResolvedValue({
        data: null,
        error: new Error("otp failed"),
      });

      const { startEmailOtpLogin } = await import("./login-actions");
      await expect(startEmailOtpLogin("user@example.com")).rejects.toThrow(
        "otp failed",
      );
    });
  });
});
