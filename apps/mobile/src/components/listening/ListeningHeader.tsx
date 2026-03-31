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
import { colors, radius, font } from "../../theme";

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
type SpeedPreset = (typeof SPEED_PRESETS)[number];

interface ListeningHeaderProps {
  title: string;
  playbackRate: number;
  onRateChange: (rate: number) => void;
  videoId?: string;
}

export default function ListeningHeader({
  title,
  playbackRate,
  onRateChange,
  videoId,
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
        {videoId && (
          <TouchableOpacity
            onPress={() => router.push(`/shadowing/${videoId}`)}
            style={styles.shadowingButton}
          >
            <Text style={styles.shadowingText}>쉐도잉 →</Text>
          </TouchableOpacity>
        )}
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
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
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
    color: colors.primary,
    fontSize: font.size.md,
  },
  title: {
    flex: 1,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  speedRow: {
    flexDirection: "row",
  },
  speedButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.lg,
    marginRight: 6,
    backgroundColor: colors.bgMuted,
  },
  speedButtonActive: {
    backgroundColor: colors.primary,
  },
  speedText: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
  },
  speedTextActive: {
    color: colors.textInverse,
    fontWeight: font.weight.semibold,
  },
  shadowingButton: {
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    marginLeft: 8,
  },
  shadowingText: {
    fontSize: font.size.sm,
    color: colors.textInverse,
    fontWeight: font.weight.semibold,
  },
});
