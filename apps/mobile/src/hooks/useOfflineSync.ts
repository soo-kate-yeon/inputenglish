// @MX:NOTE: Drains offline queue when network comes back online
// @MX:SPEC: SPEC-MOBILE-007 - offline sync
import { useEffect, useRef } from "react";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { getAll, remove, markFailed } from "@/lib/offline-queue";
import { supabase } from "@/lib/supabase";

export function useOfflineSync(): void {
  const { isOnline } = useNetworkStatus();
  const prevOnline = useRef(isOnline);

  useEffect(() => {
    const justCameOnline = isOnline && !prevOnline.current;
    prevOnline.current = isOnline;

    if (!justCameOnline) return;

    void drainQueue();
  }, [isOnline]);
}

async function drainQueue(): Promise<void> {
  const items = getAll();
  for (const item of items) {
    try {
      await processItem(item.type, item.payload);
      remove(item.id);
    } catch {
      markFailed(item.id);
    }
  }
}

async function processItem(type: string, payload: unknown): Promise<void> {
  switch (type) {
    case "upsert_study_session": {
      const { error } = await supabase
        .from("study_sessions")
        .upsert(payload as object);
      if (error) throw error;
      break;
    }
    case "upsert_bookmark": {
      const { error } = await supabase
        .from("bookmarks")
        .upsert(payload as object);
      if (error) throw error;
      break;
    }
    default:
      console.warn("[OfflineSync] Unknown queue item type:", type);
  }
}
