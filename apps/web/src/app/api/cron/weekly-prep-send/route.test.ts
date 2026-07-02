/**
 * TDD tests for Task 8.1 — weekly-prep-send Cron route (SPEC-WEB-001 Phase 8)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Mirrors reading-batch/route.ts's exact auth pattern (fail-closed CRON_SECRET,
 * Bearer + x-cron-secret header support) and deps-factory convention.
 *
 * Covers:
 * - Auth: 401 without/with wrong secret, 200 with correct secret (fail-closed)
 * - deps wiring: findPendingWeeklyPreps queries weekly_prep WHERE send_status='pending'
 *   (joined with users for email delivery), mapping snake_case -> camelCase
 * - deps wiring: sendNotification delivers via the reminder send chain (Solapi
 *   alimtalk primary, Resend email fallback)
 * - deps wiring: updateSendStatus performs the real UPDATE on weekly_prep
 * - Result: sendPendingWeeklyPreps summary is returned in the response body
 *
 * All external dependencies (Supabase, sendAlimtalk, sendReminderEmail,
 * sendPendingWeeklyPreps) are mocked — zero live network calls.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendPendingWeeklyPreps = vi.fn();
vi.mock("@/lib/premium/weekly-prep-send", () => ({
  sendPendingWeeklyPreps: (...args: unknown[]) =>
    mockSendPendingWeeklyPreps(...args),
}));

const mockSendAlimtalk = vi.fn();
vi.mock("@/lib/reminder/solapi-client", () => ({
  sendAlimtalk: (...args: unknown[]) => mockSendAlimtalk(...args),
}));

const mockSendReminderEmail = vi.fn();
vi.mock("@/lib/reminder/resend-client", () => ({
  sendReminderEmail: (...args: unknown[]) => mockSendReminderEmail(...args),
}));

let lastUpdateData: Record<string, unknown> | null = null;
let lastUpdateEqCalls: Array<[string, unknown]> = [];
let pendingResult: {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
} = { data: [], error: null };

function makeSupabaseMock() {
  const eqChain = vi
    .fn()
    .mockImplementation(() => Promise.resolve(pendingResult));

  const updateEqChain = vi
    .fn()
    .mockImplementation((column: string, value: unknown) => {
      lastUpdateEqCalls.push([column, value]);
      return Promise.resolve({ error: null });
    });

  return {
    from: vi.fn().mockImplementation((_table: string) => ({
      select: vi.fn().mockImplementation(() => ({ eq: eqChain })),
      update: vi.fn().mockImplementation((data: Record<string, unknown>) => {
        lastUpdateData = data;
        return { eq: updateEqChain };
      }),
    })),
  };
}

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => makeSupabaseMock()),
}));

describe("GET /api/cron/weekly-prep-send", () => {
  const VALID_SECRET = "test-cron-secret-abc123";

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    lastUpdateData = null;
    lastUpdateEqCalls = [];
    pendingResult = { data: [], error: null };

    process.env.CRON_SECRET = VALID_SECRET;

    mockSendPendingWeeklyPreps.mockResolvedValue({
      succeeded: [],
      failed: [],
    });
  });

  it("returns 401 when CRON_SECRET env is not set (fail-closed)", async () => {
    delete process.env.CRON_SECRET;

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockSendPendingWeeklyPreps).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({});
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockSendPendingWeeklyPreps).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization: Bearer has wrong secret", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ authorization: "Bearer wrong-secret" });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockSendPendingWeeklyPreps).not.toHaveBeenCalled();
  });

  it("returns 401 when x-cron-secret header has wrong secret", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ "x-cron-secret": "bad-secret" });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockSendPendingWeeklyPreps).not.toHaveBeenCalled();
  });

  it("returns 200 and runs send with valid Authorization: Bearer", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    expect(mockSendPendingWeeklyPreps).toHaveBeenCalledOnce();
  });

  it("returns 200 and runs send with valid x-cron-secret header", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ "x-cron-secret": VALID_SECRET });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    expect(mockSendPendingWeeklyPreps).toHaveBeenCalledOnce();
  });

  it("returns the send result summary in the response body", async () => {
    mockSendPendingWeeklyPreps.mockResolvedValue({
      succeeded: ["prep-1"],
      failed: [{ weeklyPrepId: "prep-2", error: "vendor down" }],
    });

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.succeeded).toEqual(["prep-1"]);
    expect(body.failed).toEqual([
      { weeklyPrepId: "prep-2", error: "vendor down" },
    ]);
  });

  it("deps: findPendingWeeklyPreps queries weekly_prep where send_status='pending'", async () => {
    pendingResult = {
      data: [
        {
          id: "prep-1",
          user_id: "user-1",
          expressions: ["break the ice", "call it a day"],
          users: { email: "user1@example.com" },
        },
      ],
      error: null,
    };

    let capturedDeps: Record<string, unknown> | null = null;
    mockSendPendingWeeklyPreps.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { succeeded: [], failed: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.findPendingWeeklyPreps).toBe("function");

    const found = await (
      capturedDeps!.findPendingWeeklyPreps as () => Promise<
        Record<string, unknown>[]
      >
    )();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      id: "prep-1",
      userId: "user-1",
      expressions: ["break the ice", "call it a day"],
    });
  });

  it("deps: sendNotification delivers via Resend email using the joined user email", async () => {
    pendingResult = {
      data: [
        {
          id: "prep-1",
          user_id: "user-1",
          expressions: ["break the ice"],
          users: { email: "user1@example.com" },
        },
      ],
      error: null,
    };
    mockSendReminderEmail.mockResolvedValue({ id: "email-1" });

    let capturedDeps: Record<string, unknown> | null = null;
    mockSendPendingWeeklyPreps.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { succeeded: [], failed: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.sendNotification).toBe("function");

    // Populate the deps' internal userId->email map (findPendingWeeklyPreps
    // is always called before sendNotification in the real orchestration).
    await (capturedDeps!.findPendingWeeklyPreps as () => Promise<unknown[]>)();

    await (
      capturedDeps!.sendNotification as (n: {
        userId: string;
        message: string;
      }) => Promise<void>
    )({ userId: "user-1", message: "이번 주 예습 나왔어요" });

    expect(mockSendReminderEmail).toHaveBeenCalledOnce();
    expect(mockSendReminderEmail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user1@example.com" }),
    );
  });

  it("deps: updateSendStatus performs the real UPDATE on weekly_prep", async () => {
    let capturedDeps: Record<string, unknown> | null = null;
    mockSendPendingWeeklyPreps.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { succeeded: [], failed: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.updateSendStatus).toBe("function");

    await (
      capturedDeps!.updateSendStatus as (
        id: string,
        status: "sent" | "failed",
      ) => Promise<void>
    )("prep-1", "sent");

    expect(lastUpdateData).toMatchObject({ send_status: "sent" });
    expect(lastUpdateEqCalls).toContainEqual(["id", "prep-1"]);
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/cron/weekly-prep-send", {
    method: "GET",
    headers: new Headers(headers),
  });
}
