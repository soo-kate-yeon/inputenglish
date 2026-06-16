/**
 * @MX:ANCHOR: [AUTO] Cron GET /api/cron/reading-batch — external trigger boundary.
 * @MX:REASON: Auth contract: CRON_SECRET MUST be set and matched; fail-closed if unset.
 * Vercel Cron sends Authorization: Bearer <CRON_SECRET>. Manual/agent triggers may
 * use x-cron-secret header. No unauthenticated path reaches the batch executor.
 * Fan-in: Vercel Cron scheduler + manual curl/agent triggers.
 * @MX:SPEC: SPEC-INPUT-002 - Phase 4, Task 4.1 (REQ-AUTO-004)
 *
 * @MX:NOTE: [AUTO] CRON_SECRET fail-closed: if CRON_SECRET env is unset, ALL
 * requests are rejected (401). Never open to anonymous callers.
 *
 * @MX:NOTE: [AUTO] Idempotency intent: Before running the batch, the handler
 * checks reading_pieces for pool rows created today (user_id IS NULL). If any
 * exist, the request returns { skipped: true, reason: "already ran today" }
 * WITHOUT invoking runDailyReadingBatch. Whole-batch idempotency guards against
 * duplicate Cron triggers (EC-004-A / REQ-AUTO-004-W1).
 *
 * @MX:NOTE: [AUTO] Cell windowing + rotation: READING_BATCH_MAX_CELLS_PER_RUN
 * env limits cells per invocation. Daily offset = (dayOfYear % totalCells) so
 * the window rotates through the full matrix across days. Full 168-cell coverage
 * is achieved over multiple daily runs. Supabase scheduled functions are the
 * scale fallback for full-matrix-in-one-shot needs (REQ-AUTO-004-U3).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createAdminClient } from "@/utils/supabase/server";
import {
  runDailyReadingBatch,
  type BatchDeps,
  type PoolReadingPieceRow,
} from "@/lib/premium/reading-batch";
import { enumerateMatrixCells } from "@/lib/premium/reading-matrix";

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Validate cron authorization.
 * Accepts:
 *   - Authorization: Bearer <CRON_SECRET>  (Vercel Cron standard)
 *   - x-cron-secret: <CRON_SECRET>         (manual/agent trigger)
 *
 * Fail-closed: if CRON_SECRET env is not set, every request is rejected.
 */
function isAuthorized(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // Fail-closed: no secret configured → reject all
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const xCronSecret = request.headers.get("x-cron-secret");

  return bearerSecret === cronSecret || xCronSecret === cronSecret;
}

// ── Idempotency ───────────────────────────────────────────────────────────────

/**
 * Check whether today's batch has already run.
 * Returns true if any pool row (user_id IS NULL) was created today (UTC).
 *
 * Whole-batch idempotency — per-cell idempotency is a follow-up improvement.
 */
async function hasAlreadyRanToday(): Promise<boolean> {
  const supabase = createAdminClient();

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);

  const { count, error } = await supabase
    .from("reading_pieces")
    .select("id", { count: "exact", head: true })
    .is("user_id", null)
    .gte("created_at", todayStart.toISOString());

  if (error) {
    // On query error, do NOT skip (let batch run to be safe)
    console.error("[CronReadingBatch] Idempotency check error:", error);
    return false;
  }

  return (count ?? 0) > 0;
}

// ── Deps factory ──────────────────────────────────────────────────────────────

/**
 * Build the real BatchDeps from createAdminClient().
 *
 * insertPoolReadingPiece: maps camelCase PoolReadingPieceRow → snake_case DB columns.
 *   user_id is ALWAYS forced to null regardless of the input (REQ-AUTO-002-U3).
 *
 * getRecentTopicsForCell: queries reading_pieces for recent pool rows
 *   (user_id IS NULL + band + format) and returns distinct topics.
 */
