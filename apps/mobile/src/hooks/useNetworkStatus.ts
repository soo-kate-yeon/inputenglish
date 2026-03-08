// @MX:NOTE: React hook wrapping network-monitor for component consumption
// @MX:SPEC: SPEC-MOBILE-007 - offline support
import { useState, useEffect } from "react";
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

export function useNetworkStatus(): NetworkStatus {
  const [state, setState] = useState<NetworkState>({
    isConnected: true,
    isInternetReachable: null,
  });

  useEffect(() => {
    let mounted = true;

    getNetworkState().then((s) => {
      if (mounted) setState(s);
    });

    const listener = (s: NetworkState) => {
      if (mounted) setState(s);
    };

    addNetworkListener(listener);
    return () => {
      mounted = false;
      removeNetworkListener(listener);
    };
  }, []);

  const isOnline =
    state.isConnected &&
    (state.isInternetReachable === null || state.isInternetReachable === true);

  return { isOnline, isConnected: state.isConnected };
}
