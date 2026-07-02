// @MX:ANCHOR: [AUTO] Learning home view-model — pure mapping from GET /api/premium/today's
//   HTTP outcome into a discriminated render-state for the /learning page.
// @MX:REASON: [AUTO] This repo's testing convention keeps page.tsx thin/untested and puts
//   logic into a pure, unit-tested module (see OnboardingFlow + post-json.ts). Kept here
//   rather than inline in the page so AC-004-1 (ready session) / AC-005-2 (402 entitlement
//   gate) / EC-005-A (preparing, not a mismatched session) are each independently testable
//   without a React rendering harness (none exists yet in apps/web).
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.2 (REQ-WEB-004, REQ-WEB-005, AC-004-1, AC-005-2, EC-005-A)
import type { PremiumEntitlement } from "@/lib/premium/entitlement";
import type { ReadingPiece, VideoSegment } from "@inputenglish/shared";

interface TodaySessionBody {
  session: {
    id: string;
    date: string;
    readingPiece: ReadingPiece | null;
    segments: VideoSegment[];
    assemblyMeta: Record<string, unknown>;
  };
  remainingQuestionCap: number;
}

interface EntitlementGateBody {
  entitlement: PremiumEntitlement;
  session: null;
}

interface ErrorBody {
  error: string;
}

export interface TodayApiResult {
  status: number;
  body: TodaySessionBody | EntitlementGateBody | ErrorBody;
}

export type LearningHomeViewModel =
  | { kind: "upgrade-required"; entitlement: PremiumEntitlement }
  | { kind: "preparing" }
  | {
      kind: "ready";
      readingPiece: ReadingPiece | null;
      segments: VideoSegment[];
      remainingQuestionCap: number;
    }
  | { kind: "error"; message: string };

function isEntitlementGateBody(
  body: TodayApiResult["body"],
): body is EntitlementGateBody {
  return (
    "entitlement" in body && (body as EntitlementGateBody).session === null
  );
}

function isTodaySessionBody(
  body: TodayApiResult["body"],
): body is TodaySessionBody {
  return "session" in body && body.session !== null;
}

/**
 * Maps the raw HTTP status + JSON body from GET /api/premium/today into a
 * discriminated view-model. Never exposes a "ready" session for a
 * status !== 200/preparing response (EC-005-A guard lives at the API layer —
 * this function simply mirrors the API's own status field faithfully).
 */
export function buildLearningHomeViewModel(
  result: TodayApiResult,
): LearningHomeViewModel {
  if (result.status === 402 && isEntitlementGateBody(result.body)) {
    return { kind: "upgrade-required", entitlement: result.body.entitlement };
  }

  if (result.status === 200 && isTodaySessionBody(result.body)) {
    const { session, remainingQuestionCap } = result.body;
    if (session.assemblyMeta?.status === "preparing") {
      return { kind: "preparing" };
    }
    return {
      kind: "ready",
      readingPiece: session.readingPiece,
      segments: session.segments,
      remainingQuestionCap,
    };
  }

  const message =
    "error" in result.body && typeof result.body.error === "string"
      ? result.body.error
      : `Unexpected response (status ${result.status})`;
  return { kind: "error", message };
}
