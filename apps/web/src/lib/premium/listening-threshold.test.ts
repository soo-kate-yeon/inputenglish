import { describe, expect, it } from "vitest";
import {
  LISTENING_MAX_UNKNOWN_RATIO,
  evaluateListeningGate,
} from "./listening-threshold";
import { POOL_MAX_UNKNOWN_RATIO } from "./reading-batch";

describe("LISTENING_MAX_UNKNOWN_RATIO (AC-003-3)", () => {
  it("is stricter (smaller) than reading's POOL_MAX_UNKNOWN_RATIO", () => {
    expect(LISTENING_MAX_UNKNOWN_RATIO).toBeLessThan(POOL_MAX_UNKNOWN_RATIO);
  });

  it("targets the ~98-99% coverage bar (unknown ratio <= 0.02)", () => {
    expect(LISTENING_MAX_UNKNOWN_RATIO).toBeLessThanOrEqual(0.02);
  });
});

describe("evaluateListeningGate (REQ-WEB-003-E1, AC-003-3)", () => {
  it("passes reading's bar (96% coverage / 4% unknown) but fails listening's stricter bar", () => {
    // AC-003-3: "세그먼트 어휘 커버리지가 96%(리딩 기준 통과)이다... 리스닝 임계 미달"
    const bandCoverage = { professional: 0.96 } as Record<string, number>;
    const result = evaluateListeningGate({
      bandCoverage,
      band: "professional",
    });

    // Reading would accept 96% coverage (unknown ratio 0.04 <= POOL_MAX_UNKNOWN_RATIO 0.2)
    expect(1 - bandCoverage.professional).toBeLessThanOrEqual(
      POOL_MAX_UNKNOWN_RATIO,
    );
    // Listening rejects it (unknown ratio 0.04 > LISTENING_MAX_UNKNOWN_RATIO 0.02)
    expect(result.passes).toBe(false);
  });

  it("passes when coverage meets the stricter listening bar (99% coverage)", () => {
    const bandCoverage = { professional: 0.99 } as Record<string, number>;
    const result = evaluateListeningGate({
      bandCoverage,
      band: "professional",
    });

    expect(result.passes).toBe(true);
  });

  it("reuses the shared band-coverage primitive rather than recomputing from scratch", () => {
    const bandCoverage = { conversation: 1 } as Record<string, number>;
    const result = evaluateListeningGate({
      bandCoverage,
      band: "conversation",
    });

    expect(result.unknownRatio).toBe(0);
    expect(result.passes).toBe(true);
  });

  it("treats a missing band-coverage key as 0 coverage (fails gate)", () => {
    const bandCoverage = {} as Record<string, number>;
    const result = evaluateListeningGate({
      bandCoverage,
      band: "beginner",
    });

    expect(result.unknownRatio).toBe(1);
    expect(result.passes).toBe(false);
  });
});
