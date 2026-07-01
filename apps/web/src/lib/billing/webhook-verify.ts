// @MX:ANCHOR: [AUTO] Toss webhook signature verification — MUST run before any parsing/mutation.
// @MX:REASON: [AUTO] Verification happens on the raw (pre-JSON.parse) request body using
//   HMAC-SHA256(TOSS_WEBHOOK_SECRET, rawBody) and a constant-time comparison, so timing
//   attacks cannot leak signature bytes. Any failure path (missing header, malformed
//   signature, mismatch) returns false rather than throwing, so the webhook route can
//   respond 401 with zero state change. Only a missing TOSS_WEBHOOK_SECRET env var throws
//   (misconfiguration, not an attacker-controlled input). (SPEC-WEB-001 Phase 2, Task 2.5)
// @MX:SPEC: SPEC-WEB-001 Phase 2 Task 2.5

import { createHmac, timingSafeEqual } from "node:crypto";

export class TossWebhookConfigurationError extends Error {
  constructor() {
    super("TOSS_WEBHOOK_SECRET is not configured");
    this.name = "TossWebhookConfigurationError";
  }
}

function getWebhookSecret(): string {
  const secret = process.env.TOSS_WEBHOOK_SECRET?.trim();
  if (!secret) throw new TossWebhookConfigurationError();
  return secret;
}

/**
 * Verifies a Toss webhook signature against the raw (unparsed) request body.
 * MUST be called before any JSON.parse or DB mutation.
 *
 * Returns `false` for any verification failure (missing/malformed/mismatched signature) —
 * never throws for attacker-controlled input. Throws only when TOSS_WEBHOOK_SECRET is unset.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
): boolean {
  const secret = getWebhookSecret();

  if (!signatureHeader) return false;

  const expectedSignature = createHmac("sha256", secret)
    .update(rawBody)
    .digest();

  let providedSignature: Buffer;
  try {
    providedSignature = Buffer.from(signatureHeader, "base64");
  } catch {
    return false;
  }

  // timingSafeEqual throws if buffer lengths differ, so guard first.
  if (providedSignature.length !== expectedSignature.length) return false;

  try {
    return timingSafeEqual(providedSignature, expectedSignature);
  } catch {
    return false;
  }
}
