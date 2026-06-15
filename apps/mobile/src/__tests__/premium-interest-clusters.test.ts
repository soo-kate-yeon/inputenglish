import { inferPremiumPreferredSourceTypes } from "@/lib/premium-interest-clusters";

describe("premium interest clusters", () => {
  it("maps onboarding situations and genres to source type preferences", () => {
    expect(
      inferPremiumPreferredSourceTypes({
        situations: ["school-work", "presentation-meeting"],
        genres: ["business"],
      }),
    ).toEqual(["public-speech", "interview", "podcast", "keynote", "demo"]);
  });
});
