// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-004, REQ-S-002, AC-003
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

interface LoopToggleProps {
  active: boolean;
  onPress: () => void;
}

export default function LoopToggle({ active, onPress }: LoopToggleProps) {
  return (
    <TouchableOpacity
      style={[styles.button, active && styles.buttonActive]}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={[styles.icon, active && styles.iconActive]}>↺</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
  },
  buttonActive: {
    backgroundColor: "#111111",
  },
  icon: {
    fontSize: 16,
    color: "#666",
  },
  iconActive: {
    color: "#fff",
  },
});
