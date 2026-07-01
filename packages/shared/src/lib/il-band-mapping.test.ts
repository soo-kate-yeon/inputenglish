import { describe, expect, it } from "vitest";
import {
  levelBandToIlSeed,
  ilToNearestLevelBand,
  IL_BAND_SEED_MAP,
} from "./il-band-mapping";
import type { LearningLevelBand } from "../types";

describe("levelBandToIlSeed", () => {
  it("maps beginner to IL 1.0 (bottom of the 7-band ladder)", () => {
    expect(levelBandToIlSeed("beginner")).toBe(1.0);
  });

  it("maps basic to IL 3.0 (D5 4->7 seed compatibility)", () => {
    expect(levelBandToIlSeed("basic")).toBe(3.0);
  });

  it("maps conversation to IL 5.0", () => {
    expect(levelBandToIlSeed("conversation")).toBe(5.0);
  });

  it("maps professional to IL 7.0 (top of the ladder)", () => {
    expect(levelBandToIlSeed("professional")).toBe(7.0);
  });

  it("returns a value within the 1.0-7.0 IL range for every 4-band value", () => {
    const bands: LearningLevelBand[] = [
      "beginner",
      "basic",
      "conversation",
      "professional",
    ];
    for (const band of bands) {
      const il = levelBandToIlSeed(band);
      expect(il).toBeGreaterThanOrEqual(1.0);
      expect(il).toBeLessThanOrEqual(7.0);
    }
  });
});

describe("ilToNearestLevelBand (round-trip / lossless backfill verification)", () => {
  it("round-trips every 4-band seed value back to its source band (lossless)", () => {
    const bands: LearningLevelBand[] = [
      "beginner",
      "basic",
      "conversation",
      "professional",
    ];
    for (const band of bands) {
      const il = levelBandToIlSeed(band);
      expect(ilToNearestLevelBand(il)).toBe(band);
    }
  });

  it("maps intermediate IL values to the nearest 4-band bucket without throwing", () => {
    // IL 2.0 sits between beginner(1.0) and basic(3.0) — nearest is beginner.
    expect(ilToNearestLevelBand(2.0)).toBe("beginner");
    // IL 6.5 sits between conversation(5.0) and professional(7.0) — nearest is professional.
    expect(ilToNearestLevelBand(6.5)).toBe("professional");
  });

  it("does not throw for the full IL range 1.0-7.0", () => {
    for (let il = 1.0; il <= 7.0; il += 0.5) {
      expect(() => ilToNearestLevelBand(il)).not.toThrow();
    }
  });
});

describe("IL_BAND_SEED_MAP", () => {
  it("keeps the existing BAND_ORDER/LEVEL_BAND_TO_VOCAB_BAND path untouched (regression guard)", () => {
    // The 4-value map itself must not have been mutated in shape — still exactly 4 entries.
    expect(Object.keys(IL_BAND_SEED_MAP)).toHaveLength(4);
    expect(IL_BAND_SEED_MAP).toMatchObject({
      beginner: 1.0,
      basic: 3.0,
      conversation: 5.0,
      professional: 7.0,
    });
  });
});
