// @MX:ANCHOR: [AUTO] Vocab Refine orchestration — single authoritative path for runtime band adaptation.
// @MX:REASON: [AUTO] This module ties together the coverage signal (R-E1), hysteresis (R-W1),
//   band-flip persistence (R-E2), and the tap/inferred known-word writer (R-E3 / R-O1).
//   All runtime band adjustments flow through processVocabSignal(). recordKnownWord() is the
//   only writer for known_words with source='tap'|'inferred'. (REQ-VOCAB-R)
//
// @MX:WARN: [AUTO] Cold-start empty-set fallback (R-U1).
// @MX:REASON: [AUTO] verifyCoverage(text, emptySet) marks EVERY token as unknown (unknownRatio≈1),
//   which would produce a misleading "too-hard" signal before any seeds exist. effectiveCoverageRatio()
//   detects an empty or absent knownLemmas set and falls back to computeBandCoverage()-derived
//   coverage so the loop degrades gracefully until seeds are populated.
//
// @MX:NOTE: [AUTO] Vote state storage:
//   VoteState is not stored in its own DB column. It lives in the latest snapshot within
//   user_vocab_profiles.update_history (free-form jsonb). The caller (API route) reads the
//   current voteState from the last update_history entry and passes it to processVocabSignal.
//   On flip, the new voteState (reset to {direction:0, count:0}) is embedded in the snapshot.
//
// @MX:SPEC: SPEC-INPUT-003 REQ-VOCAB-R (R-E1, R-W1, R-E2, R-E3, R-O1, R-U1)

import {
  coverageDifficultyAdjustment,
  bandForLemma,
  applyHysteresisVote,
  getBandSeedMetadata,
} from "@inputenglish/shared";
import type { VocabBand } from "@inputenglish/shared";
import type { VoteState } from "@inputenglish/shared";
import { verifyCoverage } from "./reading-coverage";
import { computeBandCoverage } from "./band-coverage";
import { upsertVocabProfile } from "./vocab-assessment-repository";
import type { AnySupabaseClient } from "./vocab-assessment-repository";

// ── Types ─────────────────────────────────────────────────────────────────────

/** Source for a known-word entry. */
export type KnownWordSource = "tap" | "inferred";

/** Parameters for processVocabSignal. */
export interface VocabSignalParams {
  /** Session content text for coverage analysis. */
  text: string;
  /** User's current known lemmas (from known_words table). May be empty (cold start). */
  knownLemmas: Set<string> | undefined;
  /** User's current estimated band (from user_vocab_profiles). */
  currentBand: VocabBand;
  /** Current running vote state (from latest update_history snapshot or initial). */
  voteState: VoteState;
  /** Hysteresis K (consecutive votes required). Default: 3. */
  k?: number;
}

/** Result of processVocabSignal. */
export interface VocabSignalResult {
  /** True if the band was flipped in this call. */
  flipped: boolean;
  /** The band after applying this signal (= currentBand if no flip). */
  newBand: VocabBand;
  /** Updated vote state (reset on flip). */
  newVoteState: VoteState;
  /** The direction vote computed from this signal: -1 | 0 | +1. */
  directionVote: -1 | 0 | 1;
}

// ── Cold-start fallback ───────────────────────────────────────────────────────

/**
 * Returns the effective unknown ratio for the given text.
 *
 * If knownLemmas is empty or undefined (cold start before seeding), uses
 * computeBandCoverage() to derive a coverage estimate for the user's current
 * band — preventing the "all tokens unknown" trap.
 *
 * If knownLemmas is populated, delegates to verifyCoverage().
 *
 * @MX:WARN: [AUTO] Cold-start empty-set trap (R-U1).
 * @MX:REASON: [AUTO] verifyCoverage(text, new Set()) marks every token unknown (unknownRatio=1),
 *   generating a spurious "too-hard" −1 vote that would incorrectly lower the band before
 *   any seeds exist. This function intercepts the empty-set case and falls back to
 *   computeBandCoverage so the Refine loop degrades gracefully until seeds are populated.
 */
export function effectiveCoverageRatio(
  text: string,
  knownLemmas: Set<string> | undefined,
  currentBand: VocabBand,
): number {
  // If we have a populated known-lemma set, use verifyCoverage directly
  if (knownLemmas !== undefined && knownLemmas.size > 0) {
    const { unknownRatio } = verifyCoverage(text, knownLemmas);
    return unknownRatio;
  }

  // Cold-start fallback: derive unknown ratio from band coverage
  // computeBandCoverage returns the fraction of unique tokens in text that fall
  // within the band's cumulative word set. unknownRatio ≈ 1 - coverage[band].
  const bandCoverage = computeBandCoverage(text);
  const coverage = bandCoverage[currentBand] ?? 0;
  return 1 - coverage;
}

