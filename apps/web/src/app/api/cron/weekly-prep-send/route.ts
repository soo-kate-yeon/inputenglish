/**
 * @MX:ANCHOR: [AUTO] Cron GET /api/cron/weekly-prep-send — external trigger boundary.
 * @MX:REASON: Auth contract mirrors /api/cron/reading-batch exactly: CRON_SECRET MUST be
 * set and matched; fail-closed if unset. No unauthenticated path reaches the send
 * executor.
 * Fan-in: Render Cron scheduler (Sunday) + manual curl/agent triggers.
 * @MX:SPEC: SPEC-WEB-001 Phase 8 Task 8.1 (REQ-WEB-006-E2)
 *
 * @MX:NOTE: [AUTO] CRON_SECRET fail-closed: if CRON_SECRET env is unset, ALL
 * requests are rejected (401). Never open to anonymous callers.
 *
 * @MX:NOTE: [AUTO] Deps wiring: findPendingWeeklyPreps queries weekly_prep WHERE
 * send_status='pending', joined with users(email) for delivery (per
 * weekly-prep-send.ts's documented Phase 7/8 call signature). sendNotification
 * delivers via the reminder infra's email fallback (Resend) — this Cron has no
 * phone number source (no `phone` column exists yet in public.users), so
 * delivery is email-only for weekly prep notifications; the alimtalk channel
 * remains reserved for the daily-reminder Cron once a phone column is added.
 * updateSendStatus performs the service_role UPDATE on weekly_prep.send_status.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import {
  sendPendingWeeklyPreps,
  type SendPendingWeeklyPrepsDeps,
  type PendingWeeklyPrep,
} from "@/lib/premium/weekly-prep-send";
import { sendReminderEmail } from "@/lib/reminder/resend-client";
import { isCronAuthorized } from "@/lib/cron-auth";

// ── Auth ──────────────────────────────────────────────────────────────────────
// Auth check extracted to lib/cron-auth.ts (SPEC-WEB-001 Phase 8) — was
// duplicated verbatim across all /api/cron/* routes; see isCronAuthorized().

const WEEKLY_PREP_SEND_SUBJECT = "이번 주 예습이 도착했어요";

// ── Deps factory ──────────────────────────────────────────────────────────────

/**
 * Build the real SendPendingWeeklyPrepsDeps from createAdminClient().
 *
 * findPendingWeeklyPreps: weekly_prep WHERE send_status='pending', joined with
 *   users(email) so sendNotification has a delivery target.
 * sendNotification: Resend email delivery (no phone column exists yet, so
 *   alimtalk is intentionally not attempted here).
 * updateSendStatus: service_role UPDATE on weekly_prep.send_status.
 */
function buildWeeklyPrepSendDeps(): SendPendingWeeklyPrepsDeps {
  const supabase = createAdminClient();

  // Map of userId -> email, populated by findPendingWeeklyPreps and consulted
  // by sendNotification (both are called within the same request lifecycle).
  const emailByUserId = new Map<string, string>();

  const findPendingWeeklyPreps: SendPendingWeeklyPrepsDeps["findPendingWeeklyPreps"] =
    async () => {
      const { data, error } = await supabase
        .from("weekly_prep")
        .select("id, user_id, expressions, users(email)")
        .eq("send_status", "pending");

      if (error || !data) {
        console.error(
          "[CronWeeklyPrepSend] findPendingWeeklyPreps query error:",
          error,
        );
        return [];
      }

      const rows = data as Array<{
        id: string;
        user_id: string;
        expressions: string[] | null;
        users: { email: string } | { email: string }[] | null;
      }>;

      const preps: PendingWeeklyPrep[] = [];
      for (const row of rows) {
        const joinedUser = Array.isArray(row.users) ? row.users[0] : row.users;
        if (joinedUser?.email) {
          emailByUserId.set(row.user_id, joinedUser.email);
        }
        preps.push({
          id: row.id,
          userId: row.user_id,
          expressions: row.expressions ?? [],
        });
      }
      return preps;
    };

  const sendNotification: SendPendingWeeklyPrepsDeps["sendNotification"] =
    async (notification) => {
      const email = emailByUserId.get(notification.userId);
      if (!email) {
        throw new Error(
          `[CronWeeklyPrepSend] no email on file for user ${notification.userId}`,
        );
      }
      await sendReminderEmail({
        to: email,
        subject: WEEKLY_PREP_SEND_SUBJECT,
        message: notification.message,
      });
    };

  const updateSendStatus: SendPendingWeeklyPrepsDeps["updateSendStatus"] =
    async (weeklyPrepId, status) => {
      const { error } = await supabase
        .from("weekly_prep")
        .update({ send_status: status })
        .eq("id", weeklyPrepId);

      if (error) {
        console.error(
          `[CronWeeklyPrepSend] updateSendStatus failed for ${weeklyPrepId}:`,
          error,
        );
      }
    };

  return { findPendingWeeklyPreps, sendNotification, updateSendStatus };
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/cron/weekly-prep-send
 *
 * Invoked by Render Cron (schedule: Sunday). Can also be triggered manually by
 * ops/agents with CRON_SECRET.
 *
 * Flow:
 *   1. Auth check (CRON_SECRET) -> 401 if invalid
 *   2. Build SendPendingWeeklyPrepsDeps from Supabase admin client + Resend client
 *   3. sendPendingWeeklyPreps(deps) -> SendPendingWeeklyPrepsResult
 *   4. Return result summary JSON
 */
export async function GET(request: NextRequest) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const deps = buildWeeklyPrepSendDeps();
  const result = await sendPendingWeeklyPreps(deps);

  return NextResponse.json(result);
}
