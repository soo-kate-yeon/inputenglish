jest.mock("../lib/supabase", () => ({
  supabase: {
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: null },
      }),
    },
  },
}));

jest.mock("expo-device", () => ({
  isDevice: false,
}));

describe("ai-api simulator bypass", () => {
  it("returns a completed pronunciation job without auth on simulator", async () => {
    const { requestPronunciationAnalysis } = require("../lib/ai-api");

    const job = await requestPronunciationAnalysis({
      recordingUrl: "data:audio/m4a;base64,AAAA",
      referenceText: "Let me walk you through the update.",
      sentenceId: "sentence-1",
      videoId: "video-1",
      sessionId: "session-1",
      source: "daily-input",
    });

    expect(job.status).toBe("complete");
    expect(job.provider).toBe("azure");
    expect(job.analysis_id.startsWith("simulator-sentence-1-")).toBe(true);
    expect(job.result?.overall_score).toBe(84);
  });
});
