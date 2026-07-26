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
import { appTokens } from "../../theme/app-tokens";

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
            onPress={() => router.push("/(tabs)")}
            style={styles.shadowingButton}
          >
            <Text style={styles.shadowingText}>오늘 →</Text>
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
    paddingTop: appTokens.spacing.n8,
    paddingHorizontal: appTokens.spacing.n12,
    paddingBottom: appTokens.spacing.n4,
    backgroundColor: colors.bg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: appTokens.spacing.n8,
  },
  backButton: {
    marginRight: appTokens.spacing.n8,
    paddingVertical: appTokens.spacing.n4,
    paddingHorizontal: appTokens.spacing.n8,
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
    paddingVertical: appTokens.spacing.n4,
    paddingHorizontal: appTokens.spacing.n10,
    borderRadius: radius.lg,
    marginRight: appTokens.spacing.n6,
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
    paddingVertical: appTokens.spacing.n4,
    paddingHorizontal: appTokens.spacing.n10,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    marginLeft: appTokens.spacing.n8,
  },
  shadowingText: {
    fontSize: font.size.sm,
    color: colors.textInverse,
    fontWeight: font.weight.semibold,
  },
});
