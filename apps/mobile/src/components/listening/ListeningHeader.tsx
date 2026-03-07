// @MX:NOTE: [AUTO] Controls playback speed and provides end-session navigation.
// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-007, AC-004
import React, { useState } from "react";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  ScrollView,
} from "react-native";
import { router } from "expo-router";

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
type SpeedPreset = (typeof SPEED_PRESETS)[number];

interface ListeningHeaderProps {
  title: string;
  playbackRate: number;
  onRateChange: (rate: number) => void;
}

export default function ListeningHeader({
  title,
  playbackRate,
  onRateChange,
}: ListeningHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.topRow}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.backButton}
        >
          <Text style={styles.backText}>{"< 종료"}</Text>
        </TouchableOpacity>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.speedRow}
      >
        {SPEED_PRESETS.map((rate) => (
          <TouchableOpacity
            key={rate}
            style={[
              styles.speedButton,
              playbackRate === rate && styles.speedButtonActive,
            ]}
            onPress={() => onRateChange(rate)}
          >
            <Text
              style={[
                styles.speedText,
                playbackRate === rate && styles.speedTextActive,
              ]}
            >
              {rate === 1 ? "1x" : `${rate}x`}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
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
  backButton: {
    marginRight: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  backText: {
    color: "#007AFF",
    fontSize: 14,
  },
  title: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#333",
  },
  speedRow: {
    flexDirection: "row",
  },
  speedButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 12,
    marginRight: 6,
    backgroundColor: "#f0f0f0",
  },
  speedButtonActive: {
    backgroundColor: "#007AFF",
  },
  speedText: {
    fontSize: 13,
    color: "#555",
  },
  speedTextActive: {
    color: "#fff",
    fontWeight: "600",
  },
});
