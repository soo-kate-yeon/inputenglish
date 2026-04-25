import React, { createContext, useContext } from "react";

interface ShortsUIContextValue {
  scriptVisible: boolean;
  showTranslation: boolean;
}

const ShortsUIContext = createContext<ShortsUIContextValue>({
  scriptVisible: false,
  showTranslation: false,
});

export const ShortsUIProvider = ShortsUIContext.Provider;

export function useShortsUI(): ShortsUIContextValue {
  return useContext(ShortsUIContext);
}
