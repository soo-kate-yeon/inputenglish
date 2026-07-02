// @MX:ANCHOR: [AUTO] Weekly prep send trigger — Task 6.3 dependency-injected notification.
// @MX:REASON: [AUTO] Mirrors lib/billing/renewal.ts's dependency-injection shape exactly:
//   this module is intentionally decoupled from any Cron/route wiring (Phase 8's job —
//   see JSDoc on sendPendingWeeklyPreps for the exact call signature Phase 8 must invoke)
//   and from the actual Solapi (카카오톡)/Resend (이메일) vendor adapter (Phase 7's job —
//   the injected `sendNotification` hook is a documented interface point only; this module
//   must NEVER perform real notification I/O itself). Each pending WeeklyPrep is processed
//   independently — a send failure for one does not prevent others from being attempted.
//   EC-006-B: a failed send sets send_status='failed' (never silently dropped), so a later
//   retry pass (Phase 7/8) can find and retry it via the same findPendingWeeklyPreps query.
// @MX:SPEC: SPEC-WEB-001 Phase 6 Task 6.3 (REQ-WEB-006-E2, AC-006-2, EC-006-B)
import { safeEscalate } from "@/lib/safe-escalate";

/** Minimal shape of a pending WeeklyPrep needed to attempt a send. */
export interface PendingWeeklyPrep {
  id: string;
  userId: string;
  expressions: string[];
}

/** Payload passed to the injected sendNotification hook. */
export interface WeeklyPrepNotification {
  userId: string;
  /** "이번 주 예습 나왔어요" + a snippet of key expressions (REQ-WEB-006-E2). */
  message: string;
}

export interface SendPendingWeeklyPrepsDeps {
  /**
   * Injectable query for WeeklyPrep rows pending send. Phase 7/8's Cron route
   * implementation MUST supply this as: weekly_prep WHERE send_status = 'pending'
   * (and, for retries, previously 'failed' rows past a backoff window).
   */
  findPendingWeeklyPreps: () => Promise<PendingWeeklyPrep[]>;
  /**
   * OPTIONAL documented hook for Phase 7 (Solapi 카카오톡 + Resend 이메일 adapter).
   * This function MUST NOT implement actual sending — it only forwards the
   * notification to a caller-supplied implementation. Absent by default (no-op
   * that always "succeeds"), so this module is testable without a real vendor.
   */
  sendNotification?: (notification: WeeklyPrepNotification) => Promise<void>;
  /** Injectable persistence call — updates weekly_prep.send_status. */
  updateSendStatus: (
    weeklyPrepId: string,
    status: "sent" | "failed",
  ) => Promise<void>;
}

export interface SendPendingWeeklyPrepsResult {
  succeeded: string[];
  failed: Array<{ weeklyPrepId: string; error: string }>;
}

const MAX_EXPRESSION_SNIPPET = 3;

function buildMessage(prep: PendingWeeklyPrep): string {
  const snippet = prep.expressions.slice(0, MAX_EXPRESSION_SNIPPET).join(", ");
  return snippet
    ? `이번 주 예습 나왔어요 — 핵심 표현: ${snippet}`
    : "이번 주 예습 나왔어요";
}

/**
 * Sends (or attempts to send) every pending WeeklyPrep via the injected
 * sendNotification hook, updating send_status to 'sent' or 'failed' per row.
 *
 * Call signature for Phase 8 (Cron wiring — NOT implemented in this phase):
 *   Phase 8's Sunday Cron route should call this function once per scheduled
 *   invocation with:
 *     - findPendingWeeklyPreps: a query against weekly_prep WHERE send_status='pending'
 *     - sendNotification: Phase 7's Solapi(카카오톡)->Resend(이메일 fallback) adapter
 *     - updateSendStatus: a service_role UPDATE setting weekly_prep.send_status
 *
 * Each pending WeeklyPrep is processed independently — a send failure for one
 * does not prevent others from being attempted (EC-006-B: failed rows are
 * marked 'failed', not silently dropped, so a later retry pass can find them
 * via the same findPendingWeeklyPreps query).
 */
export async function sendPendingWeeklyPreps(
  deps: SendPendingWeeklyPrepsDeps,
): Promise<SendPendingWeeklyPrepsResult> {
  const pending = await deps.findPendingWeeklyPreps();

  const succeeded: string[] = [];
  const failed: Array<{ weeklyPrepId: string; error: string }> = [];

  for (const prep of pending) {
    try {
      if (deps.sendNotification) {
        await deps.sendNotification({
          userId: prep.userId,
          message: buildMessage(prep),
        });
      }
      await deps.updateSendStatus(prep.id, "sent");
      succeeded.push(prep.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      failed.push({ weeklyPrepId: prep.id, error: message });
      // EC-006-B: record the failure so a retry pass can find it — never
      // silently swallow a failed send without persisting send_status='failed'.
      // This write is independently guarded via safeEscalate: if it also
      // fails, the row simply stays in its current status (still
      // discoverable/retriable later) — it must not throw out of the loop
      // and abort remaining WeeklyPreps.
      await safeEscalate(`weekly-prep-send:${prep.id}`, () =>
        deps.updateSendStatus(prep.id, "failed"),
      );
    }
  }

  return { succeeded, failed };
}
