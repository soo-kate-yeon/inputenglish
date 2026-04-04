import React, { createContext, useCallback, useContext, useState } from "react";
import type { SessionListItem } from "@/lib/api";

interface SessionSheetState {
  session: SessionListItem | null;
  isPlaying: boolean;
  isExpanded: boolean;
  openSession: (session: SessionListItem) => void;
  closeSession: () => void;
  togglePlay: () => void;
  expandSheet: () => void;
  collapseSheet: () => void;
}

const SessionSheetContext = createContext<SessionSheetState | null>(null);

export function SessionSheetProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [session, setSession] = useState<SessionListItem | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const openSession = useCallback((s: SessionListItem) => {
    setSession(s);
    setIsPlaying(false); // wait for player onReady
    setIsExpanded(true);
  }, []);

  const closeSession = useCallback(() => {
    setIsPlaying(false);
    setIsExpanded(false);
    setSession(null);
  }, []);

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const expandSheet = useCallback(() => {
    setIsExpanded(true);
  }, []);

  const collapseSheet = useCallback(() => {
    setIsExpanded(false);
  }, []);

  return (
    <SessionSheetContext.Provider
      value={{
        session,
        isPlaying,
        isExpanded,
        openSession,
        closeSession,
        togglePlay,
        expandSheet,
        collapseSheet,
      }}
    >
      {children}
    </SessionSheetContext.Provider>
  );
}

export function useSessionSheet(): SessionSheetState {
  const ctx = useContext(SessionSheetContext);
  if (!ctx)
    throw new Error("useSessionSheet must be used within SessionSheetProvider");
  return ctx;
}
