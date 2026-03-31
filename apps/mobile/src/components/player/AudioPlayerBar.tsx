// @MX:NOTE: [AUTO] Custom bottom player bar - play/pause, ±15s seek, speed, script toggle.
import React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { colors } from "../../theme";

const SPEED_PRESETS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export interface AudioPlayerBarProps {
  playing: boolean;
  playbackRate: number;
  scriptVisible: boolean;
  currentTime: number;
  duration: number;
  onPlayPause: () => void;
  onSeekBack: () => void;
  onSeekForward: () => void;
  onRateChange: (rate: number) => void;
  onScriptToggle: () => void;
}

function fmt(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export default function AudioPlayerBar({
  playing,
  playbackRate,
  scriptVisible,
  currentTime,
  duration,
  onPlayPause,
  onSeekBack,
  onSeekForward,
  onRateChange,
  onScriptToggle,
}: AudioPlayerBarProps) {
  const progress = duration > 0 ? Math.min(currentTime / duration, 1) : 0;
  const progressPercent = `${(progress * 100).toFixed(1)}%`;

  const handleSpeedPress = () => {
    const idx = SPEED_PRESETS.indexOf(playbackRate);
    const nextIdx = idx === -1 ? 2 : (idx + 1) % SPEED_PRESETS.length;
    onRateChange(SPEED_PRESETS[nextIdx]);
  };

  const speedLabel = playbackRate === 1 ? "1×" : `${playbackRate}×`;

  return (
    <View style={styles.container}>
      {/* Progress track */}
      <View style={styles.progressTrack}>
        <View
          style={[styles.progressFill, { width: progressPercent as any }]}
        />
      </View>

      {/* Time labels */}
      <View style={styles.timeRow}>
        <Text style={styles.timeText}>{fmt(currentTime)}</Text>
        <Text style={styles.timeText}>{fmt(duration)}</Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        {/* Speed */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={handleSpeedPress}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.speedText}>{speedLabel}</Text>
        </TouchableOpacity>

        {/* -15s */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={onSeekBack}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.seekIconWrap}>
            <Ionicons
              name="refresh-outline"
              size={22}
              color={colors.text}
              style={styles.seekIconFlip}
            />
            <Text style={styles.seekNum}>15</Text>
          </View>
        </TouchableOpacity>

        {/* Play / Pause */}
        <TouchableOpacity
          style={styles.playBtn}
          onPress={onPlayPause}
          activeOpacity={0.7}
        >
          <Ionicons
            name={playing ? "pause" : "play"}
            size={26}
            color={colors.bg}
          />
        </TouchableOpacity>

        {/* +15s */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={onSeekForward}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <View style={styles.seekIconWrap}>
            <Ionicons name="refresh-outline" size={22} color={colors.text} />
            <Text style={styles.seekNum}>15</Text>
          </View>
        </TouchableOpacity>

        {/* Script toggle */}
        <TouchableOpacity
          style={styles.controlBtn}
          onPress={onScriptToggle}
          activeOpacity={0.6}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons
            name={scriptVisible ? "document-text" : "document-text-outline"}
            size={22}
            color={scriptVisible ? colors.text : colors.textMuted}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.bg,
    borderTopWidth: 1,
    borderTopColor: colors.text,
    paddingTop: 14,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === "ios" ? 34 : 20,
  },

  progressTrack: {
    height: 2,
    backgroundColor: colors.border,
    marginBottom: 8,
  },
  progressFill: {
    height: 2,
    backgroundColor: colors.text,
  },

  timeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
  },
  timeText: {
    fontSize: 11,
    color: colors.textMuted,
    letterSpacing: 0.5,
  },

  controls: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  controlBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  speedText: {
    fontSize: 15,
    fontWeight: "700",
    color: colors.text,
  },

  seekIconWrap: {
    alignItems: "center",
    justifyContent: "center",
  },
  seekIconFlip: {
    transform: [{ scaleX: -1 }],
  },
  seekNum: {
    fontSize: 8,
    fontWeight: "700",
    color: colors.text,
    position: "absolute",
  },

  playBtn: {
    width: 58,
    height: 58,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
});
