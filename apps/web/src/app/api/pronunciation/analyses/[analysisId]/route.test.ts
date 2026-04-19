import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireApiUser = vi.fn();
const mockGetPronunciationAnalysisForUser = vi.fn();

vi.mock("@/utils/supabase/api-auth", () => ({
  requireApiUser: (request: Request) => mockRequireApiUser(request),
}));

vi.mock("@/lib/pronunciation/repository", () => ({
  getPronunciationAnalysisForUser: (...args: unknown[]) =>
    mockGetPronunciationAnalysisForUser(...args),
}));

describe("GET /api/pronunciation/analyses/[analysisId]", () => {
  beforeEach(() => {
    mockRequireApiUser.mockReset();
    mockGetPronunciationAnalysisForUser.mockReset();
  });

  it("returns 404 when the job does not exist", async () => {
    mockRequireApiUser.mockResolvedValue({ id: "user-1" });
    mockGetPronunciationAnalysisForUser.mockResolvedValue(null);

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/pronunciation/analyses/missing",
      ) as never,
      {
        params: Promise.resolve({ analysisId: "missing" }),
      },
    );

    expect(response.status).toBe(404);
  });

  it("returns the job payload for the authenticated user", async () => {
    mockRequireApiUser.mockResolvedValue({ id: "user-1" });
    mockGetPronunciationAnalysisForUser.mockResolvedValue({
      analysis_id: "analysis-1",
      status: "processing",
      provider: "azure",
      provider_locale: "en-US",
      result: null,
      error: null,
    });

    const { GET } = await import("./route");
    const response = await GET(
      new Request(
        "http://localhost/api/pronunciation/analyses/analysis-1",
      ) as never,
      {
        params: Promise.resolve({ analysisId: "analysis-1" }),
      },
    );

    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.analysis_id).toBe("analysis-1");
    expect(payload.status).toBe("processing");
    expect(mockGetPronunciationAnalysisForUser).toHaveBeenCalledWith(
      "analysis-1",
      "user-1",
    );
  });
});
