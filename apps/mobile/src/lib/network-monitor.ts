// @MX:ANCHOR: network-monitor - centralized NetInfo wrapper for offline detection
// @MX:REASON: [AUTO] fan_in >= 3: imported by useNetworkStatus, useOfflineSync, OfflineBanner
// @MX:SPEC: SPEC-MOBILE-007 - offline support
import { NetInfoState } from "@react-native-community/netinfo";

export interface NetworkState {
  isConnected: boolean;
  isInternetReachable: boolean | null;
}

type NetworkListener = (state: NetworkState) => void;

const listeners = new Set<NetworkListener>();
let initialized = false;

function ensureInitialized() {
  if (initialized) return;
  initialized = true;
  try {
    const NetInfo = require("@react-native-community/netinfo").default;
    NetInfo.addEventListener((state: NetInfoState) => {
      const normalized: NetworkState = {
        isConnected: state.isConnected ?? false,
        isInternetReachable: state.isInternetReachable ?? null,
      };
      listeners.forEach((l) => l(normalized));
    });
  } catch (e) {
    console.warn("[NetworkMonitor] NetInfo not available:", e);
  }
}

export async function getNetworkState(): Promise<NetworkState> {
  ensureInitialized();
  try {
    const NetInfo = require("@react-native-community/netinfo").default;
    const state = await NetInfo.fetch();
    return {
      isConnected: state.isConnected ?? false,
      isInternetReachable: state.isInternetReachable ?? null,
    };
  } catch {
    return { isConnected: true, isInternetReachable: true };
  }
}

export function addNetworkListener(listener: NetworkListener): void {
  ensureInitialized();
  listeners.add(listener);
}

export function removeNetworkListener(listener: NetworkListener): void {
  listeners.delete(listener);
}
