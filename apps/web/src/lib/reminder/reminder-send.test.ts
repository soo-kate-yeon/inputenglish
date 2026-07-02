/**
 * TDD tests for Task 7.1 — reminder-send fallback orchestrator (SPEC-WEB-001 Phase 7)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Covers AC-007-1: attempts Solapi 알림톡 first; on failure, falls back to
 * Resend email. Both vendor calls are injected (no direct import of the
 * concrete vendor clients), so this module never performs live network I/O.
 */
import { describe, expect, it, vi } from "vitest";
import { sendReminder } from "./reminder-send";

function makeRecipient() {
  return {
    userId: "user-1",
    phone: "01000000000",
    email: "user@example.com",
  };
}

describe("sendReminder", () => {
  it("sends via Solapi alimtalk when it succeeds, without calling Resend", async () => {
    const sendAlimtalk = vi.fn().mockResolvedValue({ messageId: "m1" });
    const sendReminderEmail = vi.fn().mockResolvedValue({ id: "e1" });

    const result = await sendReminder(
      {
        recipient: makeRecipient(),
        message: "오늘 BBC에서 이런 일이",
        subject: "오늘의 표현",
      },
      { sendAlimtalk, sendReminderEmail },
    );

    expect(sendAlimtalk).toHaveBeenCalledTimes(1);
    expect(sendReminderEmail).not.toHaveBeenCalled();
    expect(result).toEqual({ channel: "alimtalk", success: true });
  });

  it("falls back to Resend email when Solapi alimtalk fails (AC-007-1)", async () => {
    const sendAlimtalk = vi.fn().mockRejectedValue(new Error("solapi down"));
    const sendReminderEmail = vi.fn().mockResolvedValue({ id: "e1" });

    const result = await sendReminder(
      {
        recipient: makeRecipient(),
        message: "오늘 BBC에서 이런 일이",
        subject: "오늘의 표현",
      },
      { sendAlimtalk, sendReminderEmail },
    );

    expect(sendAlimtalk).toHaveBeenCalledTimes(1);
    expect(sendReminderEmail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ channel: "email", success: true });
  });

  it("reports both-failed when Solapi and Resend both fail", async () => {
    const sendAlimtalk = vi.fn().mockRejectedValue(new Error("solapi down"));
    const sendReminderEmail = vi
      .fn()
      .mockRejectedValue(new Error("resend down"));

    const result = await sendReminder(
      {
        recipient: makeRecipient(),
        message: "오늘 BBC에서 이런 일이",
        subject: "오늘의 표현",
      },
      { sendAlimtalk, sendReminderEmail },
    );

    expect(result).toEqual({
      channel: "none",
      success: false,
      alimtalkError: "solapi down",
      emailError: "resend down",
    });
  });

  it("skips alimtalk and goes straight to email when recipient has no phone", async () => {
    const sendAlimtalk = vi.fn().mockResolvedValue({ messageId: "m1" });
    const sendReminderEmail = vi.fn().mockResolvedValue({ id: "e1" });

    const result = await sendReminder(
      {
        recipient: {
          userId: "user-2",
          phone: null,
          email: "user2@example.com",
        },
        message: "오늘 BBC에서 이런 일이",
        subject: "오늘의 표현",
      },
      { sendAlimtalk, sendReminderEmail },
    );

    expect(sendAlimtalk).not.toHaveBeenCalled();
    expect(sendReminderEmail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ channel: "email", success: true });
  });
});
