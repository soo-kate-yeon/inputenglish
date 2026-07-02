/**
 * SPEC-WEB-001 Phase 6 — Task 6.3: weekly prep send trigger + status tracking
 * (REQ-WEB-006-E2, AC-006-2, EC-006-B). Mirrors lib/billing/renewal.ts's
 * dependency-injection pattern — no real Solapi/Resend calls, no real Cron
 * wiring in this phase.
 */
import { describe, expect, it, vi } from "vitest";
import { sendPendingWeeklyPreps } from "../weekly-prep-send";

function makePending(id: string, userId = "user-1") {
  return { id, userId, expressions: ["build momentum", "resilient economy"] };
}

describe("sendPendingWeeklyPreps", () => {
  it("sends every pending WeeklyPrep and marks each 'sent' on success", async () => {
    const findPendingWeeklyPreps = vi
      .fn()
      .mockResolvedValue([makePending("wp-1"), makePending("wp-2")]);
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const updateSendStatus = vi.fn().mockResolvedValue(undefined);

    const result = await sendPendingWeeklyPreps({
      findPendingWeeklyPreps,
      sendNotification,
      updateSendStatus,
    });

    expect(result.succeeded).toEqual(["wp-1", "wp-2"]);
    expect(result.failed).toEqual([]);
    expect(sendNotification).toHaveBeenCalledTimes(2);
    expect(updateSendStatus).toHaveBeenCalledWith("wp-1", "sent");
    expect(updateSendStatus).toHaveBeenCalledWith("wp-2", "sent");
  });

  it("includes a snippet of key expressions in the notification message", async () => {
    const findPendingWeeklyPreps = vi
      .fn()
      .mockResolvedValue([makePending("wp-1")]);
    const sendNotification = vi.fn().mockResolvedValue(undefined);
    const updateSendStatus = vi.fn().mockResolvedValue(undefined);

    await sendPendingWeeklyPreps({
      findPendingWeeklyPreps,
      sendNotification,
      updateSendStatus,
    });

    expect(sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        message: expect.stringContaining("build momentum"),
      }),
    );
  });

  it("EC-006-B: marks a failed send as 'failed' (retry-eligible), not silently dropped", async () => {
    const findPendingWeeklyPreps = vi
      .fn()
      .mockResolvedValue([makePending("wp-1")]);
    const sendNotification = vi
      .fn()
      .mockRejectedValue(new Error("vendor unavailable"));
    const updateSendStatus = vi.fn().mockResolvedValue(undefined);

    const result = await sendPendingWeeklyPreps({
      findPendingWeeklyPreps,
      sendNotification,
      updateSendStatus,
    });

    expect(result.succeeded).toEqual([]);
    expect(result.failed).toEqual([
      { weeklyPrepId: "wp-1", error: "vendor unavailable" },
    ]);
    expect(updateSendStatus).toHaveBeenCalledWith("wp-1", "failed");
  });

  it("processes each WeeklyPrep independently — one failure does not block the rest", async () => {
    const findPendingWeeklyPreps = vi
      .fn()
      .mockResolvedValue([makePending("wp-1"), makePending("wp-2")]);
    const sendNotification = vi
      .fn()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce(undefined);
    const updateSendStatus = vi.fn().mockResolvedValue(undefined);

    const result = await sendPendingWeeklyPreps({
      findPendingWeeklyPreps,
      sendNotification,
      updateSendStatus,
    });

    expect(result.failed).toEqual([{ weeklyPrepId: "wp-1", error: "boom" }]);
    expect(result.succeeded).toEqual(["wp-2"]);
  });

  it("does not throw when even the status-update-on-failure write itself fails", async () => {
    const findPendingWeeklyPreps = vi
      .fn()
      .mockResolvedValue([makePending("wp-1")]);
    const sendNotification = vi.fn().mockRejectedValue(new Error("boom"));
    const updateSendStatus = vi
      .fn()
      .mockRejectedValue(new Error("db write failed"));

    await expect(
      sendPendingWeeklyPreps({
        findPendingWeeklyPreps,
        sendNotification,
        updateSendStatus,
      }),
    ).resolves.toEqual({
      succeeded: [],
      failed: [{ weeklyPrepId: "wp-1", error: "boom" }],
    });
  });

  it("works with no sendNotification hook supplied (Phase 7 not wired yet) — still marks sent", async () => {
    const findPendingWeeklyPreps = vi
      .fn()
      .mockResolvedValue([makePending("wp-1")]);
    const updateSendStatus = vi.fn().mockResolvedValue(undefined);

    const result = await sendPendingWeeklyPreps({
      findPendingWeeklyPreps,
      updateSendStatus,
    });

    expect(result.succeeded).toEqual(["wp-1"]);
    expect(updateSendStatus).toHaveBeenCalledWith("wp-1", "sent");
  });

  it("returns empty results when there are no pending WeeklyPreps", async () => {
    const findPendingWeeklyPreps = vi.fn().mockResolvedValue([]);
    const updateSendStatus = vi.fn();

    const result = await sendPendingWeeklyPreps({
      findPendingWeeklyPreps,
      updateSendStatus,
    });

    expect(result).toEqual({ succeeded: [], failed: [] });
    expect(updateSendStatus).not.toHaveBeenCalled();
  });
});
