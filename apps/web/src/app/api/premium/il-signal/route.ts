// @MX:ANCHOR: [AUTO] POST /api/premium/il-signal — Task 3.4 runtime IL micro-adjustment.
// @MX:REASON: [AUTO] New route adjacent to (NOT modifying) vocab-signal/route.ts, per
//   SPEC constraint — vocab-signal/route.ts is SPEC-INPUT-003 KEEP-adjacent and already
//   tested. This route accepts a tap-rate signal and delegates to
//   adjustIlFromTapRate() (il-tap-adjustment.ts), which reuses the existing
//   vote-counting/hysteresis primitives from vocab-band-hysteresis.ts. On a nudge, the
//   new il_index is persisted directly (single mutation point, mirrors the direct
//   `users` update pattern used by il-onboarding-repository.ts's writers).
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002-W1 (AC-002-3)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import { adjustIlFromTapRate } from "@/lib/premium/il-tap-adjustment";

const voteStateSchema = z.object({
  direction: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  count: z.number().int().min(0),
});

const ilSignalRequestSchema = z.object({
  /** The user's current il_index. */
  currentIl: z.number().min(1).max(7),
  /** Measured unknown-word tap rate for the session (0-1 fraction). */
  tapRate: z.number().min(0).max(1),
  /** Running vote state (from the previous call, or {direction:0, count:0} initially). */
  voteState: voteStateSchema,
});

/**
 * POST /api/premium/il-signal
 *
 * Request body:
 *   { currentIl: number (1-7), tapRate: number (0-1), voteState: { direction, count } }
 *
 * Response (200):
 *   { newIl: number, newVoteState: VoteState, nudged: boolean, directionVote: -1|0|1 }
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

  const parseResult = ilSignalRequestSchema.safeParse(bodyRaw);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error:
          "Invalid request body. Required: currentIl (1-7), tapRate (0-1), voteState.",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { currentIl, tapRate, voteState } = parseResult.data;

  // ── Step 3: Compute nudge via the shared hysteresis-backed adapter ────────
  const result = adjustIlFromTapRate({ currentIl, tapRate, voteState });

  // ── Step 4: Persist only when nudged ──────────────────────────────────────
  if (result.nudged) {
    const client = createAdminClient();
    const { error } = await client
      .from("users")
      .update({ il_index: result.newIl })
      .eq("id", user.id);

    if (error) {
      return NextResponse.json(
        {
          error: "Failed to persist il_index nudge",
          detail: (error as { message?: string }).message ?? String(error),
        },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(result, { status: 200 });
}
