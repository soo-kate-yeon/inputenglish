import React, { useRef } from "react";
import {
  Animated,
  PanResponder,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

const DELETE_THRESHOLD = -80;
const BUTTON_WIDTH = 80;

interface SwipeableRowProps {
  children: React.ReactNode;
  onDelete: () => void;
}

export default function SwipeableRow({
  children,
  onDelete,
}: SwipeableRowProps) {
  const translateX = useRef(new Animated.Value(0)).current;
  const isOpen = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 10 &&
        Math.abs(gesture.dx) > Math.abs(gesture.dy),
      onPanResponderMove: (_, gesture) => {
        const dx = isOpen.current
          ? Math.min(0, gesture.dx - BUTTON_WIDTH)
          : Math.min(0, gesture.dx);
        translateX.setValue(dx);
      },
      onPanResponderRelease: (_, gesture) => {
        const currentOffset = isOpen.current
          ? gesture.dx - BUTTON_WIDTH
          : gesture.dx;

        if (currentOffset < DELETE_THRESHOLD) {
          Animated.spring(translateX, {
            toValue: -BUTTON_WIDTH,
            useNativeDriver: true,
            friction: 8,
          }).start();
          isOpen.current = true;
        } else {
          Animated.spring(translateX, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
          isOpen.current = false;
        }
      },
    }),
  ).current;

  const close = () => {
    Animated.spring(translateX, {
      toValue: 0,
      useNativeDriver: true,
      friction: 8,
    }).start();
    isOpen.current = false;
  };

  return (
    <View style={styles.container}>
      {/* Delete button behind */}
      <View style={styles.deleteContainer}>
        <TouchableOpacity
          style={styles.deleteButton}
          onPress={() => {
            close();
            onDelete();
          }}
          activeOpacity={0.8}
        >
          <Text style={styles.deleteText}>삭제</Text>
        </TouchableOpacity>
      </View>

      {/* Foreground content */}
      <Animated.View
        style={{ transform: [{ translateX }] }}
        {...panResponder.panHandlers}
      >
        {children}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: "hidden",
  },
  deleteContainer: {
    position: "absolute",
    right: 0,
    top: 0,
    bottom: 0,
    width: BUTTON_WIDTH,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#111111",
  },
  deleteButton: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    width: "100%",
  },
  deleteText: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#FFFFFF",
  },
});