// ── Direction vote ────────────────────────────────────────────────────────────

/**
 * Computes the directional difficulty adjustment from an unknown ratio.
 *
 * Delegates to coverageDifficultyAdjustment() from @inputenglish/shared.
 * Returns -1 (too hard), 0 (optimal), or +1 (too easy).
 *
 * (REQ-VOCAB-R-E1)
 */
export function computeDirectionVote(unknownRatio: number): -1 | 0 | 1 {
  return coverageDifficultyAdjustment(unknownRatio);
}

// ── Tap / inferred known-word writer ─────────────────────────────────────────

/**
 * Upserts a single lemma into known_words with the given source.
 *
 * Use source='tap' for tap-to-gloss events (R-E3).
 * Use source='inferred' for fully-read content (R-O1).
 *
 * If the lemma is not in the frequency list, it is tagged 'advanced'
 * (as documented: unknown lemmas default to advanced band).
 *
 * @MX:ANCHOR: [AUTO] Known-word tap/inferred writer — single upsert path for tap and inferred.
 * @MX:REASON: [AUTO] UNIQUE(user_id, lemma) means re-tapping a word just updates last_seen.
 *   frequency_band is determined by bandForLemma(); if the lemma is not in the list, 'advanced'
 *   is used (documented rule). This is the only writer for source='tap'|'inferred'. (R-E3 / R-O1)
 */
export async function recordKnownWord(
  client: AnySupabaseClient,
  userId: string,
  lemma: string,
  source: KnownWordSource,
): Promise<void> {
  // Determine frequency band: use bandForLemma(); if not in list → 'advanced'
  const frequencyBand = bandForLemma(lemma) ?? "advanced";

  const row = {
    user_id: userId,
    lemma,
    frequency_band: frequencyBand,
    source,
    last_seen: new Date().toISOString(),
  };

  const { error } = await client.from("known_words").upsert([row], {
    onConflict: "user_id,lemma",
  });

  if (error) {
    throw new Error(
      `[SPEC-INPUT-003 R-E3/R-O1] known_words upsert failed for user ${userId}, lemma "${lemma}": ${
        (error as { message?: string }).message ?? String(error)
      }`,
    );
  }
}

// ── Orchestration ─────────────────────────────────────────────────────────────

/**
 * Processes a single session vocab signal:
 * 1. Compute effective unknown ratio (with cold-start fallback).
 * 2. Compute direction vote (-1 / 0 / +1).
 * 3. Apply hysteresis to get new band + vote state.
 * 4. On flip: persist to user_vocab_profiles with update_history snapshot.
 * 5. Return result (caller decides whether to update stored voteState).
 *
 * Does NOT write tap/inferred words — those are handled separately via recordKnownWord().
 * Does NOT modify today/route.ts (I-U1 KEEP).
 *
 * @MX:ANCHOR: [AUTO] Refine loop orchestration — single entry point for session signal → band update.
 * @MX:REASON: [AUTO] All Refine-phase band mutations flow through this function. On flip, it
 *   persists via upsertVocabProfile (the only profile writer), embedding the new voteState
 *   in the update_history snapshot. Non-flip signals return without any DB write. (R-E1/R-W1/R-E2)
 */
export async function processVocabSignal(
  client: AnySupabaseClient,
  userId: string,
  params: VocabSignalParams,
): Promise<VocabSignalResult> {
  const { text, knownLemmas, currentBand, voteState, k = 3 } = params;

  // Step 1: Compute effective unknown ratio (cold-start safe)
  const unknownRatio = effectiveCoverageRatio(text, knownLemmas, currentBand);

  // Step 2: Direction vote
  const directionVote = computeDirectionVote(unknownRatio);

  // Step 3: Apply hysteresis
  const hysteresisResult = applyHysteresisVote(
    currentBand,
    voteState,
    directionVote,
    { k },
  );

  const { band: newBand, voteState: newVoteState, flipped } = hysteresisResult;

  // Step 4: On flip → persist band update with snapshot
  if (flipped) {
    const snapshot = {
      timestamp: new Date().toISOString(),
      reason: "refine" as const,
      previousBand: currentBand,
      // Embed voteState in snapshot so it survives across sessions
      voteState: newVoteState,
    };

    // Determine CEFR level for the new band
    const estimatedLevel = getBandSeedMetadata(newBand).cefrLevel;

    await upsertVocabProfile(client, userId, {
      estimatedBand: newBand,
      estimatedLevel,
      snapshot,
    });
  }

  return {
    flipped,
    newBand,
    newVoteState,
    directionVote,
  };
}
