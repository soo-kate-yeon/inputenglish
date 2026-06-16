// @MX:NOTE: [AUTO] Reusable error toast with auto-dismiss and optional retry action.
// @MX:SPEC: SPEC-MOBILE-005 - REQ-U-006, REQ-E-009
import React, { useEffect, useRef } from "react";
import { Animated, Text, TouchableOpacity, View } from "react-native";
import { createThemedStyles, useTheme } from "@/components/ui";

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
  const styles = getStyles(useTheme());
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

const getStyles = createThemedStyles((theme) => ({
  container: {
    position: "absolute",
    bottom: theme.spacing[10] * 2,
    left: theme.spacing[4],
    right: theme.spacing[4],
    backgroundColor: theme.colors.text.primary,
    borderRadius: theme.radius.lg,
    padding: theme.spacing[4],
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    shadowColor: theme.colors.text.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    zIndex: 999,
  },
  message: {
    ...theme.typography.body,
    color: theme.colors.text.inverse,
    flex: 1,
    marginRight: theme.spacing[2],
  },
  actions: {
    flexDirection: "row",
    gap: theme.spacing[2],
  },
  retryButton: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    backgroundColor: theme.colors.text.inverse,
    borderRadius: theme.radius.md,
  },
  retryText: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
  },
  dismissButton: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
  },
  dismissText: {
    ...theme.typography.label,
    color: theme.colors.text.inverse,
  },
}));
