import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { SessionContext } from "@inputenglish/shared";
import ContextBriefCard from "./ContextBriefCard";
import { colors, font, leading, radius, spacing } from "../../theme";

interface StudyBriefSheetProps {
  context: SessionContext | null;
  sessionTitle: string | null;
  channelName: string | null;
  maxHeight: number;
  bottomInset: number;
  hasStarted: boolean;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onStart: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export default function StudyBriefSheet({
  context,
  sessionTitle,
  channelName,
  maxHeight,
  bottomInset,
  hasStarted,
  expanded,
  onExpandedChange,
  onStart,
}: StudyBriefSheetProps) {
  const initialOffset = expanded ? 0 : maxHeight;
  const translateY = useRef(new Animated.Value(initialOffset)).current;
  const currentOffsetRef = useRef(initialOffset);

  useEffect(() => {
    const nextOffset = expanded ? 0 : maxHeight;
    currentOffsetRef.current = nextOffset;
    Animated.spring(translateY, {
      toValue: nextOffset,
      useNativeDriver: true,
      tension: 68,
      friction: 12,
    }).start();
  }, [expanded, maxHeight, translateY]);

  const dismiss = useCallback(() => {
    onExpandedChange(false);
  }, [onExpandedChange]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gs) =>
          gs.dy > 8 && Math.abs(gs.dy) > Math.abs(gs.dx),
        onPanResponderMove: (_, gs) => {
          const nextOffset = clamp(
            currentOffsetRef.current + gs.dy,
            0,
            maxHeight,
          );
          translateY.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gs) => {
          const nextOffset = clamp(
            currentOffsetRef.current + gs.dy,
            0,
            maxHeight,
          );
          const shouldDismiss = gs.vy > 0.4 || nextOffset > maxHeight * 0.35;
          if (shouldDismiss) {
            dismiss();
          } else {
            currentOffsetRef.current = 0;
            Animated.spring(translateY, {
              toValue: 0,
              useNativeDriver: true,
              tension: 68,
              friction: 12,
            }).start();
          }
        },
      }),
    [dismiss, maxHeight, translateY],
  );

  return (
    <Animated.View
      style={[
        styles.container,
        { height: maxHeight, transform: [{ translateY }] },
      ]}
    >
      {/* Drag region */}
      <View style={styles.dragRegion} {...panResponder.panHandlers}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>학습 브리프</Text>
          <Pressable
            onPress={dismiss}
            hitSlop={10}
            style={styles.closeButton}
            accessibilityRole="button"
            accessibilityLabel="브리프 닫기"
          >
            <Ionicons name="close" size={20} color={colors.textSecondary} />
          </Pressable>
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: bottomInset + spacing.xl + 64 },
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
      >
        {sessionTitle ? (
          <View style={styles.sessionHeader}>
            <Text style={styles.sessionTitle} numberOfLines={3}>
              {sessionTitle}
            </Text>
            {channelName ? (
              <Text style={styles.channelName}>{channelName}</Text>
            ) : null}
          </View>
        ) : null}

        <ContextBriefCard context={context} />
      </ScrollView>

      <View style={[styles.cta, { paddingBottom: bottomInset + spacing.sm }]}>
        <Pressable
          style={({ pressed }) => [
            styles.ctaButton,
            pressed && { opacity: 0.85 },
          ]}
          onPress={() => {
            onStart();
            dismiss();
          }}
        >
          <Text style={styles.ctaText}>
            {hasStarted ? "학습 계속하기" : "학습 시작"}
          </Text>
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bg,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    borderTopWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 8,
  },
  dragRegion: {
    flexShrink: 0,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: "center",
    marginTop: spacing.sm + 2,
    backgroundColor: colors.borderStrong,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.text,
    letterSpacing: font.tracking.semiTight,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.bgMuted,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: spacing.xs,
  },
  sessionHeader: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sessionTitle: {
    fontSize: font.size["2xl"],
    fontWeight: font.weight.bold,
    color: colors.text,
    lineHeight: leading(font.size["2xl"], font.lineHeight.tight),
    letterSpacing: font.tracking.tight,
  },
  channelName: {
    fontSize: font.size.base,
    color: colors.textSecondary,
    fontWeight: font.weight.medium,
    letterSpacing: font.tracking.semiTight,
  },
  cta: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md - 4,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  ctaButton: {
    backgroundColor: colors.bgInverse,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    alignItems: "center",
  },
  ctaText: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
    letterSpacing: font.tracking.normal,
  },
});
