// @MX:NOTE: OfflineBanner renders as an absolute overlay at the top when offline.
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { appTokens } from "../theme/app-tokens";

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  const insets = useSafeAreaInsets();

  if (isOnline) return null;

  return (
    <View style={[styles.banner, { paddingTop: insets.top + 4 }]}>
      <Text style={styles.text}>오프라인 상태입니다</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 999,
    backgroundColor: appTokens.color.v82241aef,
    paddingBottom: appTokens.spacing.n8,
    paddingHorizontal: appTokens.spacing.n16,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    color: appTokens.color.vd14f9016,
    fontSize: appTokens.typography.n14,
    fontWeight: appTokens.typography.n600,
  },
});
