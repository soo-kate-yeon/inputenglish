// @MX:NOTE: Free-tier usage quotas (MMKV-backed).
//   - Transformation practice: a lifetime trial allowance for FREE users.
//   - Shorts: a per-day distinct-view quota for the recommended feed.
//   Pure functions so they are unit-testable; `now` is injectable for
//   deterministic date-rollover tests.
import storage from "@/lib/mmkv";

export const TRANSFORMATION_FREE_LIMIT = 3;
export const SHORTS_FREE_DAILY_LIMIT = 3;

const TRANSFORMATION_TRIALS_KEY = "free_transformation_trials";
const SHORTS_DAY_KEY = "free_shorts_day";
const SHORTS_IDS_KEY = "free_shorts_ids";

// ---- Transformation practice: lifetime trials ----

export function getTransformationTrialsUsed(): number {
  return storage.getNumber(TRANSFORMATION_TRIALS_KEY) ?? 0;
}

export function getTransformationTrialsLeft(): number {
  return Math.max(0, TRANSFORMATION_FREE_LIMIT - getTransformationTrialsUsed());
}

/**
 * Consume one free transformation trial. Returns true if a trial was available
 * (and increments the lifetime counter); false once the allowance is exhausted.
 */
export function consumeTransformationTrial(): boolean {
  const used = getTransformationTrialsUsed();
  if (used >= TRANSFORMATION_FREE_LIMIT) return false;
  storage.set(TRANSFORMATION_TRIALS_KEY, used + 1);
  return true;
}

// ---- Shorts: per-day distinct-view quota (recommended feed) ----

function localDayString(now: Date): string {
  const year = now.getFullYear();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Today's viewed short ids, lazily resetting the store when the day rolls over.
 */
function loadTodayShortIds(now: Date): string[] {
  const today = localDayString(now);
  if (storage.getString(SHORTS_DAY_KEY) !== today) {
    storage.set(SHORTS_DAY_KEY, today);
    storage.set(SHORTS_IDS_KEY, "[]");
    return [];
  }
  try {
    const parsed = JSON.parse(storage.getString(SHORTS_IDS_KEY) ?? "[]");
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

export function getShortsViewedCount(now: Date = new Date()): number {
  return loadTodayShortIds(now).length;
}

/**
 * Whether the given short may be viewed for free right now: true if it was
 * already counted today (a re-watch) or the daily quota is not yet reached.
 */
export function canViewShort(shortId: string, now: Date = new Date()): boolean {
  const ids = loadTodayShortIds(now);
  return ids.includes(shortId) || ids.length < SHORTS_FREE_DAILY_LIMIT;
}

/**
 * Record a free short view for today, deduped by id. No-op once the quota is
 * reached for a not-yet-seen short. Returns the resulting distinct-view count.
 */
export function recordShortView(
  shortId: string,
  now: Date = new Date(),
): number {
  const ids = loadTodayShortIds(now);
  if (ids.includes(shortId)) return ids.length;
  if (ids.length >= SHORTS_FREE_DAILY_LIMIT) return ids.length;
  ids.push(shortId);
  storage.set(SHORTS_IDS_KEY, JSON.stringify(ids));
  return ids.length;
}
