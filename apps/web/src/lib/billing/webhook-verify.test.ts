/**
 * TDD tests for Task 2.5 — Toss webhook signature verification (SPEC-WEB-001 Phase 2)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Covers:
 * - verifyWebhookSignature: HMAC-SHA256(TOSS_WEBHOOK_SECRET, rawBody) compared against
 *   the signature header, using constant-time comparison.
 * - Verification MUST happen on the raw body BEFORE any JSON.parse/mutation.
 * - Returns false (never throws) for malformed/missing signature so callers can 401 cleanly.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { verifyWebhookSignature } from "./webhook-verify";

const ORIGINAL_ENV = { ...process.env };
const SECRET = "test-webhook-secret";

function sign(rawBody: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(rawBody).digest("base64");
}

describe("verifyWebhookSignature", () => {
  beforeEach(() => {
    process.env = { ...ORIGINAL_ENV };
    process.env.TOSS_WEBHOOK_SECRET = SECRET;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
  });

  it("returns true for a correctly signed raw body", () => {
    const rawBody = JSON.stringify({ eventType: "PAYMENT_STATUS_CHANGED" });
    const signature = sign(rawBody);

    expect(verifyWebhookSignature(rawBody, signature)).toBe(true);
  });

  it("returns false when the signature does not match the body", () => {
    const rawBody = JSON.stringify({ eventType: "PAYMENT_STATUS_CHANGED" });
    const wrongSignature = sign(JSON.stringify({ eventType: "OTHER" }));

    expect(verifyWebhookSignature(rawBody, wrongSignature)).toBe(false);
  });

  it("returns false when the signature was signed with a different secret", () => {
    const rawBody = JSON.stringify({ eventType: "PAYMENT_STATUS_CHANGED" });
    const signature = sign(rawBody, "wrong-secret");

    expect(verifyWebhookSignature(rawBody, signature)).toBe(false);
  });

  it("returns false for a missing/empty signature header", () => {
    const rawBody = JSON.stringify({ eventType: "PAYMENT_STATUS_CHANGED" });

    expect(verifyWebhookSignature(rawBody, null)).toBe(false);
    expect(verifyWebhookSignature(rawBody, "")).toBe(false);
    expect(verifyWebhookSignature(rawBody, undefined)).toBe(false);
  });

  it("returns false (never throws) for a malformed signature string", () => {
    const rawBody = JSON.stringify({ eventType: "PAYMENT_STATUS_CHANGED" });

    expect(() =>
      verifyWebhookSignature(rawBody, "not-valid-base64!!!"),
    ).not.toThrow();
    expect(verifyWebhookSignature(rawBody, "not-valid-base64!!!")).toBe(false);
  });

  it("throws a configuration error when TOSS_WEBHOOK_SECRET is unset", () => {
    delete process.env.TOSS_WEBHOOK_SECRET;
    const rawBody = JSON.stringify({ eventType: "PAYMENT_STATUS_CHANGED" });

    expect(() => verifyWebhookSignature(rawBody, "anything")).toThrow();
  });

  it("is sensitive to any byte-level change in the raw body (tamper detection)", () => {
    const rawBody = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      amount: 79000,
    });
    const signature = sign(rawBody);
    const tamperedBody = JSON.stringify({
      eventType: "PAYMENT_STATUS_CHANGED",
      amount: 1,
    });

    expect(verifyWebhookSignature(tamperedBody, signature)).toBe(false);
  });
});
