/**
 * TDD tests for Task 8.1 — daily-reminder Cron route (SPEC-WEB-001 Phase 8)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Mirrors reading-batch/route.ts's exact auth pattern (fail-closed CRON_SECRET,
 * Bearer + x-cron-secret header support) and deps-factory convention.
 *
 * Covers:
 * - Auth: 401 without/with wrong secret, 200 with correct secret (fail-closed)
 * - deps wiring: findEligibleRecipients queries users for active-plan,
 *   non-opted-out recipients (reminder_opt_out=false), joined with an active
 *   subscription
 * - deps wiring: buildMessageForRecipient produces a value-complete message
 *   via message-builder.ts
 * - deps wiring: sendAlimtalk/sendReminderEmail are wired to the real vendor
 *   clients
 * - deps wiring: onDualFailure logs a structured escalation entry
 * - Result: sendDailyReminders summary is returned in the response body
 *
 * All external dependencies (Supabase, sendAlimtalk, sendReminderEmail,
 * sendDailyReminders) are mocked — zero live network calls.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSendDailyReminders = vi.fn();
vi.mock("@/lib/reminder/reminder-batch", () => ({
  sendDailyReminders: (...args: unknown[]) => mockSendDailyReminders(...args),
}));

const mockSendAlimtalk = vi.fn();
vi.mock("@/lib/reminder/solapi-client", () => ({
  sendAlimtalk: (...args: unknown[]) => mockSendAlimtalk(...args),
}));

const mockSendReminderEmail = vi.fn();
vi.mock("@/lib/reminder/resend-client", () => ({
  sendReminderEmail: (...args: unknown[]) => mockSendReminderEmail(...args),
}));

let eligibleResult: {
  data: Record<string, unknown>[] | null;
  error: { message: string } | null;
} = { data: [], error: null };

function makeSupabaseMock() {
  const eqOptOutChain = vi
    .fn()
    .mockImplementation(() => Promise.resolve(eligibleResult));
  const eqChain = vi.fn().mockReturnValue({ eq: eqOptOutChain });

  return {
    from: vi.fn().mockImplementation((_table: string) => ({
      select: vi.fn().mockImplementation(() => ({ eq: eqChain })),
    })),
  };
}

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(() => makeSupabaseMock()),
}));

describe("GET /api/cron/daily-reminder", () => {
  const VALID_SECRET = "test-cron-secret-abc123";

  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    eligibleResult = { data: [], error: null };

    process.env.CRON_SECRET = VALID_SECRET;

    mockSendDailyReminders.mockResolvedValue({
      sent: [],
      skippedOptOut: [],
      escalated: [],
    });
  });

  it("returns 401 when CRON_SECRET env is not set (fail-closed)", async () => {
    delete process.env.CRON_SECRET;

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockSendDailyReminders).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({});
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockSendDailyReminders).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization: Bearer has wrong secret", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ authorization: "Bearer wrong-secret" });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockSendDailyReminders).not.toHaveBeenCalled();
  });

  it("returns 401 when x-cron-secret header has wrong secret", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ "x-cron-secret": "bad-secret" });
    const response = await GET(request as never);

    expect(response.status).toBe(401);
    expect(mockSendDailyReminders).not.toHaveBeenCalled();
  });

  it("returns 200 and runs reminders with valid Authorization: Bearer", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    expect(mockSendDailyReminders).toHaveBeenCalledOnce();
  });

  it("returns 200 and runs reminders with valid x-cron-secret header", async () => {
    const { GET } = await import("./route");
    const request = makeRequest({ "x-cron-secret": VALID_SECRET });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    expect(mockSendDailyReminders).toHaveBeenCalledOnce();
  });

  it("returns the reminder result summary in the response body", async () => {
    mockSendDailyReminders.mockResolvedValue({
      sent: ["user-1"],
      skippedOptOut: ["user-2"],
      escalated: ["user-3"],
    });

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    const response = await GET(request as never);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.sent).toEqual(["user-1"]);
    expect(body.skippedOptOut).toEqual(["user-2"]);
    expect(body.escalated).toEqual(["user-3"]);
  });

  it("deps: findEligibleRecipients queries active-plan, non-opted-out users", async () => {
    eligibleResult = {
      data: [
        {
          id: "user-1",
          email: "user1@example.com",
          reminder_opt_out: false,
        },
      ],
      error: null,
    };

    let capturedDeps: Record<string, unknown> | null = null;
    mockSendDailyReminders.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { sent: [], skippedOptOut: [], escalated: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.findEligibleRecipients).toBe("function");

    const found = await (
      capturedDeps!.findEligibleRecipients as () => Promise<
        Record<string, unknown>[]
      >
    )();
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      userId: "user-1",
      email: "user1@example.com",
      reminderOptOut: false,
    });
    // No phone column exists yet — must be null, not throw or undefined.
    expect(found[0].phone).toBeNull();
  });

  it("deps: buildMessageForRecipient produces a value-complete message", async () => {
    let capturedDeps: Record<string, unknown> | null = null;
    mockSendDailyReminders.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { sent: [], skippedOptOut: [], escalated: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.buildMessageForRecipient).toBe("function");

    const built = (
      capturedDeps!.buildMessageForRecipient as (r: unknown) => {
        message: string;
        subject: string;
      }
    )({
      userId: "user-1",
      email: "user1@example.com",
      phone: null,
      reminderOptOut: false,
    });

    expect(typeof built.message).toBe("string");
    expect(built.message.length).toBeGreaterThan(0);
    expect(typeof built.subject).toBe("string");
    expect(built.subject.length).toBeGreaterThan(0);
  });

  it("deps: sendAlimtalk is wired to the real Solapi client", async () => {
    mockSendAlimtalk.mockResolvedValue({ messageId: "m1" });

    let capturedDeps: Record<string, unknown> | null = null;
    mockSendDailyReminders.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { sent: [], skippedOptOut: [], escalated: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.sendAlimtalk).toBe("function");

    await (capturedDeps!.sendAlimtalk as (req: unknown) => Promise<unknown>)({
      to: "01000000000",
      message: "test",
    });

    expect(mockSendAlimtalk).toHaveBeenCalledOnce();
  });

  it("deps: sendReminderEmail is wired to the real Resend client", async () => {
    mockSendReminderEmail.mockResolvedValue({ id: "e1" });

    let capturedDeps: Record<string, unknown> | null = null;
    mockSendDailyReminders.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { sent: [], skippedOptOut: [], escalated: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.sendReminderEmail).toBe("function");

    await (
      capturedDeps!.sendReminderEmail as (req: unknown) => Promise<unknown>
    )({ to: "user1@example.com", subject: "s", message: "m" });

    expect(mockSendReminderEmail).toHaveBeenCalledOnce();
  });

  it("deps: onDualFailure logs a structured escalation entry", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    let capturedDeps: Record<string, unknown> | null = null;
    mockSendDailyReminders.mockImplementation(
      async (deps: Record<string, unknown>) => {
        capturedDeps = deps;
        return { sent: [], skippedOptOut: [], escalated: [] };
      },
    );

    const { GET } = await import("./route");
    const request = makeRequest({ authorization: `Bearer ${VALID_SECRET}` });
    await GET(request as never);

    expect(capturedDeps).not.toBeNull();
    expect(typeof capturedDeps!.onDualFailure).toBe("function");

    await (
      capturedDeps!.onDualFailure as (e: {
        userId: string;
        alimtalkError?: string;
        emailError: string;
      }) => Promise<void>
    )({ userId: "user-1", emailError: "resend down" });

    expect(consoleErrorSpy).toHaveBeenCalled();
    const [tag] = consoleErrorSpy.mock.calls[0];
    expect(String(tag)).toContain("[CronDailyReminder]");

    consoleErrorSpy.mockRestore();
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeRequest(headers: Record<string, string>): Request {
  return new Request("http://localhost/api/cron/daily-reminder", {
    method: "GET",
    headers: new Headers(headers),
  });
}
