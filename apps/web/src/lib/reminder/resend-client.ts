// @MX:ANCHOR: [AUTO] Thin wrapper over the Resend REST API for reminder email fallback.
// @MX:REASON: [AUTO] Mirrors lib/billing/toss-client.ts's DI/mockability discipline exactly:
//   every Resend HTTP call in this codebase MUST flow through this module so that
//   (a) RESEND_API_KEY is read from env in exactly one place, (b) fetch is always
//   injectable (zero live network calls in tests — Task 7.1), and (c) the API key
//   is never logged. Callers: lib/reminder/reminder-send.ts.
// @MX:SPEC: SPEC-WEB-001 Phase 7 Task 7.1 (REQ-WEB-007-E1, AC-007-1)

const RESEND_API_BASE_URL = "https://api.resend.com";
const RESEND_SEND_PATH = "/emails";
const DEFAULT_FROM_ADDRESS = "인풋영어 <reminders@inputenglish.app>";

/** Mirrors TossConfigurationError's shape (see lib/billing/toss-client.ts). */
export class ResendConfigurationError extends Error {
  constructor() {
    super("RESEND_API_KEY is not configured");
    this.name = "ResendConfigurationError";
  }
}

/** Thrown when Resend responds with a non-ok HTTP status. Never includes the API key. */
export class ResendApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ResendApiError";
    this.status = status;
  }
}

/** Injectable fetch type so tests never perform live network calls. */
type FetchLike = typeof fetch;

export interface ResendClientOptions {
  /** Injectable fetch implementation. Defaults to global fetch when omitted. */
  fetch?: FetchLike;
  /** Override the "from" address (defaults to the reminders sender identity). */
  from?: string;
}

export interface SendReminderEmailRequest {
  to: string;
  subject: string;
  /** Plain-text or simple HTML message body (Task 7.2's message-builder output). */
  message: string;
}

export interface SendReminderEmailResponse {
  id?: string;
  [key: string]: unknown;
}

function getResendApiKey(): string {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) throw new ResendConfigurationError();
  return key;
}

export async function sendReminderEmail(
  request: SendReminderEmailRequest,
  options?: ResendClientOptions,
): Promise<SendReminderEmailResponse> {
  const apiKey = getResendApiKey();
  const doFetch = options?.fetch ?? fetch;

  const response = await doFetch(`${RESEND_API_BASE_URL}${RESEND_SEND_PATH}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      from: options?.from ?? DEFAULT_FROM_ADDRESS,
      to: [request.to],
      subject: request.subject,
      text: request.message,
    }),
  });

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    // NEVER include the API key in the thrown error message.
    throw new ResendApiError(
      response.status,
      errorBody.message ?? `Resend API request failed (${response.status})`,
    );
  }

  return (await response.json()) as SendReminderEmailResponse;
}
