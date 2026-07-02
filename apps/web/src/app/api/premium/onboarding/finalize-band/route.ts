// @MX:ANCHOR: [AUTO] POST /api/premium/onboarding/finalize-band — Task 3.2 cross-validation
//   + FINAL users.il_index write.
// @MX:REASON: [AUTO] Single mutation boundary for the durable il_index write during
//   onboarding. Converts the vocab-assessment diagnostic's estimatedBand (4-band
//   VocabBand, confirmed by reading vocab-assessment-scorer.ts's bandForSize()/
//   scoreAssessment() output contract — NEVER "advanced", always one of
//   beginner/basic/conversation/professional) into an IL-comparable value via the
//   existing Phase 0 band bridge (levelBandToIlSeed), then applies "lower wins"
//   (EC-002-B): the system NEVER starts a user higher than the diagnostic estimate
//   when self-report and diagnostic disagree. Delegates the write to
//   finalizeIlIndex() (il-onboarding-repository.ts), the single writer for il_index.
//
// @MX:NOTE: [AUTO] Why levelBandToIlSeed is a clean fit here (not a new conversion):
//   VocabBand ("beginner"|"basic"|"conversation"|"professional") is a strict subset
//   of LearningLevelBand, and levelBandToIlSeed maps each to a distinct IL anchor
//   (1.0/3.0/5.0/7.0) on the SAME 7-band scale this route persists to. No separate
//   comparable-scale conversion is needed — the Phase 0 bridge already produces an
//   IL float; we only need to widen its parameter type at the call site.
//
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002 (E2, U3, AC-002-2, EC-002-B)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import { levelBandToIlSeed } from "@inputenglish/shared";
import { finalizeIlIndex } from "@/lib/premium/il-onboarding-repository";

const VOCAB_BANDS = [
  "beginner",
  "basic",
  "conversation",
  "professional",
] as const;

const finalizeBandRequestSchema = z.object({
  /** The Task 3.1 self-report IL seed (1-7). */
  selfReportIl: z.number().min(1).max(7),
  /** The vocab-assessment diagnostic's estimatedBand (4-band, never "advanced"). */
  estimatedBand: z.enum(VOCAB_BANDS),
  /** Optional vocab estimate (word count) from the diagnostic, persisted alongside il_index. */
  vocabEstimate: z.number().optional(),
});

/**
 * POST /api/premium/onboarding/finalize-band
 *
 * Request body:
 *   { selfReportIl: number (1-7), estimatedBand: VocabBand, vocabEstimate?: number }
 *
 * Response (200):
 *   { finalIl: number }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — invalid request body
 *   500 — persistence failure
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  // ── Step 1: Auth ─────────────────────────────────────────────────────────
  const userOrResponse = await requireApiUser(request);
  if (userOrResponse instanceof NextResponse) {
    return userOrResponse; // 401
  }
  const user = userOrResponse;

  // ── Step 2: Parse + validate body ────────────────────────────────────────
  let bodyRaw: unknown;
  try {
    bodyRaw = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parseResult = finalizeBandRequestSchema.safeParse(bodyRaw);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error:
          "Invalid request body. Required: selfReportIl (1-7), estimatedBand (VocabBand).",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { selfReportIl, estimatedBand, vocabEstimate } = parseResult.data;

  // ── Step 3: Convert diagnostic band -> IL-comparable value (Phase 0 bridge) ──
  const diagnosticIl = levelBandToIlSeed(estimatedBand);

  // ── Step 4: Cross-validate + persist FINAL il_index ("lower wins", EC-002-B) ─
  const client = createAdminClient();
  try {
    const { finalIl } = await finalizeIlIndex(client, user.id, {
      selfReportIl,
      diagnosticIl,
      vocabEstimate,
    });

    return NextResponse.json({ finalIl }, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to finalize IL index", detail: message },
      { status: 500 },
    );
  }
}
