// @MX:ANCHOR: [AUTO] IL Onboarding Persist Writer — single authoritative writer for
//   users.il_index / vocab_estimate / selected_course during Phase 3 onboarding.
// @MX:REASON: [AUTO] Mirrors vocab-assessment-repository.ts (P-U1 pattern): uses the
//   service-role admin client with EXPLICIT user_id scoping on every write, since the
//   caller (API route) has already validated the JWT via requireApiUser. il_index has
//   a DB CHECK constraint (>=1.0 AND <=7.0 OR NULL) — clampIlIndex() enforces the same
//   invariant at the application layer defensively, before any write is attempted.
//
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002 (E1, E2, U1, U3) + REQ-WEB-005 (Task 3.3)

// ── Supabase client type (minimal surface, mirrors vocab-assessment-repository.ts) ──

// biome-ignore lint/suspicious/noExplicitAny: Supabase query builder chain
export type AnySupabaseClient = { from: (table: string) => any }; // biome-ignore-line
type SupabaseClient = AnySupabaseClient;

// ── IL boundary clamp ──────────────────────────────────────────────────────────

const IL_MIN = 1.0;
const IL_MAX = 7.0;

/**
 * Clamps an IL index value into the invariant range [1.0, 7.0].
 *
 * @MX:ANCHOR: [AUTO] IL boundary invariant — il_index MUST ALWAYS stay within [1.0, 7.0].
 * @MX:REASON: [AUTO] Mirrors the DB CHECK constraint (users_il_index_check) at the
 *   application layer so callers get a defensive clamp before any write is attempted.
 */
export function clampIlIndex(il: number): number {
  return Math.min(IL_MAX, Math.max(IL_MIN, il));
}

// ── writeIlSeed (Task 3.1) ───────────────────────────────────────────────────────

/**
 * Writes the raw self-report IL seed (Task 3.1 band-seed step) onto users.il_index.
 *
 * This is an intermediate write: the FINAL persisted il_index is set by
 * finalizeIlIndex() after Task 3.2's cross-validation. Writing here allows the
 * self-report to survive if the user does not immediately continue to the vocab
 * diagnostic step.
 *
 * (REQ-WEB-002-E1, AC-002-1)
 */
export async function writeIlSeed(
  client: SupabaseClient,
  userId: string,
  ilSeed: number,
): Promise<void> {
  const clamped = clampIlIndex(ilSeed);

  const { error } = await client
    .from("users")
    .update({ il_index: clamped })
    .eq("id", userId);

  if (error) {
    throw new Error(
      `[SPEC-WEB-001 REQ-WEB-002-E1] users.il_index seed write failed for user ${userId}: ${
        (error as { message?: string }).message ?? String(error)
      }`,
    );
  }
}

// ── finalizeIlIndex (Task 3.2) ───────────────────────────────────────────────────

export interface FinalizeIlIndexParams {
  /** IL value from the Task 3.1 self-report (sample-clip band-seed). */
  selfReportIl: number;
  /** IL-comparable value derived from the vocab-assessment diagnostic output. */
  diagnosticIl: number;
  /** Optional vocab estimate (word count) to persist alongside il_index. */
  vocabEstimate?: number;
}

export interface FinalizeIlIndexResult {
  finalIl: number;
}

/**
 * Cross-validates the self-report IL seed against the vocab-diagnostic-derived IL
 * estimate and persists the FINAL users.il_index.
 *
 * "Lower wins" (EC-002-B, security/UX invariant): if the self-report is higher than
 * the diagnostic estimate, the diagnostic (lower) value is used. The system NEVER
 * starts a user higher than their measured vocabulary would justify.
 *
 * @MX:ANCHOR: [AUTO] EC-002-B invariant — never start higher than the diagnostic estimate.
 * @MX:REASON: [AUTO] This is the single durable write point for il_index during onboarding.
 *   min(selfReportIl, diagnosticIl) enforces "lower wins" unconditionally; clampIlIndex()
 *   additionally enforces the [1.0, 7.0] DB invariant before the write. (REQ-WEB-002-E2, U3)
 */
export async function finalizeIlIndex(
  client: SupabaseClient,
  userId: string,
  params: FinalizeIlIndexParams,
): Promise<FinalizeIlIndexResult> {
  const { selfReportIl, diagnosticIl, vocabEstimate } = params;

  // EC-002-B: lower wins — never start higher than the diagnostic estimate.
  const finalIl = clampIlIndex(Math.min(selfReportIl, diagnosticIl));

  const updatePayload: Record<string, unknown> = { il_index: finalIl };
  if (vocabEstimate !== undefined) {
    updatePayload.vocab_estimate = vocabEstimate;
  }

  const { error } = await client
    .from("users")
    .update(updatePayload)
    .eq("id", userId);

  if (error) {
    throw new Error(
      `[SPEC-WEB-001 REQ-WEB-002-E2/U3] users.il_index finalize write failed for user ${userId}: ${
        (error as { message?: string }).message ?? String(error)
      }`,
    );
  }

  return { finalIl };
}

// ── writeSelectedCourse (Task 3.3) ───────────────────────────────────────────────

/**
 * Writes a fixed course identifier string onto users.selected_course, and marks
 * onboarding complete via the existing `onboarding_completed_at` timestamp column
 * (added by 20260418010000_add_learning_profile_fields.sql, already the canonical
 * completion signal consumed by the mobile app — apps/mobile/app/onboarding.tsx,
 * intro.tsx, index.tsx, _layout.tsx). Course selection is Phase 3's final onboarding
 * step, so this is the correct place to set it (not `il_index`, which Task 3.1's
 * band-seed route writes as an intermediate, un-cross-validated value).
 *
 * Phase 3 scope: the `courses` table is empty (Phase 5 seeds real rows), so
 * selected_course is a fixed string identifier, NOT a foreign key. Phase 5 must
 * reconcile this fixed string with real `courses.id` values once seeded (see spec.md D6).
 *
 * (REQ-WEB-005, Task 3.3)
 */
export async function writeSelectedCourse(
  client: SupabaseClient,
  userId: string,
  courseIdentifier: string,
): Promise<void> {
  const { error } = await client
    .from("users")
    .update({
      selected_course: courseIdentifier,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) {
    throw new Error(
      `[SPEC-WEB-001 REQ-WEB-005 Task 3.3] users.selected_course write failed for user ${userId}: ${
        (error as { message?: string }).message ?? String(error)
      }`,
    );
  }
}
