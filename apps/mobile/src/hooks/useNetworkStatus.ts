// @MX:NOTE: React hook wrapping network-monitor for component consumption
// @MX:SPEC: SPEC-MOBILE-007 - offline support
import { useState, useEffect, useRef } from "react";
import {
  getNetworkState,
  addNetworkListener,
  removeNetworkListener,
  type NetworkState,
} from "@/lib/network-monitor";

export interface NetworkStatus {
  isOnline: boolean;
  isConnected: boolean;
}

// How long to wait before confirming offline — prevents false positives on app foreground
const OFFLINE_DEBOUNCE_MS = 3000;

function isStateOnline(s: NetworkState): boolean {
  return (
    s.isConnected &&
    (s.isInternetReachable === null || s.isInternetReachable === true)
  );
}

export function useNetworkStatus(): NetworkStatus {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: null,
  });
  const offlineTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingOffline = useRef<NetworkState | null>(null);

  useEffect(() => {
    let mounted = true;

    getNetworkState().then((s) => {
      if (mounted) setState(s);
    });

    const listener = (s: NetworkState) => {
      if (!mounted) return;

      if (isStateOnline(s)) {
        // Going online: cancel any pending offline transition and apply immediately
        if (offlineTimer.current) {
          clearTimeout(offlineTimer.current);
          offlineTimer.current = null;
          pendingOffline.current = null;
        }
        setState(s);
      } else {
        // Going offline: debounce to avoid false positives when returning to foreground
        pendingOffline.current = s;
        if (!offlineTimer.current) {
          offlineTimer.current = setTimeout(() => {
            if (mounted && pendingOffline.current) {
              setState(pendingOffline.current);
            }
            offlineTimer.current = null;
            pendingOffline.current = null;
          }, OFFLINE_DEBOUNCE_MS);
        }
      }
    };

    addNetworkListener(listener);
    return () => {
      mounted = false;
      if (offlineTimer.current) clearTimeout(offlineTimer.current);
      removeNetworkListener(listener);
    };
  }, []);

  return { isOnline: isStateOnline(state), isConnected: state.isConnected };
}
