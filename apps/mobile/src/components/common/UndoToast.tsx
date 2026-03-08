// @MX:NOTE: [AUTO] Undo toast for delayed delete operations in Archive screen.
// @MX:SPEC: SPEC-MOBILE-005 - REQ-E-004, REQ-N-001, REQ-C-002
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

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

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 24,
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
  },
  undoButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: "#007AFF",
    borderRadius: 8,
    marginLeft: 8,
  },
  undoText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
