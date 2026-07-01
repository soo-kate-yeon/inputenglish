/**
 * TDD tests for Task 2.2 — Toss client wrapper (SPEC-WEB-001 Phase 2)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Covers:
 * - confirmPayment: POST /v1/payments/confirm
 * - issueBillingKey: POST /v1/billing/authorizations/issue
 * - chargeBillingKey: POST /v1/billing/{billingKey}
 * - Basic auth header built from base64(TOSS_SECRET_KEY:)
 * - TossConfigurationError thrown when TOSS_SECRET_KEY is unset
 * - Zero live network calls — injectable fetch only
 * - Never logs billingKey or secret key
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ORIGINAL_ENV = { ...process.env };

function makeFakeFetch(response: {
  ok: boolean;
  status?: number;
  json?: unknown;
  text?: string;
}) {
  return vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? (response.ok ? 200 : 400),
    json: () => Promise.resolve(response.json ?? {}),
    text: () => Promise.resolve(response.text ?? ""),
  });
}

describe("TossConfigurationError", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    delete process.env.TOSS_SECRET_KEY;
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("is thrown by confirmPayment when TOSS_SECRET_KEY is unset", async () => {
    const { confirmPayment, TossConfigurationError } =
      await import("./toss-client");
    const fakeFetch = makeFakeFetch({ ok: true, json: {} });

    await expect(
      confirmPayment(
        { paymentKey: "pk", orderId: "oid", amount: 1000 },
        { fetch: fakeFetch },
      ),
    ).rejects.toBeInstanceOf(TossConfigurationError);
    expect(fakeFetch).not.toHaveBeenCalled();
  });

  it("is thrown by issueBillingKey when TOSS_SECRET_KEY is unset", async () => {
    const { issueBillingKey, TossConfigurationError } =
      await import("./toss-client");
    const fakeFetch = makeFakeFetch({ ok: true, json: {} });

    await expect(
      issueBillingKey(
        { authKey: "ak", customerKey: "ck" },
        { fetch: fakeFetch },
      ),
    ).rejects.toBeInstanceOf(TossConfigurationError);
  });

  it("is thrown by chargeBillingKey when TOSS_SECRET_KEY is unset", async () => {
    const { chargeBillingKey, TossConfigurationError } =
      await import("./toss-client");
    const fakeFetch = makeFakeFetch({ ok: true, json: {} });

    await expect(
      chargeBillingKey(
        {
          billingKey: "bk",
          customerKey: "ck",
          amount: 1000,
          orderId: "oid",
          orderName: "annual plan",
        },
        { fetch: fakeFetch },
      ),
    ).rejects.toBeInstanceOf(TossConfigurationError);
  });
});

describe("confirmPayment", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.TOSS_SECRET_KEY = "test_sk_1234567890";
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("calls the Toss confirm endpoint with Basic auth and JSON body", async () => {
    const { confirmPayment } = await import("./toss-client");
    const fakeFetch = makeFakeFetch({
      ok: true,
      json: { paymentKey: "pk", orderId: "oid", status: "DONE" },
    });

    const result = await confirmPayment(
      { paymentKey: "pk", orderId: "oid", amount: 79000 },
      { fetch: fakeFetch },
    );

    expect(fakeFetch).toHaveBeenCalledTimes(1);
    const [url, init] = fakeFetch.mock.calls[0];
    expect(url).toBe("https://api.tosspayments.com/v1/payments/confirm");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toMatch(/^Basic /);
    expect(init.headers.Authorization).toBe(
      `Basic ${Buffer.from("test_sk_1234567890:").toString("base64")}`,
    );
    expect(JSON.parse(init.body)).toEqual({
      paymentKey: "pk",
      orderId: "oid",
      amount: 79000,
    });
    expect(result).toEqual({
      paymentKey: "pk",
      orderId: "oid",
      status: "DONE",
    });
  });

  it("throws a descriptive error when Toss responds with a non-ok status", async () => {
    const { confirmPayment } = await import("./toss-client");
    const fakeFetch = makeFakeFetch({
      ok: false,
      status: 400,
      json: { code: "REJECT_CARD_COMPANY", message: "Card declined" },
    });

    await expect(
      confirmPayment(
        { paymentKey: "pk", orderId: "oid", amount: 79000 },
        { fetch: fakeFetch },
      ),
    ).rejects.toThrow(/Card declined|REJECT_CARD_COMPANY|400/);
  });

  it("never logs the secret key or billingKey when confirm fails", async () => {
    const { confirmPayment } = await import("./toss-client");
    const fakeFetch = makeFakeFetch({
      ok: false,
      status: 400,
      json: { code: "REJECT", message: "failed" },
    });
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const warnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const logSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      confirmPayment(
        { paymentKey: "pk", orderId: "oid", amount: 79000 },
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
    expect(allLoggedText).not.toContain("test_sk_1234567890");

    consoleSpy.mockRestore();
    warnSpy.mockRestore();
    logSpy.mockRestore();
  });
});

describe("issueBillingKey", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.TOSS_SECRET_KEY = "test_sk_1234567890";
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("calls the billing-key issuance endpoint with authKey and customerKey", async () => {
    const { issueBillingKey } = await import("./toss-client");
    const fakeFetch = makeFakeFetch({
      ok: true,
      json: { billingKey: "billing-key-abc", customerKey: "ck" },
    });

    const result = await issueBillingKey(
      { authKey: "ak", customerKey: "ck" },
      { fetch: fakeFetch },
    );

    const [url, init] = fakeFetch.mock.calls[0];
    expect(url).toBe(
      "https://api.tosspayments.com/v1/billing/authorizations/issue",
    );
    expect(JSON.parse(init.body)).toEqual({
      authKey: "ak",
      customerKey: "ck",
    });
    expect(result).toEqual({
      billingKey: "billing-key-abc",
      customerKey: "ck",
    });
  });

  it("throws a descriptive error on non-ok response", async () => {
    const { issueBillingKey } = await import("./toss-client");
    const fakeFetch = makeFakeFetch({
      ok: false,
      status: 400,
      json: { code: "INVALID_AUTH_KEY", message: "bad auth key" },
    });

    await expect(
      issueBillingKey(
        { authKey: "ak", customerKey: "ck" },
        { fetch: fakeFetch },
      ),
    ).rejects.toThrow(/bad auth key|INVALID_AUTH_KEY|400/);
  });
});

describe("chargeBillingKey", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.TOSS_SECRET_KEY = "test_sk_1234567890";
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("calls POST /v1/billing/{billingKey} with the charge payload", async () => {
    const { chargeBillingKey } = await import("./toss-client");
    const fakeFetch = makeFakeFetch({
      ok: true,
      json: { paymentKey: "pk2", orderId: "renew-1", status: "DONE" },
    });

    const result = await chargeBillingKey(
      {
        billingKey: "billing-key-abc",
        customerKey: "ck",
        amount: 79000,
        orderId: "renew-1",
        orderName: "annual plan renewal",
      },
      { fetch: fakeFetch },
    );

    const [url, init] = fakeFetch.mock.calls[0];
    expect(url).toBe("https://api.tosspayments.com/v1/billing/billing-key-abc");
    expect(JSON.parse(init.body)).toEqual({
      customerKey: "ck",
      amount: 79000,
      orderId: "renew-1",
      orderName: "annual plan renewal",
    });
    expect(result).toEqual({
      paymentKey: "pk2",
      orderId: "renew-1",
      status: "DONE",
    });
  });

  it("never includes billingKey in an error message body when charge fails", async () => {
    const { chargeBillingKey } = await import("./toss-client");
    const fakeFetch = makeFakeFetch({
      ok: false,
      status: 400,
      json: { code: "EXCEED_MAX_DAILY_PAYMENT_COUNT", message: "too many" },
    });

    let caughtMessage = "";
    try {
      await chargeBillingKey(
        {
          billingKey: "billing-key-SECRET",
          customerKey: "ck",
          amount: 79000,
          orderId: "renew-1",
          orderName: "annual plan renewal",
        },
        { fetch: fakeFetch },
      );
    } catch (err) {
      caughtMessage = err instanceof Error ? err.message : String(err);
    }

    expect(caughtMessage).not.toContain("billing-key-SECRET");
  });
});
