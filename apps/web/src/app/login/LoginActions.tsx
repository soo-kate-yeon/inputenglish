"use client";

import { useState } from "react";
import { Button } from "@framingui/ui";
import {
  startAppleLogin,
  startEmailOtpLogin,
  startGoogleLogin,
} from "./login-actions";

// SPEC-WEB-001 Phase 1, Task 1.1 (REQ-WEB-001-E1, AC-001-1/3) — wires the 3
// previously-handler-less CTAs in login/page.tsx to real Supabase auth flows.
export function LoginActions() {
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">(
    "idle",
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function runAuthAction(
    action: () => Promise<void>,
    onSuccessStatus: "idle" | "sent" = "idle",
  ) {
    setStatus("loading");
    setErrorMessage(null);
    try {
      await action();
      setStatus(onSuccessStatus);
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Login failed");
    }
  }

  const handleGoogle = () => runAuthAction(startGoogleLogin);
  const handleApple = () => runAuthAction(startAppleLogin);

  function handleEmailSubmit(event: React.FormEvent) {
    event.preventDefault();
    return runAuthAction(() => startEmailOtpLogin(email), "sent");
  }

  if (showEmailForm) {
    return (
      <form onSubmit={handleEmailSubmit} className="flex w-full flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full rounded-md border border-white/30 bg-white/10 px-4 py-3 text-white placeholder:text-white/50 backdrop-blur-sm"
        />
        <Button
          type="submit"
          variant="default"
          size="lg"
          className="w-full bg-white text-black hover:bg-white/90"
          disabled={status === "loading"}
        >
          {status === "sent" ? "메일을 확인해주세요" : "매직링크 받기"}
        </Button>
        {errorMessage ? (
          <p className="text-center text-sm text-red-300">{errorMessage}</p>
        ) : null}
      </form>
    );
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <Button
        variant="outline"
        size="lg"
        className="w-full border-white/30 bg-white/10 text-white backdrop-blur-sm hover:bg-white/20"
        onClick={handleGoogle}
        disabled={status === "loading"}
      >
        Google로 계속하기
      </Button>
      <Button
        variant="default"
        size="lg"
        className="w-full bg-white text-black hover:bg-white/90"
        onClick={handleApple}
        disabled={status === "loading"}
      >
        Apple로 계속하기
      </Button>
      <Button
        variant="secondary"
        size="lg"
        className="w-full bg-transparent text-white/70 underline-offset-4 hover:text-white hover:underline"
        onClick={() => setShowEmailForm(true)}
      >
        이메일로 시작하기
      </Button>
      {errorMessage ? (
        <p className="text-center text-sm text-red-300">{errorMessage}</p>
      ) : null}
    </div>
  );
}
