// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-004, REQ-S-002, AC-003
import React from "react";
import { StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";

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
      activeOpacity={0.7}
    >
      <Ionicons
        name="repeat"
        size={14}
        color={active ? "#FFFFFF" : "#888888"}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E0E0E0",
    backgroundColor: "#FFFFFF",
  },
  buttonActive: {
    backgroundColor: "#111111",
    borderColor: "#111111",
  },
});
