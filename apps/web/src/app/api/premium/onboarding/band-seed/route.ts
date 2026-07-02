// @MX:ANCHOR: [AUTO] POST /api/premium/onboarding/band-seed — Task 3.1 sample-clip self-report.
// @MX:REASON: [AUTO] Single entry point for the onboarding band-seed step (REQ-WEB-002-E1).
//   Records the user's "comfortable/overwhelming" self-report as an IL seed onto
//   users.il_index (intermediate write — Task 3.2's finalize-band route later
//   cross-validates and overwrites this with the FINAL value per EC-002-B). This route
//   never persists a value the DB CHECK constraint would reject (clampIlIndex enforced
//   inside writeIlSeed).
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002 (E1, AC-002-1, EC-002-A)

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import { writeIlSeed } from "@/lib/premium/il-onboarding-repository";

const bandSeedRequestSchema = z.object({
  /** The IL band card the user was shown (1-7, integer anchor). */
  il: z.number().int().min(1).max(7),
  /** The user's self-report choice on the sample clip. */
  choice: z.enum(["comfortable", "overwhelming"]),
});

/**
 * POST /api/premium/onboarding/band-seed
 *
 * Request body:
 *   { il: number (1-7), choice: "comfortable" | "overwhelming" }
 *
 * Response (200):
 *   { ilSeed: number }
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

  const parseResult = bandSeedRequestSchema.safeParse(bodyRaw);
  if (!parseResult.success) {
    return NextResponse.json(
      {
        error:
          'Invalid request body. Required: il (1-7 integer), choice ("comfortable"|"overwhelming").',
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }
  const { il, choice } = parseResult.data;

  // ── Step 3: Compute IL seed from self-report (AC-002-1 / EC-002-A) ───────
  // "Comfortable" on card IL n -> seed = n.0.
  // "Overwhelming" on card IL n -> seed = one band lower (floor at 1.0).
  const ilSeed = choice === "comfortable" ? il : Math.max(1, il - 1);

  // ── Step 4: Persist (intermediate write; finalize-band overwrites later) ─
  const client = createAdminClient();
  try {
    await writeIlSeed(client, user.id, ilSeed);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Failed to persist IL seed", detail: message },
      { status: 500 },
    );
  }

  return NextResponse.json({ ilSeed }, { status: 200 });
}
