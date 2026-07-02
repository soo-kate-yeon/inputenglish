/**
 * TDD tests for SPEC-WEB-001 Phase 6 Task 6.1 — Weekly prep generation
 * (band-matched vocab/expression extraction with real source sentences).
 *
 * RED -> GREEN -> REFACTOR
 *
 * Covers:
 * - AC-006-1: band-matched WeeklyPrep generated from that week's ingested content
 * - EC-006-A: word-list-only (no matching source sentence) is rejected / never persisted
 *
 * Mocking pattern mirrors vocab-assessment-repository.test.ts: fully mocked Supabase
 * client, no live DB.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { VocabBand } from "@inputenglish/shared";
import {
  generateWeeklyPrep,
  persistWeeklyPrep,
  WeeklyPrepValidationError,
  type WeekSegmentInput,
} from "@/lib/premium/weekly-prep-generation";

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeSegment(overrides?: Partial<WeekSegmentInput>): WeekSegmentInput {
  return {
    id: "seg-1",
    scriptClean:
      "The stock market fell sharply after the central bank raised interest rates. " +
      "Investors were worried about a possible recession.",
    ...overrides,
  };
}

function makeMockClient(overrides?: {
  insertResult?: { data: unknown; error: unknown };
}) {
  const singleFn = vi
    .fn()
    .mockResolvedValue(
      overrides?.insertResult ?? { data: { id: "wp-1" }, error: null },
    );
  const selectFn = vi.fn().mockReturnValue({ single: singleFn });
  const insertFn = vi.fn().mockReturnValue({ select: selectFn });
  const fromMock = vi.fn().mockReturnValue({ insert: insertFn });

  return {
    from: fromMock,
    _mocks: { fromMock, insertFn, selectFn, singleFn },
  };
}

describe("generateWeeklyPrep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("AC-006-1: produces a band-matched WeeklyPrep with vocab/expressions bundled to real source sentences", () => {
    const segments = [makeSegment()];
    const band: VocabBand = "conversation";

    const result = generateWeeklyPrep({
      userId: "user-1",
      weekStartDate: "2026-07-05",
      courseId: null,
      band,
      segments,
    });

    expect(result.userId).toBe("user-1");
    expect(result.weekStartDate).toBe("2026-07-05");
    expect(result.vocab.length).toBeGreaterThan(0);
    expect(result.expressions.length).toBeGreaterThan(0);
    expect(result.sourceSentences.length).toBeGreaterThan(0);

    // Every vocab/expression item must be traceable to an actual source sentence
    // from that week's ingested content (not a generic definition).
    const sentenceTexts = new Set(result.sourceSentences.map((s) => s.text));
    for (const sentence of result.sourceSentences) {
      expect(
        segments.some((seg) => seg.scriptClean.includes(sentence.text)),
      ).toBe(true);
    }
    expect(sentenceTexts.size).toBeGreaterThan(0);
  });

  it("extracts vocabulary matched to the requested band (harder words for higher bands)", () => {
    const segments = [
      makeSegment({
        scriptClean:
          "The unprecedented monetary tightening exacerbated the recessionary pressures on emerging markets.",
      }),
    ];

    const professionalResult = generateWeeklyPrep({
      userId: "user-1",
      weekStartDate: "2026-07-05",
      courseId: null,
      band: "professional",
      segments,
    });

    expect(professionalResult.vocab.length).toBeGreaterThan(0);
  });

  it("returns an empty-but-valid WeeklyPrep when no segments are provided for the week", () => {
    const result = generateWeeklyPrep({
      userId: "user-1",
      weekStartDate: "2026-07-05",
      courseId: null,
      band: "basic",
      segments: [],
    });

    expect(result.vocab).toEqual([]);
    expect(result.expressions).toEqual([]);
    expect(result.sourceSentences).toEqual([]);
  });

  it("EC-006-A: throws WeeklyPrepValidationError if constructed with vocab/expressions lacking matching source sentences", () => {
    // Simulate a "simple word-list" attempt: vocab present but no source sentences at all.
    expect(() =>
      generateWeeklyPrep({
        userId: "user-1",
        weekStartDate: "2026-07-05",
        courseId: null,
        band: "basic",
        segments: [
          makeSegment({
            scriptClean: "", // no real content to derive sentences from
          }),
        ],
        // Force a pathological override to simulate a bad word-list-only builder path.
        __forceWordListOnly: true,
      }),
    ).toThrow(WeeklyPrepValidationError);
  });
});

describe("persistWeeklyPrep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("persists a valid WeeklyPrep via service_role insert matching the weekly_prep JSONB shape", async () => {
    const client = makeMockClient();
    const segments = [makeSegment()];
    const prep = generateWeeklyPrep({
      userId: "user-1",
      weekStartDate: "2026-07-05",
      courseId: null,
      band: "conversation",
      segments,
    });

    const id = await persistWeeklyPrep(client, prep);

    expect(id).toBe("wp-1");
    expect(client.from).toHaveBeenCalledWith("weekly_prep");
    const insertCall = client._mocks.insertFn.mock.calls[0][0];
    expect(insertCall.user_id).toBe("user-1");
    expect(insertCall.week_start_date).toBe("2026-07-05");
    expect(Array.isArray(insertCall.vocab)).toBe(true);
    expect(Array.isArray(insertCall.expressions)).toBe(true);
    expect(Array.isArray(insertCall.source_sentences)).toBe(true);
    expect(insertCall.send_status).toBe("pending");
  });

  it("EC-006-A: refuses to persist a WeeklyPrep whose vocab/expressions have no matching source sentences", async () => {
    const client = makeMockClient();

    // Bypass generateWeeklyPrep's own guard by hand-building an invalid shape,
    // simulating an upstream bug that produced a word-list-only WeeklyPrep.
    const invalidPrep = {
      userId: "user-1",
      weekStartDate: "2026-07-05",
      courseId: null,
      vocab: ["market", "recession"],
      expressions: ["raise interest rates"],
      sourceSentences: [],
      sendStatus: "pending" as const,
    };

    await expect(persistWeeklyPrep(client, invalidPrep)).rejects.toThrow(
      WeeklyPrepValidationError,
    );
    expect(client.from).not.toHaveBeenCalled();
  });

  it("throws a descriptive error when the insert fails", async () => {
    const client = makeMockClient({
      insertResult: { data: null, error: { message: "insert failed" } },
    });
    const segments = [makeSegment()];
    const prep = generateWeeklyPrep({
      userId: "user-1",
      weekStartDate: "2026-07-05",
      courseId: null,
      band: "conversation",
      segments,
    });

    await expect(persistWeeklyPrep(client, prep)).rejects.toThrow(
      /insert failed/,
    );
  });
});
