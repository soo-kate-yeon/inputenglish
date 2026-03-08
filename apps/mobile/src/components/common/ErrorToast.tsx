// @MX:NOTE: [AUTO] Reusable error toast with auto-dismiss and optional retry action.
// @MX:SPEC: SPEC-MOBILE-005 - REQ-U-006, REQ-E-009
import React, { useEffect, useRef } from "react";
import {
  Animated,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

interface ErrorToastProps {
  message: string;
  visible: boolean;
  onDismiss: () => void;
  onRetry?: () => void;
  duration?: number;
}

export default function ErrorToast({
  message,
  visible,
  onDismiss,
  onRetry,
  duration = 3000,
}: ErrorToastProps): React.JSX.Element {
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.timing(opacity, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();
      const timer = setTimeout(() => {
        hide();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hide = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => onDismiss());
  };

  if (!visible) return <View />;

  return (
    <Animated.View style={[styles.container, { opacity }]}>
      <Text style={styles.message} numberOfLines={2}>
        {message}
      </Text>
      <View style={styles.actions}>
        {onRetry ? (
          <TouchableOpacity onPress={onRetry} style={styles.retryButton}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={hide} style={styles.dismissButton}>
          <Text style={styles.dismissText}>닫기</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 80,
    left: 16,
    right: 16,
    backgroundColor: "#333",
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  message: {
    color: "#fff",
    fontSize: 14,
    flex: 1,
    marginRight: 8,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
  },
  retryButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  dismissButton: {
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  dismissText: {
    color: "#aaa",
    fontSize: 13,
  },
});
