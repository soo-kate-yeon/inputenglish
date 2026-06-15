/**
 * Daily Reading Batch executor (SPEC-INPUT-002 Phase 2, REQ-AUTO-002).
 *
 * Iterates the band × format × topic matrix and generates one pool reading piece
 * per cell, persisting each result with user_id = NULL (pool sentinel).
 *
 * @MX:NOTE: [AUTO] Pool row invariant: user_id MUST be NULL for all pool rows.
 * POOL_SENTINEL is passed to generateReadingPiece as the userId, then forcibly
 * overridden to null before DB persistence. This prevents any code path from
 * accidentally writing a real user_id to a pool row (REQ-AUTO-002-U3).
 *
 * @MX:NOTE: [AUTO] Dedup/rotation intent: getRecentTopicsForCell is called per
 * (band, format) pair before generation. If the current topic appears in recent
 * results, the cell is still processed (graceful — no skip) but the dedup signal
 * is available for scheduling-layer rotation in future phases.
 *
 * @MX:NOTE: [AUTO] Cost model: LLM calls = BANDS × FORMATS × TOPICS (× internal
 * retries ≤ MAX_RETRIES in reading-generation.ts). Total is INDEPENDENT of user
 * count (REQ-AUTO-004-U2). DAU growth never increases this budget.
 */

import { generateReadingPiece } from "./reading-generation";
import { computeBandCoverage } from "./band-coverage";
import { judgeCoverage } from "@inputenglish/shared";
import { enumerateMatrixCells } from "./reading-matrix";
import type { VocabBand, ReadingFormat } from "@inputenglish/shared";

// ── Pool sentinel ─────────────────────────────────────────────────────────────

/**
 * Sentinel userId passed to generateReadingPiece for pool generation.
 * The persistence layer always forces this to null before DB insert.
 * @MX:NOTE: [AUTO] POOL_SENTINEL signals that this piece is for the shared pool.
 */
export const POOL_SENTINEL = "POOL";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface BatchSummary {
  cellsProcessed: number;
  inserted: number;
  approved: number;
  rejected: number;
  llmCalls: number;
}

/** Row shape passed to insertPoolReadingPiece dependency. */
export interface PoolReadingPieceRow {
  level: string;
  format: ReadingFormat;
  topic: string;
  body: string;
  coveragePct: number | null;
  validationStatus: "pending" | "approved" | "rejected";
  sourceFacts: Record<string, unknown>;
  /** ALWAYS null — pool rows have no owner (REQ-AUTO-002-U3). */
  userId: null;
  band: VocabBand;
  /** Expiry timestamp for staleness management (REQ-AUTO-002-U2). */
  expiresAt: string;
}

export interface BatchDeps {
  /**
   * Inject DB persistence. Must force userId = null.
   * Returns { error: Error | null }.
   */
  insertPoolReadingPiece: (
    row: PoolReadingPieceRow,
  ) => Promise<{ error: Error | null }>;

  /**
   * Returns the list of recent topics generated for a given (band, format) pair.
   * Used for dedup/rotation: if current topic is in the list, it was recently used.
   */
  getRecentTopicsForCell: (
    band: VocabBand,
    format: ReadingFormat,
  ) => Promise<string[]>;
}

// ── Staleness config ──────────────────────────────────────────────────────────

const STALE_DAYS =
  parseInt(process.env.READING_POOL_STALE_DAYS ?? "7", 10) || 7;

function computeExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + STALE_DAYS);
  return d.toISOString();
}

// ── Batch executor ────────────────────────────────────────────────────────────

/**
 * @MX:ANCHOR: [AUTO] Daily reading batch entry point — single public boundary.
 * @MX:REASON: Cost-cap contract: LLM calls = BANDS × FORMATS × TOPICS × retries(≤2).
 * All pool writing flows through this function; no other code path may write
 * pool rows (user_id=NULL + band) to reading_pieces.
 *
 * Iterates the full matrix, generates one piece per cell, validates coverage,
 * and persists with band + expires_at. DB failures are isolated per-cell.
 *
 * @param deps - Injectable dependencies for testability (DB, dedup).
 * @returns BatchSummary — metrics for observability and cost verification.
 */
