"use client";

// @MX:NOTE: [AUTO] Task 3.1 UI — 7 band-anchor cards with iframe-embed sample clips.
//   Respects the existing "iframe embed only, no custom player" ToS principle
//   (INVIOLABLE KEEP — see spec.md REQ-WEB-003-U4). Each card posts the user's
//   "comfortable/overwhelming" choice to /api/premium/onboarding/band-seed.
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002 (E1, U2, AC-002-1)

import { useState } from "react";
import type { BandAnchorFixture } from "@/lib/onboarding/band-anchor-fixtures";
import { postJson } from "@/lib/onboarding/post-json";

interface OnboardingBandSeedProps {
  fixtures: BandAnchorFixture[];
  onSeeded: (ilSeed: number) => void;
}

export function OnboardingBandSeed({
  fixtures,
  onSeeded,
}: OnboardingBandSeedProps) {
  const [submittingIl, setSubmittingIl] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoice(
    fixture: BandAnchorFixture,
    choice: "comfortable" | "overwhelming",
  ) {
    setError(null);
    setSubmittingIl(fixture.il);

    try {
      const data = await postJson<{ ilSeed: number }>(
        "/api/premium/onboarding/band-seed",
        { il: fixture.il, choice },
      );
      onSeeded(data.ilSeed);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmittingIl(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-lg font-semibold">
        아래 클립을 보고 편한지 버거운지 골라주세요
      </h2>

      {error ? <p className="text-sm text-red-500">{error}</p> : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fixtures.map((fixture) => (
          <div
            key={fixture.il}
            className="flex flex-col gap-2 rounded-lg border border-gray-200 p-3"
          >
            <p className="text-sm font-medium">
              IL {fixture.il} · {fixture.label}
            </p>
            <p className="text-xs text-gray-500">{fixture.description}</p>

            {/* iframe embed only — no custom player (ToS, REQ-WEB-003-U4) */}
            <div className="aspect-video w-full overflow-hidden rounded-md">
              <iframe
                className="h-full w-full"
                src={`https://www.youtube.com/embed/${fixture.youtubeVideoId}`}
                title={fixture.label}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                disabled={submittingIl === fixture.il}
                onClick={() => handleChoice(fixture, "comfortable")}
                className="flex-1 rounded-md bg-green-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                편하다
              </button>
              <button
                type="button"
                disabled={submittingIl === fixture.il}
                onClick={() => handleChoice(fixture, "overwhelming")}
                className="flex-1 rounded-md bg-gray-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                버겁다
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
