import { describe, expect, it } from "vitest";

describe("legacy public learning sessions API", () => {
  it("is retired in favor of the premium curation API", async () => {
    const { GET } = await import("./learning-sessions/route");
    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(410);
    expect(payload).toEqual({
      error: "Legacy learning sessions API has been retired.",
      replacement: "/api/premium/today",
    });
  });
});
