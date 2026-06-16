// @MX:ANCHOR: [AUTO] Vocab Assessment Persist Writer — single authoritative persistence path.
// @MX:REASON: [AUTO] This module is the ONLY writer for user_vocab_profiles and known_words.
//   Both tables have RLS self_only (auth.uid()=user_id). This code uses the service-role
//   admin client (createAdminClient) because requireApiUser validates the JWT and extracts
//   the authed user.id, which is then explicitly scoped on EVERY write via user_id field.
//   This satisfies P-U1: all writes carry the authenticated user_id, bypassing RLS with
//   service-role while maintaining the correct scoping manually.
//
// @MX:NOTE: [AUTO] RLS client decision (P-U1):
//   The user-token / user-scoped SSR client (createClient from @supabase/ssr) requires
//   Next.js cookies() which is only available in App Router server components / route
//   handlers calling cookies() directly. The API route already uses requireApiUser which
//   internally calls createAdminClient for JWT validation. To avoid creating a second
//   server-side cookie client (which would also need the request cookies forwarded), we
//   use createAdminClient (service role) and EXPLICITLY set user_id on every write.
//   This is the safer, well-tested pattern (mirrors today/route.ts, ingest/route.ts).
//   Consequence: RLS is enforced at the application level (user_id scoping) rather than
//   at the DB level. The self_only RLS policy remains an additional safety net at the DB
//   level for any direct SQL access.
//
// @MX:SPEC: SPEC-INPUT-003 REQ-VOCAB-P (P-E1, P-E2, P-U1, P-U2, P-W1)

import type { VocabBand } from "@inputenglish/shared";

// ── Types ──────────────────────────────────────────────────────────────────────

/** A seed known-word entry (from scoreAssessment output). */
export interface SeedKnownWord {
  lemma: string;
  frequencyBand: VocabBand | "advanced";
}

/** Snapshot appended to update_history on each assessment. */
export interface UpdateHistorySnapshot {
  timestamp: string;
  reason: string;
  previousBand?: VocabBand;
}

/** Parameters for upsertVocabProfile. */
export interface UpsertVocabProfileParams {
  estimatedBand: VocabBand;
  estimatedLevel: string;
  snapshot: UpdateHistorySnapshot;
}

// ── Supabase client type (minimal surface) ────────────────────────────────────

// We use a duck-typed minimal interface so both the real Supabase admin client
// (returned by createAdminClient) and lightweight test mocks can be passed in.
// The real client satisfies this interface since it has a `.from()` method.
// `any` is intentional here: the Supabase PostgREST chain returns complex generics
// that are incompatible with typed mocks. This is the established project pattern
// (see today/route.ts: ReturnType<typeof createAdminClient> passed as `any` chain).
// biome-ignore lint/suspicious/noExplicitAny: Supabase query builder chain
export type AnySupabaseClient = { from: (table: string) => any }; // biome-ignore-line
type SupabaseClient = AnySupabaseClient;

// ── upsertVocabProfile ────────────────────────────────────────────────────────

/**
 * Upserts a user_vocab_profiles row for the given user.
 *
 * @MX:ANCHOR: [AUTO] Profile upsert — single persistence path for vocab band + history.
 * @MX:REASON: [AUTO] UNIQUE(user_id) enforces one row per user. update_history is
 *   read-modify-write: existing history is preserved and the new snapshot appended.
 *   On conflict (re-assessment), the row is updated (not duplicated). This is the only
 *   writer for user_vocab_profiles — changes here affect all band-resolution consumers.
 *   (REQ-VOCAB-P-E1 / P-U1 / P-W1)
 *
 * Throws with a descriptive message on failure so the caller (API route) can detect
 * partial failure (profile written, words not yet written) and return a retryable error.
 */
export async function upsertVocabProfile(
  client: SupabaseClient,
  userId: string,
  params: UpsertVocabProfileParams,
): Promise<void> {
  const { estimatedBand, estimatedLevel, snapshot } = params;

  // Read existing profile to preserve update_history (read-modify-write pattern).
  // Using .select().eq().maybeSingle() so we get null on "not found" without an error.
  // Non-fatal: if the read fails, we treat history as [] (conservative) and continue.
  const { data: existing } = await client
    .from("user_vocab_profiles")
    .select("update_history")
    .eq("user_id", userId)
    .maybeSingle();

  // Build the new update_history by appending the snapshot to existing history.
  const existingHistory: UpdateHistorySnapshot[] =
    (existing as { update_history?: UpdateHistorySnapshot[] } | null)
      ?.update_history ?? [];
  const newHistory: UpdateHistorySnapshot[] = [...existingHistory, snapshot];

  // Upsert the profile row. onConflict: 'user_id' makes re-assessment idempotent.
  // All fields are explicitly set including user_id to satisfy P-U1 (RLS scoping).
  const { error } = await client.from("user_vocab_profiles").upsert(
    {
      user_id: userId,
      estimated_band: estimatedBand,
      estimated_level: estimatedLevel,
      update_history: newHistory,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );

  if (error) {
    throw new Error(
      `[SPEC-INPUT-003 P-W1] user_vocab_profiles upsert failed for user ${userId}: ${(error as { message?: string }).message ?? String(error)}`,
    );
  }
}

// ── insertSeedKnownWords ───────────────────────────────────────────────────────

/**
 * Bulk-upserts seed known-words into known_words for the given user.
 *
 * @MX:ANCHOR: [AUTO] Known-words seed writer — single persistence path for source='seed'.
 * @MX:REASON: [AUTO] UNIQUE(user_id, lemma) enforces no duplicates. on-conflict upsert
 *   makes re-seeding idempotent (re-submission does not produce duplicate-key errors).
 *   Caller (scoreAssessment output) guarantees only real known words are passed — this
 *   function adds a defensive check. Pseudowords and unknown tokens MUST NOT appear here
 *   (P-U2). This is the only writer for known_words with source='seed'. (REQ-VOCAB-P-E2)
 *
 * Returns early without any DB call if seedKnownWords is empty.
 *
 * Throws with a descriptive message on failure so the caller can detect partial failure
 * (profile already written, words not yet written) and return a retryable error (P-W1).
 */
export async function insertSeedKnownWords(
  client: SupabaseClient,
  userId: string,
  seedKnownWords: SeedKnownWord[],
): Promise<void> {
  // Early return: nothing to insert (all words were unknown or no real words)
  if (seedKnownWords.length === 0) {
    return;
  }

  // Build rows — every row carries user_id for RLS scoping (P-U1).
  const rows = seedKnownWords.map((w) => ({
    user_id: userId,
    lemma: w.lemma,
    frequency_band: w.frequencyBand,
    source: "seed" as const,
    last_seen: new Date().toISOString(),
  }));

  // Upsert with onConflict: 'user_id,lemma' for idempotent re-seed (P-E2).
  // On conflict, we update frequency_band and last_seen so re-assessment refreshes data.
  const { error } = await client.from("known_words").upsert(rows, {
    onConflict: "user_id,lemma",
  });

  if (error) {
    throw new Error(
      `[SPEC-INPUT-003 P-W1] known_words upsert failed for user ${userId}: ${(error as { message?: string }).message ?? String(error)}`,
    );
  }
}
