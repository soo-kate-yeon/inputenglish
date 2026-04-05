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
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          testID="pagination-dot"
          style={[styles.dot, { opacity: i === currentIndex ? 1 : 0.25 }]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.text,
  },
});