export async function runDailyReadingBatch(
  deps: BatchDeps,
): Promise<BatchSummary> {
  const cells = enumerateMatrixCells();
  const expiresAt = computeExpiresAt();

  let cellsProcessed = 0;
  let inserted = 0;
  let approved = 0;
  let rejected = 0;
  let llmCalls = 0;

  // @MX:WARN: [AUTO] Matrix loop — O(BANDS × FORMATS × TOPICS) iterations.
  // @MX:REASON: Each iteration issues one LLM call (via generateReadingPiece).
  // Total calls are bounded by matrix size, never by user count.
  for (const cell of cells) {
    cellsProcessed++;

    // ── Dedup/rotation check (REQ-AUTO-002-E2) ──────────────────────────────
    // getRecentTopicsForCell signals recent usage; generation still proceeds
    // for this phase (graceful dedup). Future scheduling layer may skip cells.
    const recentTopics = await deps.getRecentTopicsForCell(
      cell.band,
      cell.format,
    );
    const isDuplicate = recentTopics.includes(cell.topic);
    // Note: isDuplicate is currently informational; we still generate to fill
    // the pool. Future: skip if isDuplicate && alternativeTopic available.
    void isDuplicate;

    // ── Generate reading piece ────────────────────────────────────────────────
    let piece: Awaited<ReturnType<typeof generateReadingPiece>>;
    try {
      piece = await generateReadingPiece({
        level: cell.level,
        format: cell.format,
        topic: cell.topic,
        userId: POOL_SENTINEL,
      });
      llmCalls++;
    } catch (err) {
      console.error(
        `[ReadingBatch] generateReadingPiece failed for cell`,
        cell,
        err,
      );
      continue;
    }

    // ── Validation gate (REQ-AUTO-002-W1) ────────────────────────────────────
    // Reuse computeBandCoverage(body)[cell.band] to derive unknownRatio,
    // then map judgeCoverage result to validation_status.
    const bandCoverage = computeBandCoverage(piece.body);
    const coverageForBand = bandCoverage[cell.band] ?? 0;
    const unknownRatio = 1 - coverageForBand;
    const coverageStatus = judgeCoverage(unknownRatio);

    const validationStatus: "pending" | "approved" | "rejected" =
      coverageStatus === "optimal"
        ? "approved"
        : coverageStatus === "too-hard"
          ? "rejected"
          : "pending"; // too-easy: usable but sub-optimal

    // ── Pool row invariant (REQ-AUTO-002-U3) ─────────────────────────────────
    // ALWAYS force userId to null regardless of what generateReadingPiece returned.
    // This is the primary guard preventing real user_ids from reaching pool rows.
    const row: PoolReadingPieceRow = {
      level: cell.level,
      format: cell.format,
      topic: cell.topic,
      body: piece.body,
      coveragePct: piece.coveragePct,
      validationStatus,
      sourceFacts: piece.sourceFacts,
      userId: null, // pool sentinel — ALWAYS null
      band: cell.band,
      expiresAt,
    };

    // ── Persist with isolated error handling ──────────────────────────────────
    try {
      const { error } = await deps.insertPoolReadingPiece(row);
      if (error) {
        console.error(`[ReadingBatch] Insert failed for cell`, cell, error);
        continue;
      }
      inserted++;
      if (validationStatus === "approved") {
        approved++;
      } else if (validationStatus === "rejected") {
        rejected++;
      }
    } catch (err) {
      console.error(`[ReadingBatch] Unexpected insert error`, cell, err);
    }
  }

  return { cellsProcessed, inserted, approved, rejected, llmCalls };
}
