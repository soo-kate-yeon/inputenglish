import React from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import type { FeaturedSpeakerItem } from "@/lib/api";
import { getSpeakerImageSource } from "@/lib/speaker-assets";
import { colors, font, radius, shadow, spacing } from "@/theme";

const CARD_SIZE = 116;
const STACK_OFFSET = 10;

interface SpeakerStackCardProps {
  item: FeaturedSpeakerItem;
  onPress: () => void;
}

export default function SpeakerStackCard({
  item,
  onPress,
}: SpeakerStackCardProps) {
  const imageSource = getSpeakerImageSource(
    item.slug,
    item.image_url,
    item.name,
  );

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.stackWrap}>
        <View style={[styles.stackLayer, styles.stackLayerBack]} />
        <View style={[styles.stackLayer, styles.stackLayerMiddle]} />
        {imageSource ? (
          <Image source={imageSource} style={styles.cover} resizeMode="cover" />
        ) : (
          <View style={[styles.cover, styles.coverPlaceholder]}>
            <Text style={styles.placeholderText}>
              {item.name.slice(0, 1).toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <View style={styles.meta}>
        <Text style={styles.name} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.count} numberOfLines={1}>
          세션 {item.session_count}개
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_SIZE + STACK_OFFSET,
    gap: spacing.sm,
  },
  stackWrap: {
    width: CARD_SIZE + STACK_OFFSET,
    height: CARD_SIZE + STACK_OFFSET,
    justifyContent: "flex-start",
  },
  stackLayer: {
    position: "absolute",
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSubtle,
  },
  stackLayerBack: {
    right: 0,
    top: STACK_OFFSET,
  },
  stackLayerMiddle: {
    right: STACK_OFFSET / 2,
    top: STACK_OFFSET / 2,
    backgroundColor: colors.bgMuted,
  },
  cover: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: radius.xl,
    backgroundColor: colors.bgMuted,
    ...shadow.md,
  },
  coverPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  placeholderText: {
    fontSize: font.size["2xl"],
    fontWeight: font.weight.bold,
    color: colors.textSecondary,
  },
  meta: {
    gap: 2,
  },
  name: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  count: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
  },
});
