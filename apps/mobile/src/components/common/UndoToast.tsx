// @MX:NOTE: [AUTO] Undo toast for delayed delete operations in Archive screen.
// @MX:SPEC: SPEC-MOBILE-005 - REQ-E-004, REQ-N-001, REQ-C-002
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { createThemedStyles, useTheme } from "@/components/ui";

interface UndoToastProps {
  visible: boolean;
  message: string;
  onUndo: () => void;
}

export default function UndoToast({
  visible,
  message,
  onUndo,
}: UndoToastProps): React.JSX.Element {
  const styles = getStyles(useTheme());
  if (!visible) return <View />;

  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <TouchableOpacity onPress={onUndo} style={styles.undoButton}>
        <Text style={styles.undoText}>실행 취소</Text>
      </TouchableOpacity>
    </View>
  );
}

const getStyles = createThemedStyles((theme) => ({
  container: {
    position: "absolute",
    bottom: theme.spacing[6],
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
  },
  undoButton: {
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
    backgroundColor: theme.colors.text.inverse,
    borderRadius: theme.radius.md,
    marginLeft: theme.spacing[2],
  },
  undoText: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
  },
}));
