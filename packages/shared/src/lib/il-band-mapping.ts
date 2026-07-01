import type { LearningLevelBand } from "../types";

/**
 * SPEC-WEB-001 Phase 0 (Task 0.3, REQ-WEB-002-U1, D5) — lossless, round-trippable
 * seed mapping from the existing 4-value level_band (beginner/basic/conversation/
 * professional) to an IL 7-band float seed (1.0-7.0).
 *
 * This mapping is purely additive: it seeds the new `users.il_index` column
 * during backfill and does NOT alter the existing BAND_ORDER / VocabBand path
 * consumed by `apps/web/src/app/api/premium/today/route.ts`. The 4-band CHECK
 * constraints on `channels` / `video_segments` remain untouched.
 *
 * Seed values are evenly spaced across the 1.0-7.0 ladder so that each legacy
 * band maps to a distinct, round-trippable IL anchor (EC-002-C).
 */
export const IL_BAND_SEED_MAP: Record<LearningLevelBand, number> = {
  beginner: 1.0,
  basic: 3.0,
  conversation: 5.0,
  professional: 7.0,
};

/** Ordered IL anchors (ascending) paired with their source band, for nearest-match lookups. */
const IL_SEED_ORDER: Array<{ band: LearningLevelBand; il: number }> = (
  Object.keys(IL_BAND_SEED_MAP) as LearningLevelBand[]
)
  .map((band) => ({ band, il: IL_BAND_SEED_MAP[band] }))
  .sort((a, b) => a.il - b.il);

/**
 * Maps an existing 4-value level_band to its IL 7-band float seed.
 * Lossless: every band maps to a unique IL anchor, so ilToNearestLevelBand()
 * round-trips it back to the same band (EC-002-C).
 */
export function levelBandToIlSeed(band: LearningLevelBand): number {
  return IL_BAND_SEED_MAP[band];
}

/**
 * Maps an arbitrary IL float value (1.0-7.0) back to the nearest legacy 4-value
 * level_band. Used for regression verification (the existing 4-band assembly
 * path in today/route.ts must keep working unmodified) and for any code that
 * still needs a 4-band view of an IL-seeded profile.
 */
export function ilToNearestLevelBand(il: number): LearningLevelBand {
  let nearest = IL_SEED_ORDER[0];
  let smallestDiff = Math.abs(il - nearest.il);

  for (const entry of IL_SEED_ORDER) {
    const diff = Math.abs(il - entry.il);
    if (diff < smallestDiff) {
      smallestDiff = diff;
      nearest = entry;
    }
  }

  return nearest.band;
}
