/**
 * Editorial Tech design tokens (single source of truth).
 *
 * Atomic OKLCH values are copied verbatim from the FramingUI theme
 * `editorial-tech` (brandTone "mono", schema v2.1). Design DNA: pure grayscale
 * (zero chroma), airy canvas, typography-first hierarchy, pill accents
 * (buttons + tabs use max radius, containers stay rectilinear).
 *
 * Hex values are DERIVED from the OKLCH source via {@link oklchToHex} — never
 * hardcoded. Shared by the mobile app (now) and the admin app (later).
 */

import { oklchToHex, type Oklch } from "./oklch";

// --- Atomic OKLCH source (verbatim from editorial-tech.json) -----------------

const NEUTRAL_OKLCH = {
  50: { l: 0.99, c: 0, h: 0 },
  100: { l: 0.96, c: 0, h: 0 },
  200: { l: 0.92, c: 0, h: 0 },
  300: { l: 0.86, c: 0, h: 0 },
  400: { l: 0.74, c: 0, h: 0 },
  500: { l: 0.55, c: 0, h: 0 },
  600: { l: 0.4, c: 0, h: 0 },
  700: { l: 0.3, c: 0, h: 0 },
  800: { l: 0.22, c: 0, h: 0 },
  900: { l: 0.15, c: 0, h: 0 },
  950: { l: 0.1, c: 0, h: 0 },
} as const satisfies Record<number, Oklch>;

const BRAND_OKLCH = {
  50: { l: 0.98, c: 0, h: 0 },
  100: { l: 0.96, c: 0, h: 0 },
  200: { l: 0.9, c: 0, h: 0 },
  300: { l: 0.82, c: 0, h: 0 },
  400: { l: 0.7, c: 0, h: 0 },
  500: { l: 0.55, c: 0, h: 0 },
  600: { l: 0.4, c: 0, h: 0 },
  700: { l: 0.3, c: 0, h: 0 },
  800: { l: 0.22, c: 0, h: 0 },
  900: { l: 0.15, c: 0, h: 0 },
  950: { l: 0.1, c: 0, h: 0 },
} as const satisfies Record<number, Oklch>;

function resolveRamp<T extends Record<string, Oklch>>(
  src: T,
): {
  [K in keyof T]: string;
} {
  const entries = Object.entries(src).map(
    ([key, value]) => [key, oklchToHex(value)] as const,
  );
  return Object.fromEntries(entries) as { [K in keyof T]: string };
}

/** Neutral grayscale ramp (50..950) plus pure white/black. */
export const neutral = {
  ...resolveRamp(NEUTRAL_OKLCH),
  white: oklchToHex({ l: 1, c: 0, h: 0 }),
  black: oklchToHex({ l: 0, c: 0, h: 0 }),
} as const;

/** Brand ramp — identical hue family (mono); slightly different lightness steps. */
export const brand = resolveRamp(BRAND_OKLCH);

// --- Scales ------------------------------------------------------------------

/**
 * Spacing in px. editorial-tech atomic spacing is rem-based (1rem = 16px),
 * extended here with small steps for native component padding. "Airy Canvas".
 */
export const spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  12: 48,
  16: 64,
  20: 80,
  24: 96,
  32: 128,
} as const;

/**
 * Radius in px. Pill accents: buttons + tabs = `full`; inputs = `lg`
 * (rounded-xl); cards = `xl` (rounded-2xl, 1.5rem); everything else rectilinear.
 */
export const radius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 24,
  full: 999,
} as const;

/** Typography scale. "Typography-First Hierarchy": big clean headings. */
export const typography = {
  display: {
    fontSize: 36,
    lineHeight: 42,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  sectionTitle: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: "600",
    letterSpacing: -0.2,
  },
  body: { fontSize: 16, lineHeight: 24, fontWeight: "400", letterSpacing: 0 },
  bodyStrong: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: "600",
    letterSpacing: 0,
  },
  button: { fontSize: 16, lineHeight: 20, fontWeight: "600", letterSpacing: 0 },
  label: { fontSize: 14, lineHeight: 20, fontWeight: "500", letterSpacing: 0 },
  caption: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "400",
    letterSpacing: 0,
  },
} as const;

// --- Semantic tokens (light + derived dark) ----------------------------------

export interface SemanticColors {
  background: {
    canvas: string;
    surface: string;
    surfaceSubtle: string;
    surfaceStrong: string;
    brand: string;
    brandSubtle: string;
  };
  border: {
    default: string;
    input: string;
    focus: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverted: string;
    onBrand: string;
  };
}

/** Light scheme — editorial-tech defaults (blank white canvas, dark ink). */
export const semanticLight: SemanticColors = {
  background: {
    canvas: neutral.white,
    surface: neutral.white,
    surfaceSubtle: neutral[50],
    surfaceStrong: neutral[100],
    brand: brand[950],
    brandSubtle: brand[50],
  },
  border: {
    default: neutral[200],
    input: neutral[300],
    focus: neutral[900],
  },
  text: {
    primary: neutral[950],
    secondary: neutral[500],
    muted: neutral[400],
    inverted: neutral.white,
    onBrand: neutral.white,
  },
};

/**
 * Dark scheme — derived by inverting the same grayscale ramp (pure mono, no
 * chroma introduced). The primary/brand action flips to light-on-dark.
 */
export const semanticDark: SemanticColors = {
  background: {
    canvas: neutral.black,
    surface: neutral[950],
    surfaceSubtle: neutral[900],
    surfaceStrong: neutral[800],
    brand: neutral[50],
    brandSubtle: neutral[900],
  },
  border: {
    default: neutral[800],
    input: neutral[700],
    focus: neutral[100],
  },
  text: {
    primary: neutral[50],
    secondary: neutral[400],
    muted: neutral[500],
    inverted: neutral[950],
    onBrand: neutral[950],
  },
};

export type SchemeName = "light" | "dark";

export const editorialTech = {
  neutral,
  brand,
  spacing,
  radius,
  typography,
  semantic: { light: semanticLight, dark: semanticDark },
} as const;

export type EditorialTechTokens = typeof editorialTech;

/**
 * Media overlay tokens — scheme-independent translucent scrims used on top
 * of images. These are intentionally fixed rgba values (not theme-dependent)
 * because they must work on arbitrary photo backgrounds.
 */
export const mediaOverlay = {
  badge: "rgba(0,0,0,0.42)",
  onImageText: "rgba(255,255,255,0.86)",
  gradientTop: "rgba(0,0,0,0.04)",
  gradientMid: "rgba(0,0,0,0.18)",
  gradientBottom: "rgba(0,0,0,0.82)",
  scrim: "rgba(0,0,0,0.4)",
} as const;
