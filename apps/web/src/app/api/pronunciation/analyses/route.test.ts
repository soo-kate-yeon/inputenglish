import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireApiUser = vi.fn();
const mockRequestPronunciationAnalysis = vi.fn();
const mockProcessPronunciationAnalysis = vi.fn();
const mockAfter = vi.fn();

vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return {
    ...actual,
    after: (callback: () => void | Promise<void>) => {
      mockAfter(callback);
    },
  };
});

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: (request: Request) => mockRequireApiUser(request),
}));

vi.mock("@/lib/pronunciation/service", () => ({
  requestPronunciationAnalysis: (...args: unknown[]) =>
    mockRequestPronunciationAnalysis(...args),
  processPronunciationAnalysis: (...args: unknown[]) =>
    mockProcessPronunciationAnalysis(...args),
}));

describe("POST /api/pronunciation/analyses", () => {
  beforeEach(() => {
    mockRequireApiUser.mockReset();
    mockRequestPronunciationAnalysis.mockReset();
    mockProcessPronunciationAnalysis.mockReset();
    mockAfter.mockReset();
  });

  it("returns 401 when authentication fails", async () => {
    mockRequireApiUser.mockResolvedValue(
      Response.json({ error: "Authentication required" }, { status: 401 }),
    );

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/pronunciation/analyses", {
        method: "POST",
        body: JSON.stringify({}),
      }) as never,
    );

    expect(response.status).toBe(401);
  });

  it("returns 400 for invalid payload", async () => {
    mockRequireApiUser.mockResolvedValue({ id: "user-1" });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/pronunciation/analyses", {
        method: "POST",
        body: JSON.stringify({
          recordingUrl: "not-a-url",
          referenceText: "",
        }),
      }) as never,
    );

    expect(response.status).toBe(400);
  });

  it("returns pronunciation analysis job payload", async () => {
    mockRequireApiUser.mockResolvedValue({ id: "user-1" });
    mockRequestPronunciationAnalysis.mockResolvedValue({
      analysis_id: "analysis-1",
      status: "complete",
      provider: "azure",
      provider_locale: "en-US",
      result: {
        status: "complete",
        provider: "azure",
        reference_text: "Thanks for joining us today.",
        summary: "전체 전달감은 꽤 자연스러워요.",
      },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(
      new Request("http://localhost/api/pronunciation/analyses", {
        method: "POST",
        body: JSON.stringify({
          recordingUrl: "https://cdn.example.com/test.m4a",
          referenceText: "Thanks for joining us today.",
          sentenceId: "sentence-1",
          videoId: "video-1",
          sessionId: "11111111-1111-4111-8111-111111111111",
          source: "study",
        }),
      }) as never,
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysis_id).toBe("analysis-1");
    expect(mockRequestPronunciationAnalysis).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-1",
        sentenceId: "sentence-1",
        videoId: "video-1",
        source: "study",
      }),
    );
    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockProcessPronunciationAnalysis).not.toHaveBeenCalled();
  });
});
