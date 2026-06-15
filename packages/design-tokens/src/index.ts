export const premiumDarkTokens = {
  color: {
    background: "#000000",
    backgroundSubtle: "#0E0E0A",
    card: "rgba(255,255,255,0.07)",
    cardStrong: "rgba(255,255,255,0.12)",
    control: "rgba(229,234,238,0.15)",
    overlay: "rgba(0,0,0,0.78)",
    text: "#E5EAEE",
    textSecondary: "rgba(229,234,238,0.72)",
    textMuted: "rgba(229,234,238,0.45)",
    border: "rgba(229,234,238,0.14)",
  },
  typography: {
    heroSize: 44,
    titleSize: 36,
    bodySize: 17,
    captionSize: 13,
    lineHeightTight: 1.2,
    lineHeightRelaxed: 1.6,
  },
  spacing: {
    cardPadding: 24,
    sectionGap: 32,
    controlGap: 8,
  },
  radius: {
    card: 24,
    panel: 16,
    control: 9999,
  },
  elevation: {
    premiumCard: {
      shadowOpacity: 0.08,
      shadowRadius: 16,
      elevation: 6,
    },
  },
} as const;

export type PremiumDarkTokens = typeof premiumDarkTokens;
