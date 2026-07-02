/**
 * TDD tests for Task 7.1 — Resend client wrapper (SPEC-WEB-001 Phase 7)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Mirrors lib/billing/toss-client.test.ts's DI/mockability discipline:
 * - sendReminderEmail: POST to Resend's email send endpoint
 * - ResendConfigurationError thrown when RESEND_API_KEY unset
 * - Zero live network calls — injectable fetch only
 * - Never logs the API key
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function makeFakeFetch(response: {
  ok: boolean;
  status?: number;
  json?: unknown;
}) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: () => Promise.resolve(response.json ?? {}),
  });
}

describe("ResendConfigurationError", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.RESEND_API_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("is thrown by sendReminderEmail when RESEND_API_KEY is unset", async () => {
    const { sendReminderEmail, ResendConfigurationError } =
      await import("./resend-client");
    const fakeFetch = makeFakeFetch({ ok: true, json: {} });

    await expect(
      sendReminderEmail(
        { to: "user@example.com", subject: "오늘의 표현", message: "hello" },
        { fetch: fakeFetch },
      ),
    ).rejects.toBeInstanceOf(ResendConfigurationError);
    expect(fakeFetch).not.toHaveBeenCalled();
  });
});

describe("sendReminderEmail", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.RESEND_API_KEY = "test_resend_key";
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("calls the Resend send endpoint with Bearer auth and JSON body", async () => {
    const { sendReminderEmail } = await import("./resend-client");
    const fakeFetch = makeFakeFetch({
      ok: true,
      json: { id: "email-1" },
    });

    const result = await sendReminderEmail(
      {
        to: "user@example.com",
        subject: "오늘 BBC에서 이런 일이",
        message: "본문 내용",
      },
      { fetch: fakeFetch },
    );

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = fakeFetch.mock.calls[0];
    expect(url).toContain("resend.com");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer test_resend_key");
    const body = JSON.parse(init.body);
    expect(body.to).toEqual(["user@example.com"]);
    expect(body.subject).toBe("오늘 BBC에서 이런 일이");
    expect(result).toEqual({ id: "email-1" });
  });

  it("throws a descriptive error when Resend responds with a non-ok status", async () => {
    const { sendReminderEmail } = await import("./resend-client");
    const fakeFetch = makeFakeFetch({
      ok: false,
      status: 422,
      json: { message: "invalid recipient" },
    });

    await expect(
      sendReminderEmail(
        { to: "bad", subject: "s", message: "m" },
        { fetch: fakeFetch },
      ),
    ).rejects.toThrow(/invalid recipient|422/);
  });

  it("never logs the API key when send fails", async () => {
    const { sendReminderEmail } = await import("./resend-client");
    const fakeFetch = makeFakeFetch({
      ok: false,
      status: 400,
      json: { message: "failed" },
    });
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      sendReminderEmail(
        { to: "user@example.com", subject: "s", message: "m" },
        { fetch: fakeFetch },
      ),
    ).rejects.toThrow();

    const allLoggedText = [
      ...consoleSpy.mock.calls,
      ...warnSpy.mock.calls,
      ...logSpy.mock.calls,
    ]
      .flat()
      .map((v) => JSON.stringify(v))
      .join(" ");
    expect(allLoggedText).not.toContain("test_resend_key");

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});
