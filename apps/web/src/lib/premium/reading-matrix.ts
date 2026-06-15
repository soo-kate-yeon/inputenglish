/**
 * @MX:NOTE: [AUTO] Band-level content pool matrix definition.
 * BANDS × FORMATS × TOPICS = daily reading pool cells.
 * band → CEFR level mapping via getBandSeedMetadata (vocab-band.ts).
 * Volume per band is env-tunable via READING_BATCH_TOPICS_PER_CELL.
 * @MX:SPEC: SPEC-INPUT-002 - Phase 2, Task 2.2 (REQ-AUTO-002-U1)
 */
import { getBandSeedMetadata } from "@inputenglish/shared";
import type { VocabBand, ReadingFormat } from "@inputenglish/shared";

// ── Band and format constants ────────────────────────────────────────────────

/** All 4 vocab bands (order matches BAND_WORD_COUNTS in vocab-band.ts). */
export const BANDS: VocabBand[] = [
  "beginner",
  "basic",
  "conversation",
  "professional",
];

/** All 6 reading formats (matches ReadingFormat in shared types). */
export const FORMATS: ReadingFormat[] = [
  "noir",
  "dialogue",
  "nonfiction",
  "editorial",
  "economic",
  "business",
];

/**
 * Topic list for the daily reading pool.
 * @MX:NOTE: [AUTO] TOPICS covers at minimum: climate, technology, economics.
 * Additional general topics (health, education, culture, science) provide
 * adequate daily variety across the band × format matrix.
 * Extend this list to increase pool diversity without changing batch architecture.
 */
export const TOPICS: string[] = [
  "climate",
  "technology",
  "economics",
  "health",
  "education",
  "culture",
  "science",
];

// ── Matrix cell type ─────────────────────────────────────────────────────────

export interface MatrixCell {
  band: VocabBand;
  /** CEFR level string derived from band via getBandSeedMetadata. */
  level: string;
  format: ReadingFormat;
  topic: string;
}

// ── Matrix enumeration ───────────────────────────────────────────────────────

/**
 * Enumerate all band × format × topic matrix cells.
 *
 * Each cell maps band to its CEFR level via getBandSeedMetadata, so
 * generateReadingPiece receives the correct level string without re-mapping.
 *
 * Total cells = BANDS.length × FORMATS.length × TOPICS.length.
 * This count equals the daily LLM call budget (before retries).
 *
 * @returns Array<MatrixCell> — full product of bands, formats, and topics.
 */
export function enumerateMatrixCells(): MatrixCell[] {
  const cells: MatrixCell[] = [];
  for (const band of BANDS) {
    const { cefrLevel: level } = getBandSeedMetadata(band);
    for (const format of FORMATS) {
      for (const topic of TOPICS) {
        cells.push({ band, level, format, topic });
      }
    }
  }
  return cells;
}
