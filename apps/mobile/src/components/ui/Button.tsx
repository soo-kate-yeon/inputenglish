/**
 * Pill button — editorial-tech's core "Pill Accents" decision.
 *
 * FramingUI's Button bakes in `radius.md`, so this thin wrapper injects the
 * pill radius (radius.full) from the active theme. It applies the pill first
 * and the caller's `style` last, so overrides still win. No hardcoded values.
 */

import type { ComponentProps } from "react";
import { Button as FramingButton, useTheme } from "@framingui/react-native";

type ButtonProps = ComponentProps<typeof FramingButton>;

export function Button({ style, ...props }: ButtonProps) {
  const theme = useTheme();
  return (
    <FramingButton
      {...props}
      style={[{ borderRadius: theme.radius.full }, style]}
    />
  );
}

export type { ButtonProps };
