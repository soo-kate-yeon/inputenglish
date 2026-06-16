/**
 * App-level theme orchestration on top of @framingui/react-native.
 *
 * FramingUI's ThemeProvider takes a single static theme, so this layer adds:
 *  - light/dark resolution from the OS color scheme + a user override
 *  - persistence of the override via MMKV
 *  - an immersive variant that forces dark (learning/session surfaces)
 *
 * Screens read tokens with `useTheme()` and toggle with `useThemeMode()`.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useColorScheme } from "react-native";
import { ThemeProvider as FramingThemeProvider } from "@framingui/react-native";
import { MMKV } from "react-native-mmkv";
import type { SchemeName } from "@inputenglish/design-tokens";
import { editorialDarkTheme, editorialLightTheme } from "./framingui-theme";

export type ThemeMode = "system" | "light" | "dark";

const STORAGE_KEY = "theme-mode";
const storage = new MMKV({ id: "theme" });

function readInitialMode(): ThemeMode {
  const stored = storage.getString(STORAGE_KEY);
  return stored === "light" || stored === "dark" || stored === "system"
    ? stored
    : "system";
}

interface ThemeModeContextValue {
  /** The user's preference: follow system, or a forced scheme. */
  mode: ThemeMode;
  /** The resolved scheme actually in effect right now. */
  scheme: SchemeName;
  setMode: (mode: ThemeMode) => void;
}

const ThemeModeContext = createContext<ThemeModeContextValue | undefined>(
  undefined,
);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>(readInitialMode);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    storage.set(STORAGE_KEY, next);
  }, []);

  const scheme: SchemeName =
    mode === "system" ? (systemScheme === "dark" ? "dark" : "light") : mode;
  const theme = scheme === "dark" ? editorialDarkTheme : editorialLightTheme;

  const value = useMemo<ThemeModeContextValue>(
    () => ({ mode, scheme, setMode }),
    [mode, scheme, setMode],
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <FramingThemeProvider theme={theme}>{children}</FramingThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export function useThemeMode(): ThemeModeContextValue {
  const ctx = useContext(ThemeModeContext);
  if (!ctx) {
    throw new Error("useThemeMode must be used within an AppThemeProvider");
  }
  return ctx;
}

/**
 * Forces the dark editorial theme regardless of the app's mode. Wrap immersive
 * learning surfaces (the session player) so they stay dark like the reference.
 */
export function ImmersiveThemeProvider({ children }: { children: ReactNode }) {
  return (
    <FramingThemeProvider theme={editorialDarkTheme}>
      {children}
    </FramingThemeProvider>
  );
}

export { useTheme } from "@framingui/react-native";
