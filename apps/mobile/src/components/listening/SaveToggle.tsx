// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-005, AC-005
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";

interface SaveToggleProps {
  active: boolean;
  onPress: () => void;
}

export default function SaveToggle({ active, onPress }: SaveToggleProps) {
  return (
    <TouchableOpacity
      style={[styles.button, active && styles.buttonActive]}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={[styles.icon, active && styles.iconActive]}>
        {active ? "★" : "☆"}
      </Text>
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
    backgroundColor: "#FFB800",
  },
  icon: {
    fontSize: 16,
    color: "#666",
  },
  iconActive: {
    color: "#fff",
  },
});
