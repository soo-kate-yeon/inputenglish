import { premiumDarkTokens } from "@inputenglish/design-tokens";
import theme, { colors, font, radius, shadow, spacing } from "@/theme";

describe("premium mobile theme tokens", () => {
  it("bridges premium RN theme values to the shared design-token package", () => {
    expect(theme.premiumTheme.colors).toBe(premiumDarkTokens.color);
    expect(theme.premiumTheme.typography).toBe(premiumDarkTokens.typography);
    expect(theme.premiumTheme.spacing).toBe(premiumDarkTokens.spacing);
    expect(theme.premiumTheme.radius).toBe(premiumDarkTokens.radius);
    expect(theme.premiumTheme.elevation).toBe(premiumDarkTokens.elevation);

    expect(colors.textPremium).toBe(premiumDarkTokens.color.text);
    expect(colors.bgPremiumCard).toBe(premiumDarkTokens.color.card);
    expect(colors.borderPremium).toBe(premiumDarkTokens.color.border);
    expect(spacing.lg).toBe(premiumDarkTokens.spacing.cardPadding);
    expect(spacing.xl).toBe(premiumDarkTokens.spacing.sectionGap);
    expect(radius["2xl"]).toBe(premiumDarkTokens.radius.card);
    expect(radius.xl).toBe(premiumDarkTokens.radius.panel);
    expect(font.size["4xl"]).toBe(premiumDarkTokens.typography.heroSize);
    expect(font.size["3xl"]).toBe(premiumDarkTokens.typography.titleSize);
    expect(shadow.lg).toEqual(
      expect.objectContaining(premiumDarkTokens.elevation.premiumCard),
    );
  });
});
