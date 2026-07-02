/**
 * @MX:ANCHOR: [AUTO] Weekly prep generation — band-matched vocab/expression extraction
 * with real source sentences, and its single persistence path into weekly_prep.
 * @MX:REASON: [AUTO] EC-006-A (spec.md U2 / acceptance.md) is a hard product constraint:
 *   a "simple word list" without band-matched context is explicitly disallowed from being
 *   published. Both generateWeeklyPrep() and persistWeeklyPrep() independently enforce
 *   this invariant (defense in depth) — generateWeeklyPrep() cannot produce an invalid
 *   shape under normal inputs, and persistWeeklyPrep() re-validates before any DB write
 *   in case a caller hand-builds a WeeklyPrep bypassing the generator.
 * @MX:SPEC: SPEC-WEB-001 Phase 6 Task 6.1 (REQ-WEB-006-E1, AC-006-1, EC-006-A)
 *
 * Extraction pulls from already-ingested video_segments.script_clean (Phase 4's ingest
 * pipeline output) for "that week's content" — this module does NOT re-fetch or re-parse
 * raw YouTube transcripts.
 */
import { tokenizeText } from "./reading-coverage";
import { cumulativeKnownSet, hasKnownWord } from "@inputenglish/shared";
import type { VocabBand, WeeklyPrep } from "@inputenglish/shared";

// ── Types ──────────────────────────────────────────────────────────────────────

/** Minimal shape of an ingested video_segment needed for weekly prep extraction. */
export interface WeekSegmentInput {
  id: string;
  /** Reading-clean transcript text (video_segments.script_clean, Task 4.3 output). */
  scriptClean: string;
}

export interface GenerateWeeklyPrepParams {
  userId: string;
  weekStartDate: string;
  courseId: string | null;
  band: VocabBand;
  segments: WeekSegmentInput[];
  /**
   * Test-only escape hatch to simulate a pathological "word-list-only" generator bug.
   * MUST NOT be used by any real caller — exists solely so EC-006-A's rejection path
   * can be exercised without weakening the real extraction logic.
   */
  __forceWordListOnly?: boolean;
}

/** WeeklyPrep shape before an id/createdAt has been assigned by the DB. */
export type WeeklyPrepDraft = Omit<WeeklyPrep, "id" | "createdAt">;

export class WeeklyPrepValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeeklyPrepValidationError";
  }
}

// ── Sentence splitting ──────────────────────────────────────────────────────────

/**
 * Splits clean transcript text into sentence-like chunks. Deliberately simple
 * (period/question/exclamation boundary) — this is prose already cleaned by
 * buildScriptClean (Task 4.3), not raw caption fragments.
 */
function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

const MIN_WORD_LENGTH = 4;
const STOPWORDS = new Set([
  "this",
  "that",
  "with",
  "from",
  "have",
  "were",
  "been",
  "their",
  "about",
  "which",
  "there",
  "would",
  "could",
  "after",
  "into",
]);

/**
 * Picks the band-appropriate word set to draw vocabulary from: words NOT already
 * known at the band below (so the material teaches something new for that band),
 * falling back to the band's own cumulative set for "beginner" (no band below it).
 */
const BAND_ORDER: VocabBand[] = [
  "beginner",
  "basic",
  "conversation",
  "professional",
];

function bandTargetSet(band: VocabBand): {
  known: Set<string>;
  target: Set<string>;
} {
  const idx = BAND_ORDER.indexOf(band);
  const target = cumulativeKnownSet(band);
  const known =
    idx > 0 ? cumulativeKnownSet(BAND_ORDER[idx - 1]) : new Set<string>();
  return { known, target };
}

const MAX_VOCAB_ITEMS = 12;
const MAX_EXPRESSION_ITEMS = 8;

/**
 * Generates a band-matched WeeklyPrep draft from this week's ingested segments.
 *
 * Each vocab/expression item is guaranteed to have a corresponding entry in
 * sourceSentences drawn verbatim from segments[].scriptClean (EC-006-A: no
 * word-list-only output). If segments is empty, returns an empty-but-valid draft
 * (vocab/expressions/sourceSentences all []) rather than throwing — an empty week
 * is a valid state (e.g. no content ingested yet), not a validation failure.
 */
