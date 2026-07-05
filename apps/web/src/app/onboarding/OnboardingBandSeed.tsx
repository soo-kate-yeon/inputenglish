"use client";

// @MX:NOTE: [AUTO] Task 3.1 UI — 7 band-anchor cards with iframe-embed sample clips.
//   Respects the existing "iframe embed only, no custom player" ToS principle
//   (INVIOLABLE KEEP — see spec.md REQ-WEB-003-U4). Each card posts the user's
//   "comfortable/overwhelming" choice to /api/premium/onboarding/band-seed.
// @MX:SPEC: SPEC-WEB-001 Phase 3 REQ-WEB-002 (E1, U2, AC-002-1)

import { useState } from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Heading,
  Text,
} from "@framingui/ui";
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
      <Heading level={2} className="text-lg">
        아래 클립을 보고 편한지 버거운지 골라주세요
      </Heading>

      {error ? (
        <Text variant="body" className="text-red-600 dark:text-red-400">
          {error}
        </Text>
      ) : null}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {fixtures.map((fixture) => (
          <Card key={fixture.il} className="flex flex-col gap-3 p-3">
            <CardHeader className="flex flex-row items-center gap-2 p-0">
              <Badge variant="secondary">IL {fixture.il}</Badge>
              <Text variant="label">{fixture.label}</Text>
            </CardHeader>

            <CardContent className="flex flex-col gap-3 p-0">
              <Text variant="caption" className="text-neutral-500">
                {fixture.description}
              </Text>

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

              <div className="flex flex-col gap-2 sm:flex-row">
                <Button
                  type="button"
                  variant="default"
                  className="flex-1"
                  disabled={submittingIl === fixture.il}
                  onClick={() => handleChoice(fixture, "comfortable")}
                >
                  편하다
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  disabled={submittingIl === fixture.il}
                  onClick={() => handleChoice(fixture, "overwhelming")}
                >
                  버겁다
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
