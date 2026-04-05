import React from "react";
import { StyleSheet, View } from "react-native";
import { colors, radius } from "../../../theme";

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
    gap: 6,
    paddingVertical: 12,
  },
  dot: {
    height: 5,
    borderRadius: radius.pill,
  },
  dotActive: {
    width: 20,
    backgroundColor: colors.primary,
  },
  dotInactive: {
    width: 5,
    backgroundColor: colors.textMuted,
    opacity: 0.3,
  },
});
