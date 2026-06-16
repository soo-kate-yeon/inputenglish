/**
 * TDD Phase 4 — Cell Windowing tests for runDailyReadingBatch (optional 2nd param)
 *
 * These tests verify that the optional windowing parameter (maxCells, offset)
 * correctly slices the matrix without affecting existing Phase 2 tests.
 *
 * Covers:
 * - maxCells limits cells processed
 * - offset skips the first N cells
 * - offset past end → 0 cells
 * - no options → full matrix (backward compatible, Phase 2 contract preserved)
 * - offset-only (no maxCells) → processes from offset to end
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks declared before imports ────────────────────────────────────────────

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

// ── Import mocked modules ─────────────────────────────────────────────────────

import { generateReadingPiece } from "@/lib/premium/reading-generation";
import { computeBandCoverage } from "@/lib/premium/band-coverage";

// ── Import modules under test ─────────────────────────────────────────────────

import { runDailyReadingBatch } from "@/lib/premium/reading-batch";
import { BANDS, FORMATS, TOPICS } from "@/lib/premium/reading-matrix";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const TOTAL_CELLS = BANDS.length * FORMATS.length * TOPICS.length; // 168

function mockApprovedPiece() {
  return {
    id: `test-piece-${Math.random()}`,
    level: "B1",
    format: "nonfiction" as const,
    topic: "technology",
    body: "Test body text with sufficient content for coverage analysis.",
    coveragePct: 85,
    validationStatus: "approved" as const,
    sourceFacts: {} as Record<string, unknown>,
    userId: null,
    createdAt: new Date().toISOString(),
  };
}

function makeDeps() {
  return {
    insertPoolReadingPiece: vi.fn().mockResolvedValue({ error: null }),
    getRecentTopicsForCell: vi.fn().mockResolvedValue([]),
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("runDailyReadingBatch optional windowing (Phase 4 extension)", () => {
  beforeEach(() => {
    vi.mocked(generateReadingPiece).mockResolvedValue(mockApprovedPiece());
    vi.mocked(computeBandCoverage).mockReturnValue({
      beginner: 0.97,
      basic: 0.97,
      conversation: 0.97,
      professional: 0.97,
    });
  });

  // ── No options: full matrix (backward compatible) ─────────────────────────
  it("no options: processes all 168 cells (backward compatible)", async () => {
    const deps = makeDeps();
    const summary = await runDailyReadingBatch(deps);

    expect(summary.cellsProcessed).toBe(TOTAL_CELLS);
    expect(vi.mocked(generateReadingPiece)).toHaveBeenCalledTimes(TOTAL_CELLS);
  });

  // ── maxCells limits processed cells ──────────────────────────────────────
  it("maxCells: limits cells processed to maxCells", async () => {
    const deps = makeDeps();
    const MAX = 12;

    const summary = await runDailyReadingBatch(deps, {
      maxCells: MAX,
      offset: 0,
    });

    expect(summary.cellsProcessed).toBe(MAX);
    expect(vi.mocked(generateReadingPiece)).toHaveBeenCalledTimes(MAX);
  });

  // ── offset skips first N cells ────────────────────────────────────────────
  it("offset: skips first N cells and processes the remainder", async () => {
    const deps = makeDeps();
    const OFFSET = 10;

    const summary = await runDailyReadingBatch(deps, {
      maxCells: TOTAL_CELLS,
      offset: OFFSET,
    });

    expect(summary.cellsProcessed).toBe(TOTAL_CELLS - OFFSET);
  });

  // ── offset-only (no maxCells) ─────────────────────────────────────────────
  it("offset-only: processes from offset to end of matrix", async () => {
    const deps = makeDeps();
    const OFFSET = 50;

    const summary = await runDailyReadingBatch(deps, { offset: OFFSET });

    expect(summary.cellsProcessed).toBe(TOTAL_CELLS - OFFSET);
  });

  // ── offset past end: 0 cells ──────────────────────────────────────────────
  it("offset past end: processes 0 cells when offset >= totalCells", async () => {
    const deps = makeDeps();

    const summary = await runDailyReadingBatch(deps, {
      maxCells: 10,
      offset: TOTAL_CELLS + 100,
    });

    expect(summary.cellsProcessed).toBe(0);
    expect(vi.mocked(generateReadingPiece)).not.toHaveBeenCalled();
  });

  // ── window + offset combination ───────────────────────────────────────────
  it("maxCells + offset: processes exactly maxCells starting at offset", async () => {
    const deps = makeDeps();
    const OFFSET = 20;
    const MAX = 24;

    const summary = await runDailyReadingBatch(deps, {
      maxCells: MAX,
      offset: OFFSET,
    });

    expect(summary.cellsProcessed).toBe(MAX);
  });

  // ── Rotation invariant: different offsets process different cells ──────────
  it("rotation: different offsets generate different cells", async () => {
    const deps1 = makeDeps();
    const deps2 = makeDeps();
    const MAX = 10;

    await runDailyReadingBatch(deps1, { maxCells: MAX, offset: 0 });
    await runDailyReadingBatch(deps2, { maxCells: MAX, offset: MAX });

    // Each run inserts exactly MAX rows
    expect(deps1.insertPoolReadingPiece).toHaveBeenCalledTimes(MAX);
    expect(deps2.insertPoolReadingPiece).toHaveBeenCalledTimes(MAX);

    // The first argument (row) to each call should be for different topics
    const rows1 = deps1.insertPoolReadingPiece.mock.calls.map(
      (args: unknown[]) => {
        const row = args[0] as Record<string, unknown>;
        return `${row.band}|${row.format}|${row.topic}`;
      },
    );
    const rows2 = deps2.insertPoolReadingPiece.mock.calls.map(
      (args: unknown[]) => {
        const row = args[0] as Record<string, unknown>;
        return `${row.band}|${row.format}|${row.topic}`;
      },
    );

    // No overlap between the two windows
    const set1 = new Set(rows1);
    const overlap = rows2.filter((r: string) => set1.has(r));
    expect(overlap.length).toBe(0);
  });

  // ── Cost model preserved with windowing ───────────────────────────────────
  it("EC-002-C / AC-004-3: LLM calls = maxCells (user-independent, windowed)", async () => {
    const deps = makeDeps();
    const MAX = 24;

    const summary = await runDailyReadingBatch(deps, {
      maxCells: MAX,
      offset: 0,
    });

    expect(summary.llmCalls).toBe(MAX);
    // No user-count parameter — calls depend solely on window size
    expect(vi.mocked(generateReadingPiece)).toHaveBeenCalledTimes(MAX);
  });
});
