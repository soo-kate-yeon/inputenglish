import { describe, expect, it } from "vitest";
import { normalizePremiumAdminFailure } from "./admin-publish-status";

describe("normalizePremiumAdminFailure", () => {
  it("preserves publish issues as an actionable list", () => {
    expect(
      normalizePremiumAdminFailure(
        {
          error: "Premium session is not publishable",
          issues: [
            "article is not reviewed",
            "expression cards are not fully reviewed",
          ],
        },
        "Publish failed",
      ),
    ).toEqual({
      message: "Premium session is not publishable",
      issues: [
        "article is not reviewed",
        "expression cards are not fully reviewed",
      ],
    });
  });

  it("drops malformed issue entries and falls back to a useful message", () => {
    expect(
      normalizePremiumAdminFailure(
        { error: "", issues: ["roleplay is not reviewed", 404, null] },
        "Publish failed",
      ),
    ).toEqual({
      message: "Publish failed",
      issues: ["roleplay is not reviewed"],
    });
  });
});
