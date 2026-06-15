import { readFileSync } from "node:fs";
import path from "node:path";
import { themeToCSS } from "@framingui/ui";
import { premiumDarkTokens } from "@inputenglish/design-tokens";
import { describe, expect, it } from "vitest";
import {
  premiumAdminFramingTheme,
  premiumAdminThemeStyle,
} from "./admin-design-tokens";

describe("premium admin design token bridge", () => {
  it("exports Figma-derived premium token categories as a single source", () => {
    expect(Object.keys(premiumDarkTokens)).toEqual([
      "color",
      "typography",
      "spacing",
      "radius",
      "elevation",
    ]);
    expect(premiumDarkTokens.color.background).toBe("#000000");
    expect(premiumDarkTokens.typography.heroSize).toBeGreaterThan(
      premiumDarkTokens.typography.bodySize,
    );
    expect(premiumDarkTokens.spacing.sectionGap).toBeGreaterThan(
      premiumDarkTokens.spacing.controlGap,
    );
  });

  it("maps shared premium tokens into admin CSS variables and FramingUI component tokens", () => {
    expect(premiumAdminThemeStyle["--premium-bg"]).toBe(
      premiumDarkTokens.color.background,
    );
    expect(premiumAdminThemeStyle["--premium-card"]).toBe(
      premiumDarkTokens.color.card,
    );
    expect(premiumAdminThemeStyle["--bg-background"]).toBe(
      premiumDarkTokens.color.background,
    );
    expect(premiumAdminThemeStyle["--bg-card"]).toBe(
      premiumDarkTokens.color.card,
    );
    expect(premiumAdminThemeStyle["--text-primary"]).toBe(
      premiumDarkTokens.color.text,
    );
  });

  it("provides a FramingUI theme definition that can be converted to CSS", () => {
    const css = themeToCSS(premiumAdminFramingTheme);

    expect(css).toContain(`[data-theme="${premiumAdminFramingTheme.id}"]`);
    expect(css).toContain(
      `--bg-background: ${premiumDarkTokens.color.background};`,
    );
    expect(css).toContain(`--bg-card: ${premiumDarkTokens.color.card};`);
    expect(css).toContain(`--text-primary: ${premiumDarkTokens.color.text};`);
  });

  it("wires the premium admin page to the shared token bridge", () => {
    const pageSource = readFileSync(
      path.resolve(__dirname, "../../app/admin/premium/page.tsx"),
      "utf8",
    );

    expect(pageSource).toContain("premiumAdminThemeStyle");
    expect(pageSource).toContain("premiumAdminFramingTheme.id");
    expect(pageSource).not.toContain("premiumDarkTokens");
  });
});
