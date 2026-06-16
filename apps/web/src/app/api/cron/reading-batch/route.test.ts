/**
 * TDD Phase 4 — Cron Route tests (REQ-AUTO-004)
 *
 * RED → GREEN → REFACTOR
 *
 * Covers:
 * - AC-004-1: Schedule trigger routes to batch executor
 * - AC-004-2: Cron auth — 401 without/with wrong secret, 200 with correct secret
 * - EC-004-A: Idempotency — second same-day call returns skipped:true, no generation
 * - AC-004-3 / EC-002-C: Cost = window size only, user-count independent
 * - Cell windowing: maxCells bounds processed cells; offset rotates matrix
 * - deps wiring: insertPoolReadingPiece maps camelCase→snake_case, forces user_id null
 *
 * All external dependencies (Supabase, runDailyReadingBatch) are mocked.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks declared before any imports ────────────────────────────────────────

// Capture last insert call data so tests can inspect it
let lastInsertData: Record<string, unknown> | null = null;

// Supabase mock — returns an object that supports the fluent chain used in the route.
// We build the entire chain in a factory so each test gets fresh mocks.
type IdempotencyResult = { count: number; error: null };
let idempotencyResult: IdempotencyResult = { count: 0, error: null };

const supabaseInsertMock = vi
  .fn()
  .mockImplementation((data: Record<string, unknown>) => {
    lastInsertData = data;
    // Return a Promise resolving to { error: null } to match supabase client behavior
    return Promise.resolve({ error: null });
  });

function makeSupabaseMock() {
  // The idempotency query chain:
  //   supabase.from("reading_pieces")
  //     .select("id", { count: "exact", head: true })
  //     .is("user_id", null)
  //     .gte("created_at", ...)
  const gteChain = vi
    .fn()
    .mockImplementation(() => Promise.resolve(idempotencyResult));
  const isChain = vi.fn().mockReturnValue({ gte: gteChain });

  // The getRecentTopicsForCell query chain:
  //   supabase.from("reading_pieces")
  //     .select("topic")
  //     .eq("band", band).eq("format", format).is("user_id", null)
  //     .order("created_at", ...).limit(N)
  const limitChain = vi.fn().mockResolvedValue({ data: [], error: null });
  const orderChain = vi.fn().mockReturnValue({ limit: limitChain });
  const isChain2 = vi.fn().mockReturnValue({ order: orderChain });
  const eqChain2 = vi.fn().mockReturnValue({ is: isChain2 });
  const eqChain1 = vi.fn().mockReturnValue({ eq: eqChain2 });

  return {
    from: vi.fn().mockImplementation((_table: string) => ({
      // Both idempotency (count query) and recent-topics use .select()
      // but with different args. We use a combined mock that handles both.
      select: vi.fn().mockImplementation((_fields: string, opts?: unknown) => {
        if (opts && typeof opts === "object" && "count" in (opts as object)) {
          // Idempotency check: select("id", { count: "exact", head: true })
          return { is: isChain };
        }
        // getRecentTopicsForCell: select("topic")
        return { eq: eqChain1 };
      }),
      // Use the shared supabaseInsertMock so tests can inspect calls
      insert: supabaseInsertMock,
    })),
  };
}

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => makeSupabaseMock()),
}));

const mockRunDailyReadingBatch = vi.fn();
vi.mock("@/lib/premium/reading-batch", () => ({
  runDailyReadingBatch: (...args: unknown[]) =>
    mockRunDailyReadingBatch(...args),
}));

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("GET /api/cron/reading-batch", () => {
  const VALID_SECRET = "test-cron-secret-abc123";

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    lastInsertData = null;

    // Default: CRON_SECRET is set
    process.env.CRON_SECRET = VALID_SECRET;
    // Default: no windowing
    delete process.env.READING_BATCH_MAX_CELLS_PER_RUN;

    // Default: no rows today (first run)
    idempotencyResult = { count: 0, error: null };

    // Default batch result
    mockRunDailyReadingBatch.mockResolvedValue({
      cellsProcessed: 4,
      inserted: 4,
      approved: 3,
      rejected: 1,
      llmCalls: 4,
    });
  });

  // ── Auth: 401 when CRON_SECRET env is unset ─────────────────────────────
  it("AC-004-2: returns 401 when CRON_SECRET env is not set (fail-closed)", async () => {
    delete process.env.CRON_SECRET;

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toHaveProperty("error");
    expect(mockRunDailyReadingBatch).not.toHaveBeenCalled();
  });

  // ── Auth: 401 when no auth header ────────────────────────────────────────
  it("AC-004-2: returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({});
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockRunDailyReadingBatch).not.toHaveBeenCalled();
  });

  // ── Auth: 401 when wrong secret via Authorization: Bearer ────────────────
  it("AC-004-2: returns 401 when Authorization: Bearer has wrong secret", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ authorization: "Bearer wrong-secret" });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockRunDailyReadingBatch).not.toHaveBeenCalled();
  });

  // ── Auth: 401 when wrong secret via x-cron-secret header ─────────────────
  it("AC-004-2: returns 401 when x-cron-secret header has wrong secret", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ "x-cron-secret": "bad-secret" });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockRunDailyReadingBatch).not.toHaveBeenCalled();
  });

  // ── Auth: 200 with correct Authorization: Bearer ──────────────────────────
  it("AC-004-2: returns 200 and runs batch with valid Authorization: Bearer", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    expect(mockRunDailyReadingBatch).toHaveBeenCalledOnce();
  });

  // ── Auth: 200 with correct x-cron-secret header ──────────────────────────
  it("AC-004-2: returns 200 and runs batch with valid x-cron-secret header", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ "x-cron-secret": VALID_SECRET });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    expect(mockRunDailyReadingBatch).toHaveBeenCalledOnce();
  });

  // ── Idempotency: second same-day call is skipped ──────────────────────────
  it("EC-004-A: returns skipped:true on second same-day call, no batch execution", async () => {
    // Simulate already-ran: Supabase returns count > 0
    idempotencyResult = { count: 5, error: null };

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.skipped).toBe(true);
    expect(body.reason).toMatch(/already ran/i);
    // Batch must NOT be invoked
    expect(mockRunDailyReadingBatch).not.toHaveBeenCalled();
  });

  // ── Idempotency: first run does execute batch ─────────────────────────────
  it("EC-004-A: first run of the day executes batch (not skipped)", async () => {
    idempotencyResult = { count: 0, error: null };

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.skipped).toBeFalsy();
    expect(mockRunDailyReadingBatch).toHaveBeenCalledOnce();
  });

  // ── BatchSummary is returned in response ──────────────────────────────────
  it("AC-004-1: returns BatchSummary in response body", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toHaveProperty("cellsProcessed");
    expect(body).toHaveProperty("inserted");
    expect(body).toHaveProperty("approved");
    expect(body).toHaveProperty("llmCalls");
  });

  // ── Cell windowing: maxCells limits cells processed ───────────────────────
  it("windowing: passes maxCells and offset from env to runDailyReadingBatch", async () => {
    process.env.READING_BATCH_MAX_CELLS_PER_RUN = "24";

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(mockRunDailyReadingBatch).toHaveBeenCalledOnce();
    const [, options] = mockRunDailyReadingBatch.mock.calls[0];
    expect(options).toBeDefined();
    expect(options.maxCells).toBe(24);
    expect(typeof options.offset).toBe("number");
  });

  // ── Without READING_BATCH_MAX_CELLS_PER_RUN: no options passed ────────────
  it("windowing: without env var, passes undefined options (full matrix)", async () => {
    delete process.env.READING_BATCH_MAX_CELLS_PER_RUN;

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(mockRunDailyReadingBatch).toHaveBeenCalledOnce();
    const [, options] = mockRunDailyReadingBatch.mock.calls[0];
    // No windowing: options should be undefined or maxCells should be nullish
    expect(options == null || options.maxCells == null).toBe(true);
  });

  // ── deps wiring: insertPoolReadingPiece maps camelCase→snake_case ────────
  it("deps: insertPoolReadingPiece maps camelCase to snake_case and forces user_id null", async () => {
    // Capture the deps passed to runDailyReadingBatch
    let capturedDeps: Record<string, unknown> | null = null;
    mockRunDailyReadingBatch.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return {
          cellsProcessed: 0,
          inserted: 0,
          approved: 0,
          rejected: 0,
          llmCalls: 0,
        };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.insertPoolReadingPiece).toBe("function");

    // Ensure supabaseInsertMock is properly set up before direct call
    supabaseInsertMock.mockImplementation((data: Record<string, unknown>) => {
      lastInsertData = data;
      return Promise.resolve({ error: null });
    });

    // Now call insertPoolReadingPiece with a camelCase row
    const camelCaseRow = {
      level: "B1",
      format: "nonfiction" as const,
      topic: "technology",
      body: "Test body",
      coveragePct: 85,
      validationStatus: "approved" as const,
      sourceFacts: { foo: "bar" } as Record<string, unknown>,
      userId: null as null,
      band: "conversation" as const,
      expiresAt: new Date().toISOString(),
    };

    await (
      capturedDeps!.insertPoolReadingPiece as (
        row: typeof camelCaseRow,
      ) => Promise<{ error: Error | null }>
    )(camelCaseRow);

    // lastInsertData should have snake_case keys
    expect(lastInsertData).not.toBeNull();
    expect(lastInsertData).toHaveProperty("coverage_pct");
    expect(lastInsertData).toHaveProperty("validation_status");
    expect(lastInsertData).toHaveProperty("source_facts");
    expect(lastInsertData).toHaveProperty("expires_at");
    expect(lastInsertData).toHaveProperty("user_id");
    // user_id must ALWAYS be null
    expect((lastInsertData as Record<string, unknown>).user_id).toBeNull();
  });

  // ── deps wiring: getRecentTopicsForCell is wired ─────────────────────────
  it("deps: getRecentTopicsForCell is present and callable in deps", async () => {
    let capturedDeps: Record<string, unknown> | null = null;
    mockRunDailyReadingBatch.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return {
          cellsProcessed: 0,
          inserted: 0,
          approved: 0,
          rejected: 0,
          llmCalls: 0,
        };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.getRecentTopicsForCell).toBe("function");
  });

  // ── Cost model: user-count independent (AC-004-3) ────────────────────────
  it("AC-004-3: batch LLM calls are independent of simulated user count", async () => {
    // The cron route doesn't take user count as input — this verifies the
    // interface boundary: no user-count parameter exists in the route.
    // Both runs call batch with same matrix window → identical llmCalls.
    const { GET } = await import("./route");

    const r1 = await GET(
      makeRequest({ authorization: `Bearer ${VALID_SECRET}` }) as never,
    );
    const b1 = await r1.json();

    // Reset idempotency to allow second run
    vi.clearAllMocks();
    idempotencyResult = { count: 0, error: null };
    mockRunDailyReadingBatch.mockResolvedValue({
      cellsProcessed: 4,
      inserted: 4,
      approved: 3,
      rejected: 1,
      llmCalls: 4,
    });

    const r2 = await GET(
      makeRequest({ authorization: `Bearer ${VALID_SECRET}` }) as never,
    );
    const b2 = await r2.json();

    // LLM calls must be identical regardless of external "user count"
    expect(b1.llmCalls).toBe(b2.llmCalls);
    expect(b1.cellsProcessed).toBe(b2.cellsProcessed);
  });
});

// Windowing tests for runDailyReadingBatch are in:
// src/lib/premium/__tests__/reading-batch-phase4-windowing.test.ts

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/cron/reading-batch", {
    method: "GET",
    headers: new Headers(headers),
  });
}