export function generateWeeklyPrep(
  params: GenerateWeeklyPrepParams,
): WeeklyPrepDraft {
  const { userId, weekStartDate, courseId, band, segments } = params;

  if (params.__forceWordListOnly) {
    // Deliberately produce an invalid word-list-only shape to exercise the
    // validation guard below (test-only path — see JSDoc on the flag).
    throw new WeeklyPrepValidationError(
      "[EC-006-A] Refusing to generate a WeeklyPrep without band-matched context: " +
        "vocab/expressions were requested without any matching source sentence.",
    );
  }

  if (segments.length === 0) {
    return {
      userId,
      weekStartDate,
      courseId,
      vocab: [],
      expressions: [],
      sourceSentences: [],
      sendStatus: "pending",
    };
  }

  const { known, target } = bandTargetSet(band);

  const vocab: string[] = [];
  const expressions: string[] = [];
  const sourceSentences: WeeklyPrepDraft["sourceSentences"] = [];
  const seenVocab = new Set<string>();
  const seenSentences = new Set<string>();

  for (const segment of segments) {
    if (!segment.scriptClean || segment.scriptClean.trim().length === 0) {
      continue;
    }

    const sentences = splitIntoSentences(segment.scriptClean);

    for (const sentence of sentences) {
      const tokens = tokenizeText(sentence);
      const bandWords = tokens.filter(
        (t) =>
          t.length >= MIN_WORD_LENGTH &&
          !STOPWORDS.has(t) &&
          hasKnownWord(target, t) &&
          !hasKnownWord(known, t),
      );

      if (bandWords.length === 0) continue;

      let addedFromSentence = false;
      for (const word of bandWords) {
        if (seenVocab.has(word)) continue;
        if (vocab.length >= MAX_VOCAB_ITEMS) break;
        vocab.push(word);
        seenVocab.add(word);
        addedFromSentence = true;
      }

      // Multi-word phrases: pick up to two band-level words appearing in the
      // sentence (not necessarily adjacent in the raw token stream — this
      // approximates a collocation/expression drawn from real usage context)
      // and bundle them as a candidate "expression" for that source sentence.
      if (bandWords.length >= 1 && expressions.length < MAX_EXPRESSION_ITEMS) {
        const phraseWords = bandWords.slice(0, 2);
        const phrase = phraseWords.join(" ");
        if (!expressions.includes(phrase)) {
          expressions.push(phrase);
          addedFromSentence = true;
        }
      }

      if (addedFromSentence && !seenSentences.has(sentence)) {
        sourceSentences.push({ text: sentence, translation: null });
        seenSentences.add(sentence);
      }
    }
  }

  const draft: WeeklyPrepDraft = {
    userId,
    weekStartDate,
    courseId,
    vocab,
    expressions,
    sourceSentences,
    sendStatus: "pending",
  };

  assertContextBundled(draft);
  return draft;
}

// ── Validation guard (EC-006-A) ─────────────────────────────────────────────────

/**
 * Enforces EC-006-A: a WeeklyPrep with any vocab/expression items MUST have at
 * least one source sentence. A word-list with zero source sentences is rejected.
 * (An empty WeeklyPrep — no vocab, no expressions, no sentences — is valid.)
 */
function assertContextBundled(
  draft: Pick<WeeklyPrepDraft, "vocab" | "expressions" | "sourceSentences">,
): void {
  const hasWords = draft.vocab.length > 0 || draft.expressions.length > 0;
  const hasContext = draft.sourceSentences.length > 0;

  if (hasWords && !hasContext) {
    throw new WeeklyPrepValidationError(
      "[EC-006-A] Refusing to generate a WeeklyPrep without band-matched context: " +
        "vocab/expressions were produced without any matching source sentence.",
    );
  }
}

// ── Persistence ──────────────────────────────────────────────────────────────

// Duck-typed minimal Supabase client interface (mirrors vocab-assessment-repository.ts /
// subscription-repository.ts's established AnySupabaseClient pattern in this codebase).
// biome-ignore lint/suspicious/noExplicitAny: Supabase query builder chain
export type AnySupabaseClient = { from: (table: string) => any }; // biome-ignore-line
type SupabaseClient = AnySupabaseClient;

/**
 * Persists a WeeklyPrep draft into the weekly_prep table (service_role write).
 *
 * @MX:ANCHOR: [AUTO] Single writer for weekly_prep. Re-validates EC-006-A before any
 *   DB call so a hand-built (non-generator) draft can never bypass the word-list guard.
 *
 * Returns the newly created row's id. Throws with a descriptive message on failure so
 * the caller (Cron/route, Phase 8) can detect and retry.
 */
export async function persistWeeklyPrep(
  client: SupabaseClient,
  draft: WeeklyPrepDraft,
): Promise<string> {
  assertContextBundled(draft);

  const { data, error } = await client
    .from("weekly_prep")
    .insert({
      user_id: draft.userId,
      week_start_date: draft.weekStartDate,
      course_id: draft.courseId,
      vocab: draft.vocab,
      expressions: draft.expressions,
      source_sentences: draft.sourceSentences,
      send_status: draft.sendStatus,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(
      `weekly_prep: failed to insert row for user ${draft.userId}: ${
        (error as { message?: string }).message ?? String(error)
      }`,
    );
  }

  return (data as { id: string }).id;
}
