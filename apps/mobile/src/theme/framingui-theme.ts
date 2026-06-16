/**
 * Maps the editorial-tech semantic tokens onto the @framingui/react-native
 * theme shape (createTheme), producing one resolved theme per color scheme.
 *
 * Pure grayscale (mono): blue/red defaults from FramingUI's base tokens are
 * overridden with neutral values so the whole system stays chroma-free.
 * Values are sourced from @inputenglish/design-tokens — never hardcoded here.
 *
 * The createTheme input type is `DeepPartial<typeof baseTokens>` where the base
 * tokens are `as const` (literal hex/number types). Our resolved values are
 * plain `string`/`number`, so each input object is asserted to the input type
 * once — the structure matches; only the literal-vs-widened types differ.
 */

import { createTheme } from "@framingui/react-native";
import {
  editorialTech,
  type SemanticColors,
} from "@inputenglish/design-tokens";

type CreateThemeInput = NonNullable<Parameters<typeof createTheme>[0]>;

const { neutral, brand, radius, typography } = editorialTech;

// FramingUI typography entries are { fontSize, lineHeight, fontWeight }; strip
// editorial-tech's extra letterSpacing (applied at the component layer instead).
const themeTypography = Object.fromEntries(
  Object.entries(typography).map(([key, value]) => [
    key,
    {
      fontSize: value.fontSize,
      lineHeight: value.lineHeight,
      fontWeight: value.fontWeight,
    },
  ]),
);

const themeRadius = {
  sm: radius.sm,
  md: radius.md,
  lg: radius.lg,
  full: radius.full,
};

interface ActionColors {
  primaryPressed: string;
  primaryDisabled: string;
}

function buildInput(
  id: string,
  s: SemanticColors,
  action: ActionColors,
): CreateThemeInput {
  return {
    id,
    colors: {
      background: {
        canvas: s.background.canvas,
        muted: s.background.surfaceSubtle,
        subtle: s.background.surfaceStrong,
      },
      surface: {
        base: s.background.surface,
        muted: s.background.surfaceSubtle,
        danger: s.background.surfaceSubtle,
      },
      text: {
        primary: s.text.primary,
        secondary: s.text.secondary,
        tertiary: s.text.muted,
        inverse: s.text.onBrand,
        accent: s.text.primary,
        danger: s.text.primary,
      },
      border: {
        subtle: s.background.surfaceStrong,
        default: s.border.default,
        accent: s.border.focus,
        danger: s.border.focus,
      },
      action: {
        primary: s.background.brand,
        primaryPressed: action.primaryPressed,
        primaryDisabled: action.primaryDisabled,
      },
    },
    radius: themeRadius,
    typography: themeTypography,
    // Double assertion: FramingUI's base tokens are `as const` (literal types),
    // so DeepPartial demands literals while our resolved tokens are widened
    // string/number. The structure matches exactly.
  } as unknown as CreateThemeInput;
}

export const editorialLightTheme = createTheme(
  buildInput("editorial-tech-light", editorialTech.semantic.light, {
    primaryPressed: brand[800],
    primaryDisabled: neutral[300],
  }),
);

export const editorialDarkTheme = createTheme(
  buildInput("editorial-tech-dark", editorialTech.semantic.dark, {
    primaryPressed: neutral[200],
    primaryDisabled: neutral[700],
  }),
);

export type EditorialTheme = typeof editorialLightTheme;
