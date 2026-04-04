import React from "react";
import { Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSessionSheet } from "@/contexts/SessionSheetContext";
import { colors, font, radius, spacing } from "@/theme";

export default function MiniPlayer() {
  const { session, isPlaying, togglePlay, expandSheet, closeSession } =
    useSessionSheet();

  if (!session) return null;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={expandSheet}
      activeOpacity={0.95}
    >
      {/* Thumbnail */}
      {session.thumbnail_url ? (
        <Image
          source={{ uri: session.thumbnail_url }}
          style={styles.thumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumb, styles.thumbPlaceholder]}>
          <Ionicons name="musical-notes" size={16} color={colors.textMuted} />
        </View>
      )}

      {/* Info */}
      <View style={styles.info}>
        <Text style={styles.title} numberOfLines={1}>
          {session.title}
        </Text>
        {session.channel_name && (
          <Text style={styles.channel} numberOfLines={1}>
            {session.channel_name}
          </Text>
        )}
      </View>

      {/* Controls */}
      <TouchableOpacity
        style={styles.controlButton}
        onPress={togglePlay}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons
          name={isPlaying ? "pause" : "play"}
          size={22}
          color={colors.text}
        />
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.controlButton}
        onPress={closeSession}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      >
        <Ionicons name="close" size={20} color={colors.textMuted} />
      </TouchableOpacity>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.bg,
    marginHorizontal: spacing.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.lg,
    gap: 10,
    // Shadow
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
    elevation: 6,
  },
  thumb: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.bgMuted,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  channel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  controlButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
});
