// @MX:NOTE: [AUTO] Shadowing screen header with mode toggle and exit button.
// @MX:SPEC: SPEC-MOBILE-004 - REQ-E-005, AC-005
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type ShadowingMode = "sentence" | "paragraph" | "total";

interface ShadowingHeaderProps {
  title: string;
  mode: ShadowingMode;
  onModeChange: (mode: ShadowingMode) => void;
  onExit: () => void;
}

const MODES: Array<{ key: ShadowingMode; label: string }> = [
  { key: "sentence", label: "문장" },
  { key: "paragraph", label: "문단" },
  { key: "total", label: "전체" },
];

export default function ShadowingHeader({
  title,
  mode,
  onModeChange,
  onExit,
}: ShadowingHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <TouchableOpacity onPress={onExit} style={styles.exitButton}>
          <Text style={styles.exitText}>학습 종료</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.modeRow}>
        {MODES.map(({ key, label }) => (
          <TouchableOpacity
            key={key}
            style={[styles.modeButton, mode === key && styles.modeButtonActive]}
            onPress={() => onModeChange(key)}
          >
            <Text
              style={[styles.modeText, mode === key && styles.modeTextActive]}
            >
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: 8,
    paddingHorizontal: 12,
    paddingBottom: 4,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
    marginRight: 8,
  },
  exitButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: "#f0f0f0",
  },
  exitText: {
    fontSize: 13,
    color: "#555",
  },
  modeRow: {
    flexDirection: "row",
    gap: 6,
  },
  modeButton: {
    paddingVertical: 4,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#f0f0f0",
  },
  modeButtonActive: {
    backgroundColor: "#007AFF",
  },
  modeText: {
    fontSize: 13,
    color: "#555",
  },
  modeTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
});
