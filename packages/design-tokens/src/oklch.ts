/**
 * OKLCH -> sRGB hex converter.
 *
 * Framework-agnostic (used by both React Native / Metro and Next.js). No deps.
 * The editorial-tech design system stores its palette in OKLCH; hex values are
 * DERIVED from those perceptual coordinates at module load, never hardcoded.
 */

export interface Oklch {
  /** Perceptual lightness, 0..1 */
  l: number;
  /** Chroma (0 = achromatic / pure grayscale) */
  c: number;
  /** Hue in degrees */
  h: number;
}

function gammaEncode(linear: number): number {
  const v =
    linear <= 0.0031308
      ? 12.92 * linear
      : 1.055 * Math.pow(linear, 1 / 2.4) - 0.055;
  return Math.min(1, Math.max(0, v));
}

function toHexChannel(linear: number): string {
  return Math.round(gammaEncode(linear) * 255)
    .toString(16)
    .padStart(2, "0");
}

/** Convert an OKLCH color to an sRGB `#RRGGBB` hex string. */
export function oklchToHex({ l, c, h }: Oklch): string {
  const hr = (h * Math.PI) / 180;
  const a = c * Math.cos(hr);
  const b = c * Math.sin(hr);

  // OKLab -> LMS (cube roots), then cube to linear LMS.
  const lCubed = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const mCubed = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const sCubed = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;

  // Linear LMS -> linear sRGB.
  const r =
    4.0767416621 * lCubed - 3.3077115913 * mCubed + 0.2309699292 * sCubed;
  const g =
    -1.2684380046 * lCubed + 2.6097574011 * mCubed - 0.3413193965 * sCubed;
  const bl =
    -0.0041960863 * lCubed - 0.7034186147 * mCubed + 1.707614701 * sCubed;

  return `#${toHexChannel(r)}${toHexChannel(g)}${toHexChannel(bl)}`.toUpperCase();
}
