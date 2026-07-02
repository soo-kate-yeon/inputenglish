/**
 * SPEC-WEB-001 Phase 5 — Task 5.3/5.5: client-side POST helper for
 * /api/premium/question, consumed by HighlightQuestionPanel. Mirrors
 * fetch-today-session.ts's non-throwing status/body contract so 200
 * (with dailyCapNotice) is rendered rather than thrown away.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { postQuestion } from "../post-question";

describe("postQuestion", () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("POSTs to /api/premium/question with the given payload", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 200,
      json: async () => ({
        answer: "means X",
        model: "gemini-2.5-flash",
        remainingCap: 90,
        remainingDailyCap: 5,
      }),
    });

    await postQuestion({
      highlightText: "run the gamut",
      question: "what does this mean?",
      sourceType: "segment",
      sourceRef: { type: "segment", pieceId: "seg-1" },
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/premium/question",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("run the gamut"),
      }),
    );
  });

  it("returns { status, body } without throwing on a non-2xx response", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      status: 402,
      json: async () => ({ error: "Premium subscription required" }),
    });

    const result = await postQuestion({
      highlightText: "x",
      question: "y",
      sourceType: "segment",
      sourceRef: { type: "segment", pieceId: "seg-1" },
    });

    expect(result.status).toBe(402);
  });
});
