"use client";

// @MX:ANCHOR: [AUTO] LadderScreen — Task 5.3 flexible content ladder UI (REQ-WEB-004-U1/U2).
// @MX:REASON: [AUTO] Renders the 3(+0.5) step ladder: 0 preview (script_clean reading) ->
//   [0.5 pre-read, optional] -> 1 RWL (YouTube iframe + synced transcript + tap-gloss) ->
//   2 no-captions. The YouTube iframe (existing web YouTubePlayer, D1/EC-003-B — iframe-embed
//   only, never a custom player) is rendered as-is; tap-gloss/highlight-question UI is
//   layered BESIDE it (a sibling panel), never wrapping the iframe itself. The RWL -> no
//   captions transition is system-driven via shouldTransitionToNoCaptions
//   (ladder-transition.ts) — a manual "무자막으로 보기" toggle remains as a secondary/
//   override control (D8), never the sole trigger.
// @MX:SPEC: SPEC-WEB-001 Phase 5 Task 5.3/5.4 (REQ-WEB-004-U1/U2/E1/E2, AC-004-1/2, EC-004-A)

import { useEffect, useMemo, useState } from "react";
import type { ReadingPiece, VideoSegment } from "@inputenglish/shared";
import { makeInitialVoteState } from "@inputenglish/shared";
import YouTubePlayer from "@/components/YouTubePlayer";
import { buildLadderSteps, type LadderStep } from "@/lib/premium/ladder-steps";
import {
  shouldOfferPrereadStep,
  shouldTransitionToNoCaptions,
} from "@/lib/premium/ladder-transition";
import {
  findActiveTranscriptLine,
  getTranscriptScrollIndex,
} from "@/lib/premium/transcript-sync";
import { HighlightQuestionPanel } from "./HighlightQuestionPanel";

interface LadderScreenProps {
  readingPiece: ReadingPiece | null;
  segments: VideoSegment[];
  remainingQuestionCap: number;
}

export function LadderScreen({
  readingPiece,
  segments,
  remainingQuestionCap,
}: LadderScreenProps) {
  const activeSegment = segments[0] ?? null;

  // EC-004-A: only offer the 0.5 pre-read step when content is near the
  // user's IL ceiling with a high tap rate. Tap-rate tracking is a running
  // session signal (fed by /api/premium/il-signal elsewhere); this screen
  // starts conservatively at 0 (no data yet) so the step is not force-shown.
  // userIl is not yet threaded through the session view model — pass
  // `undefined` (not a fabricated stand-in) so shouldOfferPrereadStep fails
  // closed instead of vacuously comparing activeSegment.il against itself.
  const [tapRate] = useState(0);
  const offerPreread = activeSegment
    ? shouldOfferPrereadStep({
        userIl: undefined,
        contentIl: activeSegment.il ?? 4,
        tapRate,
      })
    : false;

  const steps = useMemo(
    () => buildLadderSteps({ offerPreread }),
    [offerPreread],
  );

  const [stepIndex, setStepIndex] = useState(0);
  const currentStep: LadderStep = steps[stepIndex] ?? 0;

  const [manualCaptionOverride, setManualCaptionOverride] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  // Hysteresis vote state for the system-driven caption transition (persisted
  // across renders so K-consecutive-vote counting works as tapRate updates).
  // Recomputed in an effect (not during render) since countHysteresisVote
  // returns a fresh object every call — comparing it during render would
  // never be reference-stable and would re-trigger on every render.
  const [transitionVoteState, setTransitionVoteState] = useState(
    makeInitialVoteState(),
  );
  const [systemTransition, setSystemTransition] = useState(false);

  useEffect(() => {
    const result = shouldTransitionToNoCaptions({
      tapRate,
      voteState: transitionVoteState,
      manualOverride: manualCaptionOverride,
    });
    setSystemTransition(result.shouldTransition);
    setTransitionVoteState(result.newVoteState);
    // Only re-evaluate when the actual inputs change, not on every vote-state update.
  }, [tapRate, manualCaptionOverride]);

  const captionsOn = currentStep === 1 && !systemTransition;

  const activeLine = activeSegment
    ? findActiveTranscriptLine(activeSegment.transcript, playbackTime)
    : null;
  const scrollIndex = activeSegment
    ? getTranscriptScrollIndex(activeSegment.transcript, activeLine)
    : 0;

  function goToNextStep() {
    setStepIndex((i) => Math.min(i + 1, steps.length - 1));
  }

  return (
    <div className="flex flex-col gap-6">
      <nav className="flex gap-2 text-xs text-gray-500">
        {steps.map((step) => (
          <span
            key={step}
            className={step === currentStep ? "font-semibold text-black" : ""}
          >
            {step === 0
              ? "예습"
              : step === 0.5
                ? "스크립트 선행읽기"
                : step === 1
                  ? "RWL"
                  : "무자막"}
          </span>
        ))}
      </nav>

      {currentStep === 0 || currentStep === 0.5 ? (
        <section className="flex flex-col gap-3">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">
            {readingPiece?.body ?? activeSegment?.scriptClean ?? ""}
          </p>
          <button
            type="button"
            onClick={goToNextStep}
            className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            다음 단계로
          </button>
        </section>
      ) : null}

      {(currentStep === 1 || currentStep === 2) && activeSegment ? (
        <section className="flex flex-col gap-4 md:flex-row">
          {/* iframe-embed-only (D1/EC-003-B) — never wrapped by a custom player */}
          <div className="md:w-2/3">
            <YouTubePlayer
              videoId={activeSegment.parentVideoId}
              onTimeUpdate={setPlaybackTime}
            />
          </div>

          {/* Tap-gloss / highlight-question layer — sibling panel, not wrapping the iframe */}
          <div className="flex flex-col gap-3 md:w-1/3">
            {captionsOn ? (
              <p className="rounded-md bg-gray-50 p-3 text-sm">
                {activeLine?.text ?? "…"}
              </p>
            ) : (
              <p className="text-xs text-gray-400">무자막 모드</p>
            )}

            <button
              type="button"
              onClick={() => setManualCaptionOverride((v) => !v)}
              className="w-fit text-xs text-gray-500 underline"
            >
              {captionsOn ? "무자막으로 보기" : "자막 다시 보기"}
            </button>

            <HighlightQuestionPanel
              sourceType="segment"
              sourceRef={{ type: "segment", pieceId: activeSegment.id }}
              remainingQuestionCap={remainingQuestionCap}
            />

            {currentStep === 1 ? (
              <button
                type="button"
                onClick={goToNextStep}
                className="w-fit rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
              >
                다음 단계로
              </button>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
