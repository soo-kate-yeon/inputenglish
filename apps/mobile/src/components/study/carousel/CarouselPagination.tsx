import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../../theme";
import { appTokens } from "../../../theme/app-tokens";

interface CarouselPaginationProps {
  total: number;
  currentIndex: number;
}

export function CarouselPagination({
  total,
  currentIndex,
}: CarouselPaginationProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: total }).map((_, i) => {
        const isActive = i === currentIndex;
        return (
          <View
            key={i}
            testID="pagination-dot"
            style={[
              styles.dot,
              isActive ? styles.dotActive : styles.dotInactive,
            ]}
          />
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: appTokens.spacing.n6,
    paddingVertical: appTokens.spacing.n12,
  },
  dot: {
    height: appTokens.size.n5,
    borderRadius: radius.pill,
  },
  dotActive: {
    width: appTokens.size.n20,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: appTokens.size.n5,
    backgroundColor: colors.textMuted,
    opacity: 0.3,
  },
});
