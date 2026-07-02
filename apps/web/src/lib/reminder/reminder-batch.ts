// @MX:ANCHOR: [AUTO] Daily reminder batch orchestration — opt-out skip + dual-failure escalation.
// @MX:REASON: [AUTO] Mirrors lib/premium/weekly-prep-send.ts's dependency-injection shape
//   exactly: intentionally decoupled from any Cron/route wiring (Phase 8's job) and from
//   real querying (findEligibleRecipients is an injected hook only). Each recipient is
//   processed independently via lib/reminder/reminder-send.ts's Solapi-then-Resend fallback
//   chain — a dual failure for one recipient never blocks the others (same pattern as
//   weekly-prep-send.ts's per-row try/catch). EC-007-A: recipients with reminder_opt_out=true
//   are filtered out before any vendor call is attempted. EC-007-B: on dual failure, exactly
//   one onDualFailure escalation call is made per recipient per invocation — there is no
//   retry loop inside this function (a later Cron tick, not this call, is the only way a
//   recipient is reprocessed).
// @MX:SPEC: SPEC-WEB-001 Phase 7 Task 7.3 (REQ-WEB-007-W1, REQ-WEB-007-U3, EC-007-A, EC-007-B)
import { sendReminder } from "./reminder-send";
import type {
  SendAlimtalkRequest,
  SendAlimtalkResponse,
} from "./solapi-client";
import type {
  SendReminderEmailRequest,
  SendReminderEmailResponse,
} from "./resend-client";
import { safeEscalate } from "@/lib/safe-escalate";

/** Minimal shape of a reminder-eligible recipient row. */
export interface ReminderEligibleRecipient {
  userId: string;
  phone?: string | null;
  email: string;
  reminderOptOut: boolean;
}

/** Message content for one recipient, produced by Task 7.2's buildReminderMessage. */
export interface ReminderMessageForRecipient {
  message: string;
  subject: string;
}

/** Payload passed to the injected onDualFailure escalation hook. */
export interface DualFailureEscalation {
  userId: string;
  alimtalkError?: string;
  emailError: string;
}

export interface SendDailyRemindersDeps {
  /**
   * Injectable query for reminder-eligible recipients. Phase 8's Cron route
   * implementation MUST supply this (e.g. active-subscription users whose
   * local reminder time has arrived).
   */
  findEligibleRecipients: () => Promise<ReminderEligibleRecipient[]>;
  /** Builds the per-recipient message body/subject (Task 7.2). */
  buildMessageForRecipient: (
    recipient: ReminderEligibleRecipient,
  ) => ReminderMessageForRecipient;
  /** Injected Solapi alimtalk sender (lib/reminder/solapi-client.sendAlimtalk shape). */
  sendAlimtalk: (request: SendAlimtalkRequest) => Promise<SendAlimtalkResponse>;
  /** Injected Resend email sender (lib/reminder/resend-client.sendReminderEmail shape). */
  sendReminderEmail: (
    request: SendReminderEmailRequest,
  ) => Promise<SendReminderEmailResponse>;
  /**
   * OPTIONAL structured escalation hook, called exactly once per recipient
   * whose alimtalk AND email attempts both fail (EC-007-B). No default
   * ops-alerting integration is implemented here — this is a documented,
   * testable signal point only. Absent by default (no-op).
   */
  onDualFailure?: (escalation: DualFailureEscalation) => Promise<void>;
}

export interface SendDailyRemindersResult {
  sent: string[];
  skippedOptOut: string[];
  escalated: string[];
}

/**
 * Sends the daily reminder to every eligible recipient, skipping opted-out
 * users (EC-007-A) and escalating — exactly once, without unbounded retry —
 * any recipient for whom both Solapi alimtalk and Resend email fail
 * (EC-007-B). Each recipient is processed independently; one recipient's
 * failure never prevents others from being attempted (mirrors
 * weekly-prep-send.ts's per-row isolation).
 */
export async function sendDailyReminders(
  deps: SendDailyRemindersDeps,
): Promise<SendDailyRemindersResult> {
  const recipients = await deps.findEligibleRecipients();

  const sent: string[] = [];
  const skippedOptOut: string[] = [];
  const escalated: string[] = [];

  for (const recipient of recipients) {
    if (recipient.reminderOptOut) {
      skippedOptOut.push(recipient.userId);
      continue;
    }

    const { message, subject } = deps.buildMessageForRecipient(recipient);

    const result = await sendReminder(
      { recipient, message, subject },
      {
        sendAlimtalk: deps.sendAlimtalk,
        sendReminderEmail: deps.sendReminderEmail,
      },
    );

    if (result.success) {
      sent.push(recipient.userId);
      continue;
    }

    // Dual failure: escalate exactly once (no retry loop within this invocation).
    escalated.push(recipient.userId);
    if (deps.onDualFailure) {
      // Escalation itself failing must not abort remaining recipients.
      await safeEscalate(`reminder-batch:${recipient.userId}`, () =>
        deps.onDualFailure!({
          userId: recipient.userId,
          ...(result.alimtalkError
            ? { alimtalkError: result.alimtalkError }
            : {}),
          emailError: result.emailError,
        }),
      );
    }
  }

  return { sent, skippedOptOut, escalated };
}
