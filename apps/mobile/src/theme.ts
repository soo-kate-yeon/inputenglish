/**
 * Podcast Ambient Theme — Calm Neutral
 *
 * Design DNA:
 * - Thumbnail-Driven: large imagery, ambient playback mood
 * - Calm Tone: warm neutrals, soft contrasts
 * - Crisp White: clean list views, clear hierarchy
 * - Neutral Controls: understated interactive elements
 */

import { Platform } from "react-native";

// -- Color Palette --

export const palette = {
  white: "#FFFFFF",
  black: "#000000",

  // Warm neutrals (slight warm undertone vs pure gray)
  neutral50: "#FAFAF8",
  neutral100: "#F5F5F2",
  neutral200: "#E8E8E4",
  neutral300: "#D6D6D0",
  neutral400: "#A8A8A0",
  neutral500: "#78786F",
  neutral600: "#56564E",
  neutral700: "#3E3E38",
  neutral800: "#28281F",
  neutral900: "#1A1A14",
  neutral950: "#0E0E0A",
} as const;

// -- Semantic Colors --

export const colors = {
  // Backgrounds
  bg: palette.white,
  bgSubtle: palette.neutral50,
  bgMuted: palette.neutral100,
  bgInverse: palette.neutral900,
  bgBrand: palette.neutral900,
  bgDark: palette.black,
  bgDarkSubtle: palette.neutral950,
  bgDarkMuted: palette.neutral900,

  // Text
  text: palette.neutral900,
  textSecondary: palette.neutral500,
  textMuted: palette.neutral400,
  textInverse: palette.white,
  textOnDark: palette.white,
  textOnDarkSecondary: "rgba(255,255,255,0.72)",
  textOnDarkMuted: "rgba(255,255,255,0.45)",

  // Borders
  border: palette.neutral200,
  borderStrong: palette.neutral300,
  borderFocus: palette.neutral700,
  borderOnDark: "rgba(255,255,255,0.12)",
  borderOnDarkStrong: "rgba(255,255,255,0.22)",

  // Interactive
  primary: palette.neutral900,
  primaryHover: palette.neutral700,
  disabled: palette.neutral300,

  // Ambient accent (warm muted tone for featured/player)
  accent: "#5C6B5E",
  accentLight: "#E8EDE9",
  accentMuted: "#8A9B8C",

  // Status
  success: "#4CAF6A",
  successBg: "#F0FAF2",
  error: "#D9534F",
  errorBg: "#FDF2F2",
  warning: "#D4A843",
  warningBg: "#FBF8EF",
  info: "#5B8DBF",
  infoBg: "#F0F5FA",
} as const;

// -- Spacing --

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

// -- Radius --

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  pill: 9999,
} as const;

// -- Typography --

export const font = {
  family: {
    system: undefined as string | undefined,
    mono: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
  },
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
  size: {
    xs: 11,
    sm: 13,
    md: 15,
    base: 17,
    lg: 20,
    xl: 22,
    "2xl": 28,
    "3xl": 36,
    "4xl": 44,
  },
  tracking: {
    tight: -0.3,
    semiTight: -0.2,
    normal: 0,
    wide: 0.3,
    wider: 1.2,
    widest: 2.4,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
    loose: 1.75,
  },
} as const;

/**
 * Compute absolute line height in pixels from a size token and ratio.
 * React Native requires numeric line heights, so we round to integers.
 */
export function leading(
  size: number,
  ratio: number = font.lineHeight.normal,
): number {
  return Math.round(size * ratio);
}

// -- Shadows (soft, ambient) --

export const shadow = {
  sm: {
    shadowColor: palette.neutral950,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  md: {
    shadowColor: palette.neutral950,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  lg: {
    shadowColor: palette.neutral950,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
} as const;

// -- Convenience re-export --

const theme = { palette, colors, spacing, radius, font, shadow } as const;
export default theme;
