/**
 * SPEC-WEB-001 Phase 5 — Task 5.3: ladder step sequencing (REQ-WEB-004-U1, D8).
 * Pure step-list builder consumed by LadderScreen. Confirms EC-004-A's optional
 * 0.5 pre-read step is inserted only when warranted (never forced daily) and
 * that the base ladder is always 0 (preview/script) -> 1 (RWL) -> 2 (no captions).
 */
import { describe, expect, it } from "vitest";
import { buildLadderSteps } from "../ladder-steps";

describe("buildLadderSteps", () => {
  it("returns the base 3-step ladder [0, 1, 2] when the pre-read step is not warranted", () => {
    const steps = buildLadderSteps({ offerPreread: false });
    expect(steps).toEqual([0, 1, 2]);
  });

  it("inserts the optional 0.5 step before RWL when offerPreread is true (EC-004-A)", () => {
    const steps = buildLadderSteps({ offerPreread: true });
    expect(steps).toEqual([0, 0.5, 1, 2]);
  });
});
