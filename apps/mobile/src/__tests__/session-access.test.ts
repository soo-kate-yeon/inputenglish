import { getSessionPressDestination } from "../lib/session-access";

describe("getSessionPressDestination", () => {
  const baseSession = {
    id: "session-1",
    source_video_id: "video-1",
    premium_required: false,
  };

  it("returns the study route for non-premium sessions", () => {
    expect(getSessionPressDestination(baseSession, "FREE")).toBe(
      "/study/video-1?sessionId=session-1",
    );
  });

  it("returns the paywall for premium sessions on FREE plan", () => {
    expect(
      getSessionPressDestination(
        { ...baseSession, premium_required: true },
        "FREE",
      ),
    ).toBe("/paywall");
  });

  it("returns the study route for premium sessions on PREMIUM plan", () => {
    expect(
      getSessionPressDestination(
        { ...baseSession, premium_required: true },
        "PREMIUM",
      ),
    ).toBe("/study/video-1?sessionId=session-1");
  });
});
