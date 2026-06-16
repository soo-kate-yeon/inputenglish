// @MX:ANCHOR: [AUTO] POST /api/premium/vocab-signal — Refine loop signal entry point.
// @MX:REASON: [AUTO] Single external boundary for runtime coverage signals. Authenticates the
//   user, validates the payload, delegates to processVocabSignal(), and returns the updated
//   band state. On flip, the profile is persisted inside processVocabSignal() via upsertVocabProfile.
//   This route does NOT modify today/route.ts (I-U1 KEEP). (REQ-VOCAB-R-E1 / R-W1 / R-E2)
//
// @MX:NOTE: [AUTO] VoteState is a client-side carry: the caller (mobile/web client) must persist
//   the returned newVoteState and pass it back on the next call. For maximum safety, the server
//   embeds voteState in update_history on each flip so it can be recovered from the DB on app restart.
//   On non-flip calls, only the in-memory / client-side voteState is updated.
//
// @MX:SPEC: SPEC-INPUT-003 REQ-VOCAB-R (R-E1, R-W1, R-E2)

import { NextRequest, NextResponse } from "next/server";
import { requireApiUser } from "@/utils/supabase/api-auth";
import { createAdminClient } from "@/utils/supabase/server";
import type { VocabBand } from "@inputenglish/shared";
import type { VoteState } from "@inputenglish/shared";
import { processVocabSignal } from "@/lib/premium/vocab-refine";

// ── Valid 4-band values (mirrors VocabBand) ───────────────────────────────────

const VALID_BANDS: ReadonlySet<string> = new Set([
  "beginner",
  "basic",
  "conversation",
  "professional",
]);

// ── Request schema ─────────────────────────────────────────────────────────────

interface SignalRequestBody {
  /** Session content text for coverage analysis. */
  text: string;
  /** User's current estimated band. */
  currentBand: VocabBand;
  /** Running vote state (from previous call or initial {direction:0, count:0}). */
  voteState: VoteState;
}

function parseRequestBody(raw: unknown): SignalRequestBody | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const body = raw as Record<string, unknown>;

  if (typeof body.text !== "string" || body.text.trim() === "") return null;

  if (
    typeof body.currentBand !== "string" ||
    !VALID_BANDS.has(body.currentBand)
  ) {
    return null;
  }

  // Default voteState to initial if not provided
  const voteState: VoteState =
    body.voteState &&
    typeof body.voteState === "object" &&
    !Array.isArray(body.voteState)
      ? {
          direction:
            ((body.voteState as Record<string, unknown>).direction as
              | -1
              | 0
              | 1) ?? 0,
          count: Number((body.voteState as Record<string, unknown>).count ?? 0),
        }
      : { direction: 0, count: 0 };

  return {
    text: body.text,
    currentBand: body.currentBand as VocabBand,
    voteState,
  };
}

// ── POST handler ───────────────────────────────────────────────────────────────

/**
 * POST /api/premium/vocab-signal
 *
 * Accepts a session coverage signal and applies hysteresis to the user's band.
 *
 * Request body:
 *   { text: string, currentBand: VocabBand, voteState?: VoteState }
 *
 * Response (200):
 *   { flipped: boolean, newBand: VocabBand, newVoteState: VoteState, directionVote: -1|0|1 }
 *
 * Error responses:
 *   401 — not authenticated
 *   400 — invalid request body
 *   500 — processing error
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
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = parseRequestBody(bodyRaw);
  if (!parsed) {
    return NextResponse.json(
      {
        error:
          "Invalid request body. Required: text (string), currentBand (VocabBand).",
      },
      { status: 400 },
    );
  }

  // ── Step 3: Delegate to processVocabSignal ────────────────────────────────
  const client = createAdminClient();

  try {
    const result = await processVocabSignal(client, user.id, {
      text: parsed.text,
      knownLemmas: undefined, // client does not supply known_words set — cold-start fallback applies
      currentBand: parsed.currentBand,
      voteState: parsed.voteState,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: "Signal processing failed", detail: message },
      { status: 500 },
    );
  }
}
