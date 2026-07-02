/**
 * TDD tests for Task 7.3 — reminder batch orchestration (SPEC-WEB-001 Phase 7)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Mirrors lib/premium/weekly-prep-send.ts's dependency-injection shape:
 * processes each reminder-eligible recipient independently, never lets one
 * failure block others.
 *
 * Covers:
 * - EC-007-A: opt-out recipients (reminder_opt_out=true) are skipped entirely.
 * - AC-007-1: Solapi-first, Resend-fallback per recipient (via sendReminder).
 * - EC-007-B: a single dual-failure (both vendors fail) triggers exactly one
 *   escalation call and does NOT retry indefinitely within one invocation.
 */
import { describe, expect, it, vi } from "vitest";
import { sendDailyReminders } from "./reminder-batch";

function makeRecipient(
  overrides: Partial<{
    userId: string;
    phone: string | null;
    email: string;
    reminderOptOut: boolean;
  }> = {},
) {
  return {
    userId: "user-1",
    phone: "01000000000",
    email: "user@example.com",
    reminderOptOut: false,
    ...overrides,
  };
}

describe("sendDailyReminders", () => {
  it("skips recipients with reminder_opt_out=true (EC-007-A)", async () => {
    const findEligibleRecipients = vi
      .fn()
      .mockResolvedValue([
        makeRecipient({ userId: "opted-out", reminderOptOut: true }),
        makeRecipient({ userId: "active-user", reminderOptOut: false }),
      ]);
    const buildMessageForRecipient = vi.fn().mockReturnValue({
      message: "오늘 BBC에서 이런 일이 — 오늘의 표현: break the ice",
      subject: "오늘의 표현",
    });
    const sendAlimtalk = vi.fn().mockResolvedValue({ messageId: "m1" });
    const sendReminderEmail = vi.fn().mockResolvedValue({ id: "e1" });
    const onDualFailure = vi.fn();

    const result = await sendDailyReminders({
      findEligibleRecipients,
      buildMessageForRecipient,
      sendAlimtalk,
      sendReminderEmail,
      onDualFailure,
    });

    // Only the active user should ever reach a vendor call.
    expect(sendAlimtalk).toHaveBeenCalledTimes(1);
    expect(sendAlimtalk).toHaveBeenCalledWith(
      expect.objectContaining({ to: "01000000000" }),
    );
    expect(result.skippedOptOut).toEqual(["opted-out"]);
    expect(result.sent).toEqual(["active-user"]);
  });

  it("attempts Solapi then falls back to Resend per recipient (AC-007-1)", async () => {
    const findEligibleRecipients = vi
      .fn()
      .mockResolvedValue([makeRecipient({ userId: "user-a" })]);
    const buildMessageForRecipient = vi.fn().mockReturnValue({
      message: "본문",
      subject: "제목",
    });
    const sendAlimtalk = vi.fn().mockRejectedValue(new Error("solapi down"));
    const sendReminderEmail = vi.fn().mockResolvedValue({ id: "e1" });
    const onDualFailure = vi.fn();

    const result = await sendDailyReminders({
      findEligibleRecipients,
      buildMessageForRecipient,
      sendAlimtalk,
      sendReminderEmail,
      onDualFailure,
    });

    expect(sendAlimtalk).toHaveBeenCalledTimes(1);
    expect(sendReminderEmail).toHaveBeenCalledTimes(1);
    expect(result.sent).toEqual(["user-a"]);
    expect(onDualFailure).not.toHaveBeenCalled();
  });

  it("escalates exactly once per recipient on dual failure, without infinite retry (EC-007-B)", async () => {
    const findEligibleRecipients = vi
      .fn()
      .mockResolvedValue([makeRecipient({ userId: "user-b" })]);
    const buildMessageForRecipient = vi.fn().mockReturnValue({
      message: "본문",
      subject: "제목",
    });
    const sendAlimtalk = vi.fn().mockRejectedValue(new Error("solapi down"));
    const sendReminderEmail = vi
      .fn()
      .mockRejectedValue(new Error("resend down"));
    const onDualFailure = vi.fn().mockResolvedValue(undefined);

    const result = await sendDailyReminders({
      findEligibleRecipients,
      buildMessageForRecipient,
      sendAlimtalk,
      sendReminderEmail,
      onDualFailure,
    });

    // Exactly one call to each vendor per recipient — no retry loop.
    expect(sendAlimtalk).toHaveBeenCalledTimes(1);
    expect(sendReminderEmail).toHaveBeenCalledTimes(1);
    // Exactly one escalation call per recipient (EC-007-B — single, not unbounded).
    expect(onDualFailure).toHaveBeenCalledTimes(1);
    expect(onDualFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-b",
        alimtalkError: "solapi down",
        emailError: "resend down",
      }),
    );
    expect(result.escalated).toEqual(["user-b"]);
    expect(result.sent).toEqual([]);
  });

  it("does not let one recipient's dual failure block processing of others", async () => {
    const findEligibleRecipients = vi
      .fn()
      .mockResolvedValue([
        makeRecipient({ userId: "fails-both" }),
        makeRecipient({ userId: "succeeds", phone: "01099999999" }),
      ]);
    const buildMessageForRecipient = vi.fn().mockReturnValue({
      message: "본문",
      subject: "제목",
    });
    const sendAlimtalk = vi.fn().mockImplementation(({ to }) => {
      if (to === "01000000000") return Promise.reject(new Error("solapi down"));
      return Promise.resolve({ messageId: "m2" });
    });
    const sendReminderEmail = vi
      .fn()
      .mockRejectedValue(new Error("resend down"));
    const onDualFailure = vi.fn().mockResolvedValue(undefined);

    const result = await sendDailyReminders({
      findEligibleRecipients,
      buildMessageForRecipient,
      sendAlimtalk,
      sendReminderEmail,
      onDualFailure,
    });

    expect(result.escalated).toEqual(["fails-both"]);
    expect(result.sent).toEqual(["succeeds"]);
    expect(onDualFailure).toHaveBeenCalledTimes(1);
  });

  it("does not throw when onDualFailure hook is omitted (optional escalation hook)", async () => {
    const findEligibleRecipients = vi
      .fn()
      .mockResolvedValue([makeRecipient({ userId: "user-c" })]);
    const buildMessageForRecipient = vi.fn().mockReturnValue({
      message: "본문",
      subject: "제목",
    });
    const sendAlimtalk = vi.fn().mockRejectedValue(new Error("solapi down"));
    const sendReminderEmail = vi
      .fn()
      .mockRejectedValue(new Error("resend down"));

    const result = await sendDailyReminders({
      findEligibleRecipients,
      buildMessageForRecipient,
      sendAlimtalk,
      sendReminderEmail,
    });

    expect(result.escalated).toEqual(["user-c"]);
  });
});
