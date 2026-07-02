// @MX:ANCHOR: [AUTO] Unified send interface — Solapi 알림톡 primary, Resend email fallback.
// @MX:REASON: [AUTO] Single fallback-chain entry point for one recipient (AC-007-1). Both
//   vendor calls are injected function references (not the concrete client modules), so
//   this module performs zero live network I/O and stays trivially testable. Callers:
//   lib/reminder/reminder-batch.ts (Task 7.3 batch orchestration).
// @MX:SPEC: SPEC-WEB-001 Phase 7 Task 7.1 (REQ-WEB-007-E1, AC-007-1)
import type {
  SendAlimtalkRequest,
  SendAlimtalkResponse,
} from "./solapi-client";
import type {
  SendReminderEmailRequest,
  SendReminderEmailResponse,
} from "./resend-client";

export interface ReminderRecipient {
  userId: string;
  /** Phone number for Solapi alimtalk. Null/undefined skips straight to email. */
  phone?: string | null;
  email: string;
}

export interface SendReminderInput {
  recipient: ReminderRecipient;
  /** Reminder message body (Task 7.2's message-builder output). */
  message: string;
  /** Email subject line (used only for the Resend fallback path). */
  subject: string;
}

export interface SendReminderDeps {
  /** Injected Solapi alimtalk sender. Defaults to lib/reminder/solapi-client.sendAlimtalk shape. */
  sendAlimtalk: (request: SendAlimtalkRequest) => Promise<SendAlimtalkResponse>;
  /** Injected Resend email sender. Defaults to lib/reminder/resend-client.sendReminderEmail shape. */
  sendReminderEmail: (
    request: SendReminderEmailRequest,
  ) => Promise<SendReminderEmailResponse>;
}

export type SendReminderResult =
  | { channel: "alimtalk"; success: true }
  | { channel: "email"; success: true }
  | {
      channel: "none";
      success: false;
      alimtalkError?: string;
      emailError: string;
    };

function toErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Sends a single reminder to one recipient: Solapi 알림톡 first, falling back to
 * Resend email on failure (AC-007-1). If the recipient has no phone number, the
 * alimtalk attempt is skipped entirely and email is used directly.
 */
export async function sendReminder(
  input: SendReminderInput,
  deps: SendReminderDeps,
): Promise<SendReminderResult> {
  const { recipient, message, subject } = input;

  let alimtalkError: string | undefined;

  if (recipient.phone) {
    try {
      await deps.sendAlimtalk({ to: recipient.phone, message });
      return { channel: "alimtalk", success: true };
    } catch (err) {
      alimtalkError = toErrorMessage(err);
    }
  }

  try {
    await deps.sendReminderEmail({
      to: recipient.email,
      subject,
      message,
    });
    return { channel: "email", success: true };
  } catch (err) {
    return {
      channel: "none",
      success: false,
      ...(alimtalkError ? { alimtalkError } : {}),
      emailError: toErrorMessage(err),
    };
  }
}
