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
import { enumerateMatrixCells } from "./reading-matrix";
import type { VocabBand, ReadingFormat } from "@inputenglish/shared";

/**
 * Pool acceptance ceiling: a generated reading is approved when at most this
 * fraction of its unique tokens fall outside the band's known-word set.
 * The pedagogical optimal window (judgeCoverage: 2–5% unknown) is unreachable for
 * natural prose measured against a finite 6000-word frequency list — real
 * conversation/professional content lands ~10–25% unknown — so the pool uses a
 * looser, realistic upper bound. Korean gloss support makes a higher unknown ratio
 * acceptable for the targeted (intermediate+) bands.
 */
export const POOL_MAX_UNKNOWN_RATIO = 0.2;

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

// ── Windowing options ─────────────────────────────────────────────────────────

/**
 * Optional windowing parameters for runDailyReadingBatch.
 *
 * @MX:NOTE: [AUTO] Cell-windowing intent: 168 LLM calls in one serverless
 * invocation exceeds Vercel's maxDuration limit (max ~300s Pro). The cron route
 * passes a window so each daily run processes only a slice of the matrix.
 * Full coverage is achieved by rotating the offset across daily runs using
 * day-of-year % totalCells. Supabase scheduled functions are the scale fallback
 * when the full matrix must run in one shot (REQ-AUTO-004-U3).
 *
 * Default (no options) = full matrix — all existing Phase 2 tests stay green.
 */
export interface BatchWindowOptions {
  /**
   * Maximum number of cells to process. Cells are sliced as
   * cells.slice(offset, offset + maxCells).
   */
  maxCells?: number;
  /**
   * Start offset into the full matrix cell array. Used for daily rotation.
   * Default: 0.
   */
  offset?: number;
}

// ── Batch executor ────────────────────────────────────────────────────────────

/**
 * @MX:ANCHOR: [AUTO] Daily reading batch entry point — single public boundary.
 * @MX:REASON: Cost-cap contract: LLM calls = BANDS × FORMATS × TOPICS × retries(≤2).
 * All pool writing flows through this function; no other code path may write
 * pool rows (user_id=NULL + band) to reading_pieces.
 *
 * Iterates the full matrix (or a windowed slice when options.maxCells is set),
 * generates one piece per cell, validates coverage, and persists with band +
 * expires_at. DB failures are isolated per-cell.
 *
 * @param deps - Injectable dependencies for testability (DB, dedup).
 * @param options - Optional windowing: { maxCells, offset } to process a slice.
 *   When omitted, the full matrix is processed (backward-compatible default).
 * @returns BatchSummary — metrics for observability and cost verification.
 */
export async function runDailyReadingBatch(
  deps: BatchDeps,
  options?: BatchWindowOptions,
): Promise<BatchSummary> {
  const allCells = enumerateMatrixCells();

  // Apply optional windowing (offset + maxCells slice).
  // Default (no options): full matrix — existing tests unaffected.
  const start = options?.offset ?? 0;
  const end =
    options?.maxCells != null ? start + options.maxCells : allCells.length;
  const cells = allCells.slice(start, end);
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
    // Accept a reading when its band coverage is within the realistic
    // comprehensible-input ceiling (POOL_MAX_UNKNOWN_RATIO); reject only when it
    // is too hard for the band. Easier readings are still usable pool content.
    const bandCoverage = computeBandCoverage(piece.body);
    const coverageForBand = bandCoverage[cell.band] ?? 0;
    const unknownRatio = 1 - coverageForBand;

    const validationStatus: "pending" | "approved" | "rejected" =
      unknownRatio <= POOL_MAX_UNKNOWN_RATIO ? "approved" : "rejected";

    // ── Pool row invariant (REQ-AUTO-002-U3) ─────────────────────────────────
    // ALWAYS force userId to null regardless of what generateReadingPiece returned.
    // This is the primary guard preventing real user_ids from reaching pool rows.
    const row: PoolReadingPieceRow = {
      level: cell.level,
      format: cell.format,
      topic: cell.topic,
      body: piece.body,
      coveragePct: Math.round((1 - unknownRatio) * 100),
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
