/**
 * @MX:ANCHOR: [AUTO] Cron GET /api/cron/daily-reminder — external trigger boundary.
 * @MX:REASON: Auth contract mirrors /api/cron/reading-batch exactly: CRON_SECRET MUST be
 * set and matched; fail-closed if unset. No unauthenticated path reaches the reminder
 * executor, which sends real Solapi/Resend messages.
 * Fan-in: Render Cron scheduler (daily) + manual curl/agent triggers.
 * @MX:SPEC: SPEC-WEB-001 Phase 8 Task 8.1 (REQ-WEB-007)
 *
 * @MX:NOTE: [AUTO] CRON_SECRET fail-closed: if CRON_SECRET env is unset, ALL
 * requests are rejected (401). Never open to anonymous callers.
 *
 * @MX:NOTE: [AUTO] Eligibility simplification (implementation_divergence — see
 * Phase 8 completion report): precise per-user local-time-of-day scheduling is
 * out of scope (REQ-WEB-007's exact trigger window is a v-next refinement).
 * This Cron treats "eligible" as: reminder_opt_out=false AND the user has an
 * active subscription (joined via subscriptions.status='active'). It runs once
 * per day at a single fixed UTC hour (render.yaml schedule) rather than per-user
 * local time. No `phone` column exists yet in public.users, so every recipient's
 * `phone` is null — sendReminder (lib/reminder/reminder-send.ts) already handles
 * a null phone by skipping straight to the Resend email channel, so this is a
 * safe degradation, not a broken alimtalk attempt.
 *
 * @MX:NOTE: [AUTO] buildMessageForRecipient uses a fixed, non-personalized
 * teaser/expression/sentence via message-builder.ts. sendDailyReminders' deps
 * contract (lib/reminder/reminder-batch.ts) only passes the recipient (userId/
 * phone/email/reminderOptOut) into buildMessageForRecipient — no per-user
 * content (today's expression/sentence) is threaded through that interface.
 * Wiring genuinely personalized content per recipient is a follow-up (would
 * require extending ReminderEligibleRecipient or buildMessageForRecipient's
 * signature in reminder-batch.ts, which is out of this phase's scope per the
 * INVIOLABLE KEEP constraint on that already-tested module).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import {
  sendDailyReminders,
  type SendDailyRemindersDeps,
  type ReminderEligibleRecipient,
} from "@/lib/reminder/reminder-batch";
import { buildReminderMessage } from "@/lib/reminder/message-builder";
import { sendAlimtalk } from "@/lib/reminder/solapi-client";
import { sendReminderEmail } from "@/lib/reminder/resend-client";
import { isCronAuthorized } from "@/lib/cron-auth";

// ── Auth ──────────────────────────────────────────────────────────────────────
// Auth check extracted to lib/cron-auth.ts (SPEC-WEB-001 Phase 8) — was
// duplicated verbatim across all /api/cron/* routes; see isCronAuthorized().

const REMINDER_SUBJECT = "오늘의 표현이 도착했어요";

/**
 * Fixed, non-personalized message content (see @MX:NOTE above for why this
 * cannot yet be personalized within the current deps contract).
 */
function buildGenericReminderMessage(): string {
  return buildReminderMessage({
    topicTeaser: "오늘도 인풋영어에서 새로운 이야기가 기다리고 있어요",
    expression: "check it out",
    sourceSentence: "Let's check it out together today.",
    sourceLabel: "인풋영어",
  });
}

// ── Deps factory ──────────────────────────────────────────────────────────────

/**
 * Build the real SendDailyRemindersDeps from createAdminClient().
 *
 * findEligibleRecipients: users WHERE reminder_opt_out=false, joined with an
 *   active subscription (per the eligibility simplification documented above).
 * buildMessageForRecipient: pure, non-personalized message via message-builder.ts.
 * sendAlimtalk / sendReminderEmail: real vendor clients (Solapi / Resend).
 * onDualFailure: structured console.error escalation (no Sentry — Task 8.3).
 */
function buildDailyReminderDeps(): SendDailyRemindersDeps {
  const supabase = createAdminClient();

  const findEligibleRecipients: SendDailyRemindersDeps["findEligibleRecipients"] =
    async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, email, reminder_opt_out, subscriptions!inner(status)")
        .eq("subscriptions.status", "active")
        .eq("reminder_opt_out", false);

      if (error || !data) {
        console.error(
          "[CronDailyReminder] findEligibleRecipients query error:",
          error,
        );
        return [];
      }

      const rows = data as Array<{
        id: string;
        email: string;
        reminder_opt_out: boolean;
      }>;

      return rows.map(
        (row): ReminderEligibleRecipient => ({
          userId: row.id,
          // No `phone` column exists yet — always null (safe degradation to
          // the Resend-only path in sendReminder).
          phone: null,
          email: row.email,
          reminderOptOut: row.reminder_opt_out,
        }),
      );
    };

  const buildMessageForRecipient: SendDailyRemindersDeps["buildMessageForRecipient"] =
    () => ({
      message: buildGenericReminderMessage(),
      subject: REMINDER_SUBJECT,
    });

  const onDualFailure: SendDailyRemindersDeps["onDualFailure"] = async (
    escalation,
  ) => {
    console.error(
      "[CronDailyReminder] dual-failure escalation (alimtalk+email both failed)",
      escalation,
    );
  };

  return {
    findEligibleRecipients,
    buildMessageForRecipient,
    sendAlimtalk,
    sendReminderEmail,
    onDualFailure,
  };
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/cron/daily-reminder
 *
 * Invoked by Render Cron (schedule: daily). Can also be triggered manually by
 * ops/agents with CRON_SECRET.
 *
 * Flow:
 *   1. Auth check (CRON_SECRET) -> 401 if invalid
 *   2. Build SendDailyRemindersDeps from Supabase admin client + vendor clients
 *   3. sendDailyReminders(deps) -> SendDailyRemindersResult
 *   4. Return result summary JSON
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deps = buildDailyReminderDeps();
  const result = await sendDailyReminders(deps);

  return NextResponse.json(result);
}