function buildBatchDeps(): BatchDeps {
  const supabase = createAdminClient();

  const insertPoolReadingPiece: BatchDeps["insertPoolReadingPiece"] = async (
    row: PoolReadingPieceRow,
  ) => {
    const { error } = await supabase.from("reading_pieces").insert({
      level: row.level,
      format: row.format,
      topic: row.topic,
      body: row.body,
      coverage_pct: row.coveragePct,
      validation_status: row.validationStatus,
      source_facts: row.sourceFacts,
      user_id: null, // ALWAYS null — pool rows have no owner (REQ-AUTO-002-U3)
      band: row.band,
      expires_at: row.expiresAt,
    });
    return { error: error ? new Error(error.message) : null };
  };

  const RECENT_TOPICS_LIMIT = 20;

  const getRecentTopicsForCell: BatchDeps["getRecentTopicsForCell"] = async (
    band,
    format,
  ) => {
    const { data, error } = await supabase
      .from("reading_pieces")
      .select("topic")
      .eq("band", band)
      .eq("format", format)
      .is("user_id", null)
      .order("created_at", { ascending: false })
      .limit(RECENT_TOPICS_LIMIT);

    if (error || !data) {
      return [];
    }

    // Return distinct topics
    const seen = new Set<string>();
    const topics: string[] = [];
    for (const row of data) {
      if (row.topic && !seen.has(row.topic)) {
        seen.add(row.topic);
        topics.push(row.topic);
      }
    }
    return topics;
  };

  return { insertPoolReadingPiece, getRecentTopicsForCell };
}

// ── Windowing ─────────────────────────────────────────────────────────────────

/**
 * Compute daily-rotating offset so the window walks the matrix across days.
 * offset = dayOfYear % totalCells, ensuring full coverage over multiple runs.
 */
function computeDailyOffset(totalCells: number): number {
  const now = new Date();
  const start = new Date(now.getUTCFullYear(), 0, 0);
  const diff = now.getTime() - start.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);
  return (
    (dayOfYear *
      (process.env.READING_BATCH_MAX_CELLS_PER_RUN
        ? parseInt(process.env.READING_BATCH_MAX_CELLS_PER_RUN, 10)
        : 0)) %
    totalCells
  );
}

// ── Route handler ─────────────────────────────────────────────────────────────

/**
 * GET /api/cron/reading-batch
 *
 * Invoked by Vercel Cron (schedule: "0 0 * * *" — daily 00:00 UTC).
 * Can also be triggered manually by ops/agents with CRON_SECRET.
 *
 * Flow:
 *   1. Auth check (CRON_SECRET) → 401 if invalid
 *   2. Idempotency check → skipped response if already ran today
 *   3. Build BatchDeps from Supabase admin client
 *   4. Compute windowing options from env
 *   5. runDailyReadingBatch(deps, windowOptions) → BatchSummary
 *   6. Return BatchSummary JSON
 */
export async function GET(request: NextRequest) {
  // ── 1. Auth ──────────────────────────────────────────────────────────────
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // ── 2. Idempotency ───────────────────────────────────────────────────────
  const alreadyRan = await hasAlreadyRanToday();
  if (alreadyRan) {
    return NextResponse.json({
      skipped: true,
      reason: "already ran today",
    });
  }

  // ── 3. Build deps ────────────────────────────────────────────────────────
  const deps = buildBatchDeps();

  // ── 4. Windowing options ─────────────────────────────────────────────────
  const maxCellsEnv = process.env.READING_BATCH_MAX_CELLS_PER_RUN;
  let windowOptions: { maxCells: number; offset: number } | undefined;

  if (maxCellsEnv) {
    const maxCells = parseInt(maxCellsEnv, 10);
    if (maxCells > 0) {
      const totalCells = enumerateMatrixCells().length;
      const offset = computeDailyOffset(totalCells);
      windowOptions = { maxCells, offset };
    }
  }

  // ── 5. Run batch ─────────────────────────────────────────────────────────
  const summary = await runDailyReadingBatch(deps, windowOptions);

  // ── 6. Return summary ────────────────────────────────────────────────────
  return NextResponse.json(summary);
}
