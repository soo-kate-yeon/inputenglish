import {
  clearPremiumSessionProgress,
  getPremiumSessionProgress,
  markPremiumSessionCompleted,
  markPremiumSessionInProgress,
} from "@/lib/premium-session-progress";

describe("premium session progress", () => {
  const sessionId = "premium-session-1";

  beforeEach(() => {
    clearPremiumSessionProgress(sessionId);
  });

  it("records an in-progress session step", () => {
    markPremiumSessionInProgress(
      sessionId,
      "content-catch",
      new Date("2026-06-14T00:00:00.000Z"),
    );

    expect(getPremiumSessionProgress(sessionId)).toEqual({
      sessionId,
      status: "in-progress",
      lastStep: "content-catch",
      savedExpressionCount: 0,
      updatedAt: "2026-06-14T00:00:00.000Z",
      completedAt: null,
    });
  });

  it("does not downgrade completed sessions back to paused", () => {
    markPremiumSessionCompleted(
      sessionId,
      2,
      new Date("2026-06-14T00:10:00.000Z"),
    );
    markPremiumSessionInProgress(
      sessionId,
      "article",
      new Date("2026-06-14T00:11:00.000Z"),
    );

    expect(getPremiumSessionProgress(sessionId)).toMatchObject({
      status: "completed",
      lastStep: "completion",
      savedExpressionCount: 2,
      completedAt: "2026-06-14T00:10:00.000Z",
    });
  });
});
