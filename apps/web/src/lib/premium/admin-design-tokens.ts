import type { CSSProperties } from "react";
import type { ThemeDefinition } from "@framingui/ui";
import { premiumDarkTokens } from "@inputenglish/design-tokens";

type PremiumCssVariables = CSSProperties & Record<`--${string}`, string>;

const color = premiumDarkTokens.color;
const spacing = premiumDarkTokens.spacing;
const radius = premiumDarkTokens.radius;

export const premiumAdminFramingTheme = {
  id: "inputenglish-premium-dark",
  name: "InputEnglish Premium Dark",
  schemaVersion: "1.0.0",
  tokens: {
    atomic: {
      color: {
        neutral: {
          50: { l: 0.96, c: 0.01, h: 250 },
          100: { l: 0.9, c: 0.01, h: 250 },
          400: { l: 0.65, c: 0.01, h: 250 },
          500: { l: 0.55, c: 0.01, h: 250 },
          900: { l: 0.15, c: 0.01, h: 250 },
          white: { l: 1, c: 0, h: 0 },
        },
        white: { l: 1, c: 0, h: 0 },
      },
      spacing: {
        premiumControlGap: `${spacing.controlGap}px`,
        premiumCardPadding: `${spacing.cardPadding}px`,
        premiumSectionGap: `${spacing.sectionGap}px`,
      },
      radius: {
        premiumPanel: `${radius.panel}px`,
        premiumCard: `${radius.card}px`,
        premiumControl: `${radius.control}px`,
      },
    },
    semantic: {
      background: {
        canvas: color.background,
        surface: {
          subtle: color.backgroundSubtle,
          default: color.card,
          emphasis: color.cardStrong,
        },
        brand: {
          subtle: color.control,
          default: color.text,
          emphasis: color.textSecondary,
        },
      },
      border: {
        default: {
          subtle: color.border,
          default: color.border,
          emphasis: color.textMuted,
        },
      },
      text: {
        primary: color.text,
        secondary: color.textSecondary,
        muted: color.textMuted,
      },
    },
  },
  stateLayer: {
    hover: { opacity: 0.08 },
    disabled: { opacity: 0.42, contentOpacity: 0.38 },
  },
  typography: {
    fontFamily: {
      sans: "Pretendard, system-ui, sans-serif",
      mono: 'ui-monospace, "SFMono-Regular", monospace',
    },
    fontWeight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },
} satisfies ThemeDefinition;

export const premiumAdminThemeStyle: PremiumCssVariables = {
  "--premium-bg": color.background,
  "--premium-card": color.card,
  "--premium-card-strong": color.cardStrong,
  "--premium-control": color.control,
  "--premium-text": color.text,
  "--premium-text-secondary": color.textSecondary,
  "--premium-text-muted": color.textMuted,
  "--premium-border": color.border,

  "--bg-background": color.background,
  "--bg-foreground": color.text,
  "--bg-card": color.card,
  "--bg-card-foreground": color.text,
  "--bg-popover": color.cardStrong,
  "--bg-popover-foreground": color.text,
  "--bg-primary": color.text,
  "--bg-primary-foreground": color.background,
  "--bg-secondary": color.control,
  "--bg-secondary-foreground": color.text,
  "--bg-muted": color.card,
  "--bg-muted-foreground": color.textSecondary,
  "--bg-accent": color.cardStrong,
  "--bg-accent-foreground": color.text,
  "--border-default": color.border,
  "--border-input": color.border,
  "--border-ring": color.textSecondary,
  "--border-border": color.border,
  "--border-primary": color.text,

  "--bg-canvas": color.background,
  "--bg-surface": color.card,
  "--text-primary": color.text,
  "--text-secondary": color.textSecondary,
  "--text-tertiary": color.textMuted,
  "--text-foreground": color.text,
  "--text-card-foreground": color.text,
  "--text-popover-foreground": color.text,
  "--text-muted-foreground": color.textSecondary,
  "--text-link": color.text,
  "--action-primary": color.text,
  "--action-primary-text": color.background,
  "--border-emphasis": color.textMuted,
};
