import { editorialDarkTheme, editorialLightTheme } from "../framingui-theme";

/** Returns true when a #RRGGBB color is achromatic (R === G === B). */
function isGrayscale(hex: string): boolean {
  const m = /^#([0-9A-F]{2})([0-9A-F]{2})([0-9A-F]{2})$/i.exec(hex);
  if (!m) return false;
  return m[1] === m[2] && m[2] === m[3];
}

function collectColors(value: unknown, out: string[]): void {
  if (typeof value === "string") {
    if (/^#[0-9A-F]{6}$/i.test(value)) out.push(value);
    return;
  }
  if (value && typeof value === "object") {
    for (const v of Object.values(value)) collectColors(v, out);
  }
}

describe("editorial-tech React Native theme", () => {
  it("resolves a blank white canvas with dark ink in light scheme", () => {
    expect(editorialLightTheme.colors.background.canvas).toBe("#FFFFFF");
    expect(editorialLightTheme.colors.text.primary).toBe("#030303"); // neutral 950
    expect(editorialLightTheme.colors.action.primary).toBe("#030303"); // brand 950
    expect(editorialLightTheme.colors.text.inverse).toBe("#FFFFFF");
  });

  it("inverts to a near-black canvas with light ink in dark scheme", () => {
    expect(editorialDarkTheme.colors.background.canvas).toBe("#000000");
    expect(editorialDarkTheme.colors.text.primary).toBe("#FCFCFC"); // neutral 50
    expect(editorialDarkTheme.colors.action.primary).toBe("#FCFCFC"); // light-on-dark
    expect(editorialDarkTheme.colors.text.inverse).toBe("#030303");
  });

  it("is pure grayscale (zero chroma) in both schemes", () => {
    for (const theme of [editorialLightTheme, editorialDarkTheme]) {
      const colors: string[] = [];
      collectColors(theme.colors, colors);
      expect(colors.length).toBeGreaterThan(0);
      for (const color of colors) {
        expect(isGrayscale(color)).toBe(true);
      }
    }
  });

  it("exposes a pill radius for editorial pill accents", () => {
    expect(editorialLightTheme.radius.full).toBe(999);
  });
});
