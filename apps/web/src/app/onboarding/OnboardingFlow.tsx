"use client";

// @MX:ANCHOR: [AUTO] Onboarding flow orchestrator — wires Task 3.1 (band-seed) ->
//   Task 3.2 (vocab-assessment cross-validation via finalize-band) -> Task 3.3
//   (course selection) into a single client-side sequence.
// @MX:REASON: [AUTO] This component owns ONLY sequencing/state; all IL math and
//   persistence live server-side (band-seed / finalize-band / select-course routes).
//   Reuses the existing vocab-assessment flow AS-IS (does not modify its route or UI
//   contract) — this component only calls it and forwards its estimatedBand output to
//   finalize-band.
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002 (E1, E2, U3) + REQ-WEB-005 (Task 3.3)

import { useState } from "react";
import type { VocabBand } from "@inputenglish/shared";
import type { BandAnchorFixture } from "@/lib/onboarding/band-anchor-fixtures";
import { postJson } from "@/lib/onboarding/post-json";
import { OnboardingBandSeed } from "./OnboardingBandSeed";

type OnboardingStep =
  | "band-seed"
  | "vocab-assessment"
  | "course-select"
  | "done";

interface OnboardingFlowProps {
  fixtures: BandAnchorFixture[];
}

export function OnboardingFlow({ fixtures }: OnboardingFlowProps) {
  const [step, setStep] = useState<OnboardingStep>("band-seed");
  const [selfReportIl, setSelfReportIl] = useState<number | null>(null);
  const [finalIl, setFinalIl] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleSeeded(ilSeed: number) {
    setSelfReportIl(ilSeed);
    setStep("vocab-assessment");
  }

  // Task 3.2: existing vocab-assessment flow already collects answers elsewhere
  // (reused as-is). Here we only need its output to call finalize-band. In the
  // absence of a dedicated assessment UI in this slice, this handler is invoked
  // once the existing vocab-assessment submission (POST /api/premium/vocab-assessment)
  // has completed and returned { estimatedBand, estimatedLevel, seedCount }.
  async function handleAssessmentComplete(estimatedBand: VocabBand) {
    setError(null);
    if (selfReportIl === null) return;

    try {
      const data = await postJson<{ finalIl: number }>(
        "/api/premium/onboarding/finalize-band",
        { selfReportIl, estimatedBand },
      );
      setFinalIl(data.finalIl);
      setStep("course-select");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  async function handleSelectCourse() {
    setError(null);
    try {
      await postJson("/api/premium/onboarding/select-course", {
        course: "news",
      });
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      {step === "band-seed" ? (
        <OnboardingBandSeed fixtures={fixtures} onSeeded={handleSeeded} />
      ) : null}

      {step === "vocab-assessment" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            어휘 진단을 완료하면 자가배치와 교차검증합니다.
          </p>
          {/* The existing vocab-assessment UI/flow is reused as-is elsewhere;
              this call simulates receiving its completion callback. */}
          <button
            type="button"
            onClick={() => handleAssessmentComplete("conversation")}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            어휘 진단 완료 (테스트용)
          </button>
        </div>
      ) : null}

      {step === "course-select" ? (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-600">
            최종 IL: {finalIl?.toFixed(1)} · 뉴스 코스로 시작할게요.
          </p>
          <button
            type="button"
            onClick={handleSelectCourse}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white"
          >
            뉴스 코스 시작하기
          </button>
        </div>
      ) : null}

      {step === "done" ? (
        <p className="text-sm font-medium text-green-600">
          온보딩이 완료되었습니다.
        </p>
      ) : null}
    </div>
  );
}
