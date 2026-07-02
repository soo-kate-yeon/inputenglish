// @MX:ANCHOR: [AUTO] Thin wrapper over the Solapi REST API for 알림톡 (Alimtalk) sending.
// @MX:REASON: [AUTO] Mirrors lib/billing/toss-client.ts's DI/mockability discipline exactly:
//   every Solapi HTTP call in this codebase MUST flow through this module so that
//   (a) SOLAPI_API_KEY/SOLAPI_API_SECRET are read from env in exactly one place,
//   (b) fetch is always injectable (zero live network calls in tests — Task 7.1),
//   and (c) the API secret is never logged. Callers: lib/reminder/reminder-send.ts.
// @MX:SPEC: SPEC-WEB-001 Phase 7 Task 7.1 (REQ-WEB-007-E1, AC-007-1)
import { createHmac, randomBytes } from "node:crypto";

const SOLAPI_API_BASE_URL = "https://api.solapi.com";
const SOLAPI_SEND_PATH = "/messages/v4/send";

/** Mirrors TossConfigurationError's shape (see lib/billing/toss-client.ts). */
export class SolapiConfigurationError extends Error {
  constructor() {
    super("SOLAPI_API_KEY or SOLAPI_API_SECRET is not configured");
    this.name = "SolapiConfigurationError";
  }
}

/** Thrown when Solapi responds with a non-ok HTTP status. Never includes the API secret. */
export class SolapiApiError extends Error {
  readonly status: number;
  readonly code?: string;

  constructor(status: number, code: string | undefined, message: string) {
    super(message);
    this.name = "SolapiApiError";
    this.status = status;
    this.code = code;
  }
}

/** Injectable fetch type so tests never perform live network calls. */
type FetchLike = typeof fetch;

export interface SolapiClientOptions {
  /** Injectable fetch implementation. Defaults to global fetch when omitted. */
  fetch?: FetchLike;
}

function getSolapiCredentials(): { apiKey: string; apiSecret: string } {
  const apiKey = process.env.SOLAPI_API_KEY?.trim();
  const apiSecret = process.env.SOLAPI_API_SECRET?.trim();
  if (!apiKey || !apiSecret) throw new SolapiConfigurationError();
  return { apiKey, apiSecret };
}

/**
 * Builds Solapi's HMAC-SHA256 signature auth header.
 * Reference: https://developers.solapi.com/references/authentication/api-key
 */
function buildAuthHeader(apiKey: string, apiSecret: string): string {
  const date = new Date().toISOString();
  const salt = randomBytes(16).toString("hex");
  const signature = createHmac("sha256", apiSecret)
    .update(date + salt)
    .digest("hex");
  return `HMAC-SHA256 apiKey=${apiKey}, date=${date}, salt=${salt}, signature=${signature}`;
}

export interface SendAlimtalkRequest {
  /** Recipient phone number (E.164 or domestic format per Solapi contract). */
  to: string;
  /** Message body text (Task 7.2's message-builder output). */
  message: string;
}

export interface SendAlimtalkResponse {
  groupId?: string;
  messageId?: string;
  statusCode?: string;
  [key: string]: unknown;
}

export async function sendAlimtalk(
  request: SendAlimtalkRequest,
  options?: SolapiClientOptions,
): Promise<SendAlimtalkResponse> {
  const { apiKey, apiSecret } = getSolapiCredentials();
  const doFetch = options?.fetch ?? fetch;

  const response = await doFetch(`${SOLAPI_API_BASE_URL}${SOLAPI_SEND_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: buildAuthHeader(apiKey, apiSecret),
    },
    body: JSON.stringify({
      message: {
        to: request.to,
        text: request.message,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      errorCode?: string;
      errorMessage?: string;
    };
    // NEVER include the API secret in the thrown error message.
    throw new SolapiApiError(
      response.status,
      errorBody.errorCode,
      errorBody.errorMessage ??
        `Solapi API request failed (${response.status})`,
    );
  }

  return (await response.json()) as SendAlimtalkResponse;
}
