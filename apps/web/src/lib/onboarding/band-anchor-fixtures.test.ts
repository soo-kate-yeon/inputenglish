/**
 * TDD tests for band-anchor-fixtures (Task 3.1, SPEC-WEB-001 Phase 3, REQ-WEB-002-E1).
 *
 * RED -> GREEN -> REFACTOR
 *
 * These fixtures are a Phase 3 PLACEHOLDER onboarding anchor set (7 IL bands),
 * to be replaced by the real Phase 4 whitelist data later.
 */
import { describe, expect, it } from "vitest";
import { BAND_ANCHOR_FIXTURES } from "./band-anchor-fixtures";

describe("BAND_ANCHOR_FIXTURES", () => {
  it("defines exactly 7 IL bands (1-7)", () => {
    expect(BAND_ANCHOR_FIXTURES).toHaveLength(7);
    const ilValues = BAND_ANCHOR_FIXTURES.map((f) => f.il).sort(
      (a, b) => a - b,
    );
    expect(ilValues).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it("every fixture has a non-empty youtubeVideoId and label", () => {
    for (const fixture of BAND_ANCHOR_FIXTURES) {
      expect(typeof fixture.youtubeVideoId).toBe("string");
      expect(fixture.youtubeVideoId.length).toBeGreaterThan(0);
      expect(typeof fixture.label).toBe("string");
      expect(fixture.label.length).toBeGreaterThan(0);
    }
  });

  it("is ordered ascending by il (1 easiest -> 7 hardest)", () => {
    for (let i = 1; i < BAND_ANCHOR_FIXTURES.length; i++) {
      expect(BAND_ANCHOR_FIXTURES[i].il).toBeGreaterThan(
        BAND_ANCHOR_FIXTURES[i - 1].il,
      );
    }
  });

  it("il values stay within the [1.0, 7.0] invariant range", () => {
    for (const fixture of BAND_ANCHOR_FIXTURES) {
      expect(fixture.il).toBeGreaterThanOrEqual(1);
      expect(fixture.il).toBeLessThanOrEqual(7);
    }
  });
});
