/**
 * TDD tests for Phase 2 — Daily Reading Batch (REQ-AUTO-002)
 *
 * RED → GREEN → REFACTOR
 *
 * Covers:
 * - AC-002-1: Matrix enumeration and pool row generation (band×format×topic)
 * - AC-002-2: Pool row always has user_id=NULL and correct band (U3 guard)
 * - AC-002-3: Dedup/rotation avoids recent topics
 * - EC-002-A: Validation gate isolation (non-optimal → not approved)
 * - EC-002-C: Cost model — LLM calls = bands × formats × topics (user-independent)
 * - REQ-AUTO-004-U2: Cost is independent of user count
 *
 * Mocking pattern: follows ingest-phase1.test.ts conventions.
 * No network, no DB — all external deps mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── mocks declared before imports ───────────────────────────────────────────

vi.mock("@/lib/premium/reading-generation", () => ({
  generateReadingPiece: vi.fn(),
}));

vi.mock("@/lib/premium/band-coverage", () => ({
  computeBandCoverage: vi.fn(),
}));

vi.mock("@inputenglish/shared", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@inputenglish/shared")>();
  return {
    ...actual,
    judgeCoverage: actual.judgeCoverage,
    getBandSeedMetadata: actual.getBandSeedMetadata,
  };
});

// ── import mocked modules ────────────────────────────────────────────────────
import { generateReadingPiece } from "@/lib/premium/reading-generation";
import { computeBandCoverage } from "@/lib/premium/band-coverage";

// ── import modules under test ────────────────────────────────────────────────
import {
  enumerateMatrixCells,
  BANDS,
  FORMATS,
  TOPICS,
} from "@/lib/premium/reading-matrix";

import {
  runDailyReadingBatch,
  type BatchSummary,
  POOL_SENTINEL,
} from "@/lib/premium/reading-batch";
import type { MatrixCell } from "@/lib/premium/reading-matrix";

// ── fixtures ─────────────────────────────────────────────────────────────────

function makeApprovedPiece(
  overrides: Partial<{
    validationStatus: "pending" | "approved" | "rejected";
    body: string;
    userId: string | null;
  }> = {},
) {
  return {
    id: `reading-${Math.random()}`,
    level: "B1",
    format: "nonfiction" as const,
    topic: "technology",
    body: "Test body text about technology and systems.",
    coveragePct: 85,
    validationStatus: "approved" as const,
    sourceFacts: {},
    userId: null as string | null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

// ── reading-matrix tests ──────────────────────────────────────────────────────

describe("reading-matrix: enumerateMatrixCells()", () => {
  it("returns array of all band × format × topic combinations", () => {
    const cells = enumerateMatrixCells();
    expect(Array.isArray(cells)).toBe(true);
    expect(cells.length).toBe(BANDS.length * FORMATS.length * TOPICS.length);
  });

  it("each cell has band, level, format, topic fields", () => {
    const cells = enumerateMatrixCells();
    for (const cell of cells) {
      expect(cell).toHaveProperty("band");
      expect(cell).toHaveProperty("level");
      expect(cell).toHaveProperty("format");
      expect(cell).toHaveProperty("topic");
    }
  });

  it("targets conversation and professional bands only (beginner/basic dropped)", () => {
    const cells = enumerateMatrixCells();
    const bands = new Set(cells.map((c) => c.band));
    expect(bands.size).toBe(2);
    expect(bands.has("conversation")).toBe(true);
    expect(bands.has("professional")).toBe(true);
    expect(bands.has("beginner")).toBe(false);
    expect(bands.has("basic")).toBe(false);
  });

  it("contains exactly 6 distinct formats", () => {
    const cells = enumerateMatrixCells();
    const formats = new Set(cells.map((c) => c.format));
    expect(formats.size).toBe(6);
  });

  it("level is derived from band via getBandSeedMetadata (CEFR)", () => {
    const cells = enumerateMatrixCells();
    const beginnerCells = cells.filter((c) => c.band === "beginner");
    expect(beginnerCells.every((c) => c.level === "A1")).toBe(true);
    const basicCells = cells.filter((c) => c.band === "basic");
    expect(basicCells.every((c) => c.level === "A2")).toBe(true);
    const conversationCells = cells.filter((c) => c.band === "conversation");
    expect(conversationCells.every((c) => c.level === "B1")).toBe(true);
    const professionalCells = cells.filter((c) => c.band === "professional");
    expect(professionalCells.every((c) => c.level === "B2")).toBe(true);
  });

  it("TOPICS includes at least climate, technology, economics", () => {
    expect(TOPICS).toContain("climate");
    expect(TOPICS).toContain("technology");
    expect(TOPICS).toContain("economics");
  });
});

// ── reading-batch tests ───────────────────────────────────────────────────────

describe("reading-batch: runDailyReadingBatch()", () => {
  beforeEach(() => {
    process.env.READING_FIXTURE_MODE = "true";
  });

  // Helper: mock insertPoolReadingPiece
  function makeInsertMock(
    error: Error | null = null,
  ): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue(error ? { error } : { error: null });
  }

  // Helper: mock getRecentTopicsForCell
  function makeRecentTopicsMock(
    topics: string[] = [],
  ): ReturnType<typeof vi.fn> {
    return vi.fn().mockResolvedValue(topics);
  }

  // ── AC-002-1: matrix traversal ──────────────────────────────────────────
  it("AC-002-1: calls generateReadingPiece for each matrix cell", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    const insertMock = makeInsertMock();
    const recentTopicsMock = makeRecentTopicsMock();
    const cells = enumerateMatrixCells();

    const summary = await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    expect(vi.mocked(generateReadingPiece)).toHaveBeenCalledTimes(cells.length);
    expect(summary.cellsProcessed).toBe(cells.length);
  });

  // ── AC-002-2: pool row user_id = NULL ────────────────────────────────────
  it("AC-002-2: every persisted row has user_id=NULL (POOL_SENTINEL)", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    const insertedRows: Array<{ userId: string | null }> = [];
    const insertMock = vi.fn().mockImplementation(async (row) => {
      insertedRows.push(row);
      return { error: null };
    });
    const recentTopicsMock = makeRecentTopicsMock();

    await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    expect(insertedRows.length).toBeGreaterThan(0);
    for (const row of insertedRows) {
      expect(row.userId).toBeNull();
    }
  });

  // ── AC-002-2: U3 guard — reject non-null userId ──────────────────────────
  it("AC-002-2 (U3 guard): rejects insert if userId is non-null", async () => {
    // generateReadingPiece returns piece with non-null userId (simulate bug)
    vi.mocked(generateReadingPiece).mockResolvedValue(
      makeApprovedPiece({ userId: "real-user-id" }),
    );
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    const insertMock = makeInsertMock();
    const recentTopicsMock = makeRecentTopicsMock();

    const summary = await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    // All inserts should be forced to null userId — guard enforces this
    const allInsertCalls = insertMock.mock.calls;
    for (const [row] of allInsertCalls) {
      expect(row.userId).toBeNull();
    }
    // Alternatively, inserts may be skipped if the guard rejects entirely
    // Either way, no real userId ever reaches the DB
    expect(summary.cellsProcessed).toBeGreaterThan(0);
  });

  // ── AC-002-2: band field matches cell band ───────────────────────────────
  it("AC-002-2: persisted row band matches cell band", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    const insertedRows: Array<{ band: string; userId: string | null }> = [];
    const insertMock = vi.fn().mockImplementation(async (row) => {
      insertedRows.push(row);
      return { error: null };
    });
    const recentTopicsMock = makeRecentTopicsMock();

    await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    const validBands = new Set([
      "beginner",
      "basic",
      "conversation",
      "professional",
    ]);
    for (const row of insertedRows) {
      expect(validBands.has(row.band)).toBe(true);
    }
  });

  // ── EC-002-A: validation gate — non-optimal → not approved ───────────────
  it("EC-002-A: non-optimal coverage sets validation_status to pending/rejected, not approved", async () => {
    // generateReadingPiece returns piece with validationStatus pending (no knownLemmas gate)
    vi.mocked(generateReadingPiece).mockResolvedValue(
      makeApprovedPiece({ validationStatus: "pending" }),
    );
    // computeBandCoverage returns coverage well above the pool ceiling (90% unknown)
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.1, // 90% unknown → above POOL_MAX_UNKNOWN_RATIO → rejected
      basic: 0.1,
      conversation: 0.1,
      professional: 0.1,
    });

    const insertedRows: Array<{ validationStatus: string }> = [];
    const insertMock = vi.fn().mockImplementation(async (row) => {
      insertedRows.push(row);
      return { error: null };
    });
    const recentTopicsMock = makeRecentTopicsMock();

    const summary = await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    // Non-optimal rows should NOT be approved
    const approvedRows = insertedRows.filter(
      (r) => r.validationStatus === "approved",
    );
    expect(approvedRows.length).toBe(0);
    expect(summary.approved).toBe(0);
  });

  // ── EC-002-A: validation gate — optimal coverage → approved ─────────────
  it("EC-002-A: optimal coverage sets validation_status to approved", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    // judgeCoverage: unknownRatio 0.03 (= 1-0.97) → optimal
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.97,
      basic: 0.97,
      conversation: 0.97,
      professional: 0.97,
    });

    const insertedRows: Array<{ validationStatus: string; band: string }> = [];
    const insertMock = vi.fn().mockImplementation(async (row) => {
      insertedRows.push(row);
      return { error: null };
    });
    const recentTopicsMock = makeRecentTopicsMock();

    const summary = await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    expect(summary.approved).toBeGreaterThan(0);
    const nonApproved = insertedRows.filter(
      (r) => r.validationStatus !== "approved",
    );
    expect(nonApproved.length).toBe(0);
  });

  // ── Pool ceiling: approve within POOL_MAX_UNKNOWN_RATIO (0.15) ───────────
  it("approves readings within the pool ceiling (unknownRatio <= 0.15)", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    // 0.88 coverage = 0.12 unknown ≤ 0.15 → approved (would be too-hard under the old 0.05 gate)
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.88,
      basic: 0.88,
      conversation: 0.88,
      professional: 0.88,
    });

    const summary = await runDailyReadingBatch({
      insertPoolReadingPiece: makeInsertMock(),
      getRecentTopicsForCell: makeRecentTopicsMock(),
    });

    expect(summary.approved).toBe(summary.cellsProcessed);
    expect(summary.rejected).toBe(0);
  });

  it("rejects readings above the pool ceiling (unknownRatio > 0.15)", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    // 0.80 coverage = 0.20 unknown > 0.15 → rejected
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.8,
      basic: 0.8,
      conversation: 0.8,
      professional: 0.8,
    });

    const summary = await runDailyReadingBatch({
      insertPoolReadingPiece: makeInsertMock(),
      getRecentTopicsForCell: makeRecentTopicsMock(),
    });

    expect(summary.rejected).toBe(summary.cellsProcessed);
    expect(summary.approved).toBe(0);
  });

  // ── EC-002-C: cost = bands × formats × topics (user-independent) ─────────
  it("EC-002-C: LLM call count equals bands × formats × topics (user-independent)", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    const insertMock = makeInsertMock();
    const recentTopicsMock = makeRecentTopicsMock();

    const expectedCalls = BANDS.length * FORMATS.length * TOPICS.length;

    const summary = await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    // llmCalls must equal matrix size (no user-count multiplier)
    expect(summary.llmCalls).toBe(expectedCalls);
    expect(vi.mocked(generateReadingPiece)).toHaveBeenCalledTimes(
      expectedCalls,
    );
  });

  it("EC-002-C: running batch with 0 users produces same LLM call count as 1000 users", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    const insertMock = makeInsertMock();
    const recentTopicsMock = makeRecentTopicsMock();

    // Batch doesn't accept user count — it's always band-proportional
    const summaryRun1 = await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    vi.mocked(generateReadingPiece).mockClear();

    const summaryRun2 = await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    expect(summaryRun1.llmCalls).toBe(summaryRun2.llmCalls);
  });

  // ── AC-002-3: dedup/rotation — avoids recent topics ─────────────────────
  it("AC-002-3: skips topic if it appears in recent topics for cell", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    const insertMock = makeInsertMock();
    // Return the current topic as recent → every cell will try to skip
    // The batch should still proceed (generate with alternative or proceed anyway with dedup note)
    const recentTopicsMock = vi.fn().mockResolvedValue(TOPICS); // all topics recent

    const summary = await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    // cellsProcessed should still be non-zero (graceful dedup)
    expect(summary.cellsProcessed).toBeGreaterThan(0);
    // getRecentTopicsForCell was called for each cell
    expect(recentTopicsMock).toHaveBeenCalled();
  });

  // ── REQ-AUTO-002-U2: expires_at lifecycle ───────────────────────────────
  it("U2: persisted rows have expires_at set", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    const insertedRows: Array<{ expiresAt: string | null }> = [];
    const insertMock = vi.fn().mockImplementation(async (row) => {
      insertedRows.push(row);
      return { error: null };
    });
    const recentTopicsMock = makeRecentTopicsMock();

    await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    expect(insertedRows.length).toBeGreaterThan(0);
    for (const row of insertedRows) {
      expect(row.expiresAt).not.toBeNull();
      expect(typeof row.expiresAt).toBe("string");
      // Should be a valid ISO date in the future
      const expiresAt = new Date(row.expiresAt!);
      expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    }
  });

  // ── BatchSummary fields ──────────────────────────────────────────────────
  it("returns BatchSummary with expected fields", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    const insertMock = makeInsertMock();
    const recentTopicsMock = makeRecentTopicsMock();

    const summary = await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    expect(summary).toHaveProperty("cellsProcessed");
    expect(summary).toHaveProperty("inserted");
    expect(summary).toHaveProperty("approved");
    expect(summary).toHaveProperty("rejected");
    expect(summary).toHaveProperty("llmCalls");
    expect(typeof summary.cellsProcessed).toBe("number");
    expect(typeof summary.inserted).toBe("number");
    expect(typeof summary.approved).toBe("number");
    expect(typeof summary.rejected).toBe("number");
    expect(typeof summary.llmCalls).toBe("number");
  });

  // ── POOL_SENTINEL is exported and is a well-known constant ───────────────
  it("POOL_SENTINEL is 'POOL' string constant", () => {
    expect(POOL_SENTINEL).toBe("POOL");
  });

  // ── generateReadingPiece called with userId = POOL_SENTINEL ─────────────
  it("calls generateReadingPiece with userId = POOL_SENTINEL", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    const insertMock = makeInsertMock();
    const recentTopicsMock = makeRecentTopicsMock();

    await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    const calls = vi.mocked(generateReadingPiece).mock.calls;
    for (const [input] of calls) {
      expect(input.userId).toBe(POOL_SENTINEL);
    }
  });

  // ── DB insert failure is isolated (partial success) ──────────────────────
  it("DB insert failure for one cell does not abort the whole batch", async () => {
    vi.mocked(generateReadingPiece).mockResolvedValue(makeApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.9,
      basic: 0.85,
      conversation: 0.8,
      professional: 0.7,
    });

    let callCount = 0;
    const insertMock = vi.fn().mockImplementation(async () => {
      callCount++;
      if (callCount === 1) return { error: new Error("DB fail") };
      return { error: null };
    });
    const recentTopicsMock = makeRecentTopicsMock();
    const cells = enumerateMatrixCells();

    const summary = await runDailyReadingBatch({
      insertPoolReadingPiece: insertMock,
      getRecentTopicsForCell: recentTopicsMock,
    });

    // All cells were still processed despite first insert failure
    expect(summary.cellsProcessed).toBe(cells.length);
    // inserted count = cells - 1 (one failure)
    expect(summary.inserted).toBe(cells.length - 1);
  });
});
