// @MX:ANCHOR: [AUTO] Thin wrapper over the Toss Payments REST API for subscription billing.
// @MX:REASON: [AUTO] Every Toss HTTP call in this codebase MUST flow through this module so
//   that (a) TOSS_SECRET_KEY is read from env in exactly one place, (b) fetch is always
//   injectable (zero live network calls in tests — Task 2.2), and (c) billingKey/secret
//   values are never logged. Callers: /api/billing/confirm, /api/billing/issue,
//   /api/billing/webhook, lib/billing/renewal.ts. (SPEC-WEB-001 Phase 2, Task 2.2)
// @MX:SPEC: SPEC-WEB-001 Phase 2 Task 2.2

const TOSS_API_BASE_URL = "https://api.tosspayments.com/v1";

/** Mirrors RevenueCatConfigurationError's shape (see lib/premium/revenue-cat-entitlement.ts). */
export class TossConfigurationError extends Error {
  constructor() {
    super("TOSS_SECRET_KEY is not configured");
    this.name = "TossConfigurationError";
  }
}

/** Thrown when Toss responds with a non-ok HTTP status. Never includes billingKey/secret. */
export class TossApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "TossApiError";
    this.status = status;
    this.code = code;
  }
}

/**
 * Maps a caught error to an HTTP status + message for a Toss-calling route.
 * TossApiError (Toss rejected the request) -> 402; anything else -> 500.
 * Shared by /api/billing/confirm and /api/billing/issue.
 */
export function tossErrorToResponse(
  err: unknown,
  fallbackMessage: string,
): { status: 402 | 500; message: string } {
  const status = err instanceof TossApiError ? 402 : 500;
  const message = err instanceof Error ? err.message : fallbackMessage;
  return { status, message };
}

/** Injectable fetch type so tests never perform live network calls. */
type FetchLike = typeof fetch;

export interface TossClientOptions {
  /** Injectable fetch implementation. Defaults to global fetch when omitted. */
  fetch?: FetchLike;
}

function getTossSecretKey(): string {
  const key = process.env.TOSS_SECRET_KEY?.trim();
  if (!key) throw new TossConfigurationError();
  return key;
}

function buildAuthHeader(secretKey: string): string {
  return `Basic ${Buffer.from(`${secretKey}:`).toString("base64")}`;
}

async function tossPost<TResponse>(
  path: string,
  body: Record<string, unknown>,
  options?: TossClientOptions,
): Promise<TResponse> {
  const secretKey = getTossSecretKey();
  const doFetch = options?.fetch ?? fetch;

  const response = await doFetch(`${TOSS_API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(secretKey),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      code?: string;
      message?: string;
    };
    // NEVER include billingKey or secretKey in the thrown error message.
    throw new TossApiError(
      response.status,
      errorBody.code,
      errorBody.message ?? `Toss API request failed (${response.status})`,
    );
  }

  return (await response.json()) as TResponse;
}

// ── confirmPayment: POST /v1/payments/confirm ─────────────────────────────────

export interface ConfirmPaymentRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface ConfirmPaymentResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  [key: string]: unknown;
}

export async function confirmPayment(
  request: ConfirmPaymentRequest,
  options?: TossClientOptions,
): Promise<ConfirmPaymentResponse> {
  return tossPost<ConfirmPaymentResponse>(
    "/payments/confirm",
    { ...request },
    options,
  );
}

// ── issueBillingKey: POST /v1/billing/authorizations/issue ────────────────────

export interface IssueBillingKeyRequest {
  authKey: string;
  customerKey: string;
}

export interface IssueBillingKeyResponse {
  billingKey: string;
  customerKey: string;
  [key: string]: unknown;
}

export async function issueBillingKey(
  request: IssueBillingKeyRequest,
  options?: TossClientOptions,
): Promise<IssueBillingKeyResponse> {
  return tossPost<IssueBillingKeyResponse>(
    "/billing/authorizations/issue",
    { ...request },
    options,
  );
}

// ── chargeBillingKey: POST /v1/billing/{billingKey} ────────────────────────────

export interface ChargeBillingKeyRequest {
  billingKey: string;
  customerKey: string;
  amount: number;
  orderId: string;
  orderName: string;
}

export interface ChargeBillingKeyResponse {
  paymentKey: string;
  orderId: string;
  status: string;
  [key: string]: unknown;
}

export async function chargeBillingKey(
  request: ChargeBillingKeyRequest,
  options?: TossClientOptions,
): Promise<ChargeBillingKeyResponse> {
  const { billingKey, ...body } = request;
  return tossPost<ChargeBillingKeyResponse>(
    `/billing/${billingKey}`,
    body,
    options,
  );
}
