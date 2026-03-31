/**
 * Editorial Tech Theme — Pure Grayscale Mono
 *
 * Design DNA:
 * - Airy Canvas: generous padding, wide margins
 * - Typography-First: big clean headings, high legibility
 * - Pill Accents: buttons and tabs use max radius, containers stay rectilinear
 * - Pure Grayscale: zero chroma, no color tint
 */

// ── Color Palette ──

export const palette = {
  white: "#FFFFFF",
  black: "#000000",

  neutral50: "#FAFAFA",
  neutral100: "#F5F5F5",
  neutral200: "#E5E5E5",
  neutral300: "#D4D4D4",
  neutral400: "#A3A3A3",
  neutral500: "#737373",
  neutral600: "#525252",
  neutral700: "#404040",
  neutral800: "#262626",
  neutral900: "#171717",
  neutral950: "#0A0A0A",
} as const;

// ── Semantic Colors ──

export const colors = {
  // Backgrounds
  bg: palette.white,
  bgSubtle: palette.neutral50,
  bgMuted: palette.neutral100,
  bgInverse: palette.neutral950,
  bgBrand: palette.neutral950,

  // Text
  text: palette.neutral950,
  textSecondary: palette.neutral500,
  textMuted: palette.neutral400,
  textInverse: palette.white,

  // Borders
  border: palette.neutral200,
  borderStrong: palette.neutral300,
  borderFocus: palette.neutral900,

  // Interactive
  primary: palette.neutral950,
  primaryHover: palette.neutral800,
  disabled: palette.neutral300,

  // Status (keep functional colors)
  success: "#22C55E",
  successBg: "#F0FDF4",
  error: "#EF4444",
  errorBg: "#FEF2F2",
  warning: "#EAB308",
  warningBg: "#FEFCE8",
  info: "#3B82F6",
  infoBg: "#EFF6FF",
} as const;

// ── Spacing (generous, airy) ──

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  "2xl": 48,
  "3xl": 64,
} as const;

// ── Radius ──
// Pill for buttons/tabs/badges, rectilinear for containers

export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  "2xl": 24,
  pill: 9999,
} as const;

// ── Typography ──

export const font = {
  weight: {
    regular: "400" as const,
    medium: "500" as const,
    semibold: "600" as const,
    bold: "700" as const,
  },
  size: {
    xs: 10,
    sm: 12,
    md: 14,
    base: 16,
    lg: 18,
    xl: 20,
    "2xl": 24,
    "3xl": 32,
    "4xl": 40,
  },
  lineHeight: {
    tight: 1.2,
    normal: 1.5,
    relaxed: 1.6,
  },
} as const;

// ── Shadows (subtle, real) ──

export const shadow = {
  sm: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  md: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  lg: {
    shadowColor: palette.black,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 15,
    elevation: 6,
  },
} as const;

// ── Convenience re-export ──

const theme = { palette, colors, spacing, radius, font, shadow } as const;
export default theme;
