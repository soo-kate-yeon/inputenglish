// Tests for free-tier usage quotas (transformation lifetime trials + shorts
// per-day distinct-view quota). MMKV is mocked with an in-memory store.

const mockStore = new Map<string, string | number>();

jest.mock("@/lib/mmkv", () => ({
  __esModule: true,
  default: {
    getString: (k: string) => {
      const v = mockStore.get(k);
      return typeof v === "string" ? v : undefined;
    },
    getNumber: (k: string) => {
      const v = mockStore.get(k);
      return typeof v === "number" ? v : undefined;
    },
    set: (k: string, v: string | number) => {
      mockStore.set(k, v);
    },
    delete: (k: string) => {
      mockStore.delete(k);
    },
  },
}));

import {
  TRANSFORMATION_FREE_LIMIT,
  SHORTS_FREE_DAILY_LIMIT,
  consumeTransformationTrial,
  getTransformationTrialsLeft,
  canViewShort,
  recordShortView,
  getShortsViewedCount,
} from "@/lib/free-usage";

beforeEach(() => {
  mockStore.clear();
});

describe("transformation free trials (lifetime)", () => {
  it("allows exactly TRANSFORMATION_FREE_LIMIT trials, then blocks forever", () => {
    expect(getTransformationTrialsLeft()).toBe(TRANSFORMATION_FREE_LIMIT);

    for (let i = 0; i < TRANSFORMATION_FREE_LIMIT; i++) {
      expect(consumeTransformationTrial()).toBe(true);
    }

    expect(getTransformationTrialsLeft()).toBe(0);
    expect(consumeTransformationTrial()).toBe(false);
    expect(consumeTransformationTrial()).toBe(false);
  });
});

describe("shorts daily quota (distinct ids, recommended feed)", () => {
  const day = new Date(2026, 5, 3, 10, 0, 0); // 2026-06-03 local

  it("allows SHORTS_FREE_DAILY_LIMIT distinct shorts, then blocks new ones", () => {
    for (let i = 0; i < SHORTS_FREE_DAILY_LIMIT; i++) {
      const id = `s${i}`;
      expect(canViewShort(id, day)).toBe(true);
      recordShortView(id, day);
    }

    expect(getShortsViewedCount(day)).toBe(SHORTS_FREE_DAILY_LIMIT);
    // A 4th, not-yet-seen short is blocked and not recorded.
    expect(canViewShort("s99", day)).toBe(false);
    expect(recordShortView("s99", day)).toBe(SHORTS_FREE_DAILY_LIMIT);
    expect(getShortsViewedCount(day)).toBe(SHORTS_FREE_DAILY_LIMIT);
  });

  it("always allows re-watching an already-counted short", () => {
    recordShortView("a", day);
    recordShortView("b", day);
    recordShortView("c", day); // quota full

    expect(canViewShort("a", day)).toBe(true);
    expect(canViewShort("b", day)).toBe(true);
    expect(canViewShort("new", day)).toBe(false);
  });

  it("resets the quota when the day changes", () => {
    recordShortView("a", day);
    recordShortView("b", day);
    recordShortView("c", day);
    expect(canViewShort("d", day)).toBe(false);

    const nextDay = new Date(2026, 5, 4, 9, 0, 0); // 2026-06-04
    expect(getShortsViewedCount(nextDay)).toBe(0);
    expect(canViewShort("d", nextDay)).toBe(true);
  });
});
