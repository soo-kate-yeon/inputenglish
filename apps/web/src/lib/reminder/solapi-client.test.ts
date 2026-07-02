/**
 * TDD tests for Task 7.1 — Solapi client wrapper (SPEC-WEB-001 Phase 7)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Mirrors lib/billing/toss-client.test.ts's DI/mockability discipline:
 * - sendAlimtalk: POST to Solapi's message send endpoint
 * - SolapiConfigurationError thrown when SOLAPI_API_KEY/SOLAPI_API_SECRET unset
 * - Zero live network calls — injectable fetch only
 * - Never logs the API secret
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

describe("SolapiConfigurationError", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.SOLAPI_API_KEY;
    delete process.env.SOLAPI_API_SECRET;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("is thrown by sendAlimtalk when SOLAPI_API_KEY is unset", async () => {
    process.env.SOLAPI_API_SECRET = "secret";
    const { sendAlimtalk, SolapiConfigurationError } =
      await import("./solapi-client");
    const fakeFetch = makeFakeFetch({ ok: true, json: {} });

    await expect(
      sendAlimtalk(
        { to: "01000000000", message: "hello" },
        { fetch: fakeFetch },
      ),
    ).rejects.toBeInstanceOf(SolapiConfigurationError);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("is thrown by sendAlimtalk when SOLAPI_API_SECRET is unset", async () => {
    process.env.SOLAPI_API_KEY = "key";
    const { sendAlimtalk, SolapiConfigurationError } =
      await import("./solapi-client");
    const fakeFetch = makeFakeFetch({ ok: true, json: {} });

    await expect(
      sendAlimtalk(
        { to: "01000000000", message: "hello" },
        { fetch: fakeFetch },
      ),
    ).rejects.toBeInstanceOf(SolapiConfigurationError);
  });
});

describe("sendAlimtalk", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.SOLAPI_API_KEY = "test_solapi_key";
    process.env.SOLAPI_API_SECRET = "test_solapi_secret";
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("calls the Solapi send endpoint with the message payload", async () => {
    const { sendAlimtalk } = await import("./solapi-client");
    const fakeFetch = makeFakeFetch({
      ok: true,
      json: { groupId: "g1", messageId: "m1", statusCode: "2000" },
    });

    const result = await sendAlimtalk(
      { to: "01000000000", message: "오늘 BBC에서 이런 일이" },
      { fetch: fakeFetch },
    );

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = fakeFetch.mock.calls[0];
    expect(url).toContain("solapi.com");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toMatch(/^HMAC-SHA256 /);
    expect(JSON.parse(init.body).message).toMatchObject({
      to: "01000000000",
      text: "오늘 BBC에서 이런 일이",
    });
    expect(result).toEqual({
      groupId: "g1",
      messageId: "m1",
      statusCode: "2000",
    });
  });

  it("throws a descriptive error when Solapi responds with a non-ok status", async () => {
    const { sendAlimtalk } = await import("./solapi-client");
    const fakeFetch = makeFakeFetch({
      ok: false,
      status: 400,
      json: { errorCode: "InvalidPhoneNumber", errorMessage: "bad number" },
    });

    await expect(
      sendAlimtalk({ to: "bad", message: "hello" }, { fetch: fakeFetch }),
    ).rejects.toThrow(/bad number|InvalidPhoneNumber|400/);
  });

  it("never logs the API secret when send fails", async () => {
    const { sendAlimtalk } = await import("./solapi-client");
    const fakeFetch = makeFakeFetch({
      ok: false,
      status: 400,
      json: { errorCode: "Reject", errorMessage: "failed" },
    });
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      sendAlimtalk(
        { to: "01000000000", message: "hello" },
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
    expect(allLoggedText).not.toContain("test_solapi_secret");

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});
