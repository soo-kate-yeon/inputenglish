// @MX:ANCHOR: [AUTO] POST /api/premium/vocab-assessment — external boundary for vocab assessment.
// @MX:REASON: [AUTO] This is the single entry point for persisting assessment results.
//   It is responsible for: (1) authentication via requireApiUser, (2) request validation,
//   (3) SERVER-AUTHORITATIVE re-validation of isReal/band from the frequency list (contract
//   C5.4 — do NOT trust any client-sent isReal/band), (4) scoring via scoreAssessment,
//   (5) persistence via the repository in atomic-or-recoverable order (profile first, then
//   words), and (6) returning a machine-readable error code on partial failure (P-W1).
//
// @MX:NOTE: [AUTO] Atomicity strategy (P-W1):
//   Supabase JS v2 does not expose a cross-table transaction API. We use sequential writes:
//   profile upsert THEN known_words upsert. If profile succeeds but words fail, we return
//   { code: 'profile_written_words_failed' } so the client can retry. The profile upsert
//   is idempotent (on-conflict user_id), so a retry is safe: it will re-upsert the same
//   profile and then attempt words again. This is "atomic-or-recoverable" as required by P-W1.
//
// @MX:NOTE: [AUTO] Server re-validation (C5.4):
//   Client sends { answers: Array<{ token, known }> }. We IGNORE any isReal/band the
//   client might send and re-derive isReal from getLemmaRank(token) (not null = real word)
//   and band from bandForLemma(token). This prevents a malicious or buggy client from
//   injecting pseudowords as known real words into the known_words table.
//
// @MX:SPEC: SPEC-INPUT-003 REQ-VOCAB-P (P-E1, P-E2, P-U1, P-U2, P-W1) + contract C5.4

import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import {
  assertFrequencyListLoaded,
  getLemmaRank,
  bandForLemma,
  scoreAssessment,
} from "@inputenglish/shared";
import type { ScorerInput } from "@inputenglish/shared";
import {
  upsertVocabProfile,
  insertSeedKnownWords,
} from "@/lib/premium/vocab-assessment-repository";

// ── Request schema ─────────────────────────────────────────────────────────────

/**
 * A single answer item from the client (onboarding assessment form).
 * NOTE: isReal and band are NOT trusted from the client — server re-derives them.
 */
interface ClientAnswer {
  /** The token / word shown to the user. */
  token: string;
  /** Whether the user claims to know this word. */
  known: boolean;
}

interface AssessmentRequestBody {
  answers: ClientAnswer[];
}

// ── Validation ─────────────────────────────────────────────────────────────────

function parseRequestBody(raw: unknown): AssessmentRequestBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;
  if (!Array.isArray(body.answers)) return null;

  const answers: ClientAnswer[] = [];
  for (const item of body.answers) {
    if (!item || typeof item !== "object") return null;
    const a = item as Record<string, unknown>;
    if (typeof a.token !== "string") return null;
    if (typeof a.known !== "boolean") return null;
    answers.push({ token: a.token, known: a.known });
  }

  return { answers };
}

// ── POST handler ───────────────────────────────────────────────────────────────

/**
 * POST /api/premium/vocab-assessment
 *
 * Accepts assessment answers, re-validates tokens server-side, scores the assessment,
 * and persists the profile + seed known-words.
 *
 * Response (200):
 *   { estimatedBand: VocabBand, estimatedLevel: string, seedCount: number }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — invalid request body
 *   500 — persistence failure (with machine-readable code for partial failure)
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step 1: Auth ─────────────────────────────────────────────────────────
  const userOrResponse = await requireApiUser(request);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // 401
  }
  const user = userOrResponse;

  // ── Step 2: Frequency list guard (F-W1) ─────────────────────────────────
  // Fatal: if the list is not loaded, scoring results would be meaningless.
  try {
    assertFrequencyListLoaded();
  } catch (err) {
    return NextResponse.json(
      {
        error: "Frequency list not loaded — assessment unavailable",
        code: "frequency_list_not_loaded",
        detail: err instanceof Error ? err.message : String(err),
      },
      { status: 503 },
    );
  }

  // ── Step 3: Parse + validate request body ───────────────────────────────
  let body: AssessmentRequestBody;
  try {
    const raw = await request.json();
    const parsed = parseRequestBody(raw);
    if (!parsed) {
      return NextResponse.json(
        {
          error:
            "Invalid request body: answers must be an array of { token: string, known: boolean }",
        },
        { status: 400 },
      );
    }
    body = parsed;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── Step 4: Server-authoritative re-validation (contract C5.4) ──────────
  // Re-derive isReal and band from the canonical frequency list.
  // We IGNORE any isReal/band the client may have sent.
  const scorerItems: ScorerInput[] = body.answers.map((answer) => {
    const rank = getLemmaRank(answer.token);
    if (rank === null) {
      // Not in the frequency list → treat as pseudoword (isReal=false)
      return {
        token: answer.token,
        isReal: false,
        band: null,
        known: answer.known,
      };
    }
    // In the frequency list → real word; derive authoritative band
    const band = bandForLemma(answer.token);
    return {
      token: answer.token,
      isReal: true,
      band, // 5-band result (null if somehow missing, though getLemmaRank guarantees it)
      known: answer.known,
    };
  });

  // ── Step 5: Score ────────────────────────────────────────────────────────
  const scored = scoreAssessment(scorerItems);
  const { estimatedBand, estimatedLevel, seedKnownWords } = scored;

  // ── Step 6: Persist — profile first, then known_words (P-W1 ordering) ───
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  // 6a: Profile upsert (P-E1)
  try {
    await upsertVocabProfile(supabase, user.id, {
      estimatedBand,
      estimatedLevel,
      snapshot: { timestamp: now, reason: "assessment" },
    });
  } catch (profileErr) {
    console.error("[VocabAssessment] Profile upsert failed:", profileErr);
    return NextResponse.json(
      {
        error: "Failed to persist vocabulary profile",
        code: "profile_write_failed",
        detail:
          profileErr instanceof Error ? profileErr.message : String(profileErr),
      },
      { status: 500 },
    );
  }

  // 6b: Known-words insert (P-E2) — if this fails, we return a detectable error
  // so the client can retry the whole submission (both upserts are idempotent).
  try {
    await insertSeedKnownWords(supabase, user.id, seedKnownWords);
  } catch (wordsErr) {
    console.error(
      "[VocabAssessment] known_words insert failed (profile already written):",
      wordsErr,
    );
    // P-W1: partial failure — profile written but words not yet; client can retry.
    return NextResponse.json(
      {
        error: "Profile saved but failed to persist known words — please retry",
        code: "profile_written_words_failed",
        detail: wordsErr instanceof Error ? wordsErr.message : String(wordsErr),
      },
      { status: 500 },
    );
  }

  // ── Step 7: Return result ─────────────────────────────────────────────────
  return NextResponse.json({
    estimatedBand,
    estimatedLevel,
    seedCount: seedKnownWords.length,
  });
}
