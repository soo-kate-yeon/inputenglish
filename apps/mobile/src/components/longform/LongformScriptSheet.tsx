import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  FlatList,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { Sentence } from "@inputenglish/shared";
import ScriptLine from "@/components/listening/ScriptLine";
import { colors, font, radius, spacing } from "@/theme";

export const LONGFORM_SCRIPT_SHEET_COLLAPSED_HEIGHT = 88;

interface LongformScriptSheetProps {
  sentences: Sentence[];
  activeSentenceId: string | null;
  maxHeight: number;
  bottomInset: number;
  initialExpanded?: boolean;
  loopingSentenceId: string | null;
  savedSentenceIds: Set<string>;
  showTranslation: boolean;
  scriptHidden: boolean;
  onSentencePress: (sentence: Sentence) => void;
  onLoopToggle: (sentence: Sentence) => void;
  onSaveToggle: (sentence: Sentence) => void;
  onToggleTranslation: () => void;
  onToggleScriptHidden: () => void;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function scrollToSentence(
  listRef: React.RefObject<FlatList<Sentence> | null>,
  sentences: Sentence[],
  activeSentenceId: string,
  animated = true,
) {
  const activeIndex = sentences.findIndex(
    (sentence) => sentence.id === activeSentenceId,
  );

  if (activeIndex < 0) return;

  listRef.current?.scrollToIndex({
    index: activeIndex,
    animated,
    viewPosition: 0.16,
  });
}

export default function LongformScriptSheet({
  sentences,
  activeSentenceId,
  maxHeight,
  bottomInset,
  initialExpanded = false,
  loopingSentenceId,
  savedSentenceIds,
  showTranslation,
  scriptHidden,
  onSentencePress,
  onLoopToggle,
  onSaveToggle,
  onToggleTranslation,
  onToggleScriptHidden,
}: LongformScriptSheetProps) {
  const collapsedOffset = useMemo(
    () => Math.max(maxHeight - LONGFORM_SCRIPT_SHEET_COLLAPSED_HEIGHT, 0),
    [maxHeight],
  );
  const initialOffset = initialExpanded ? 0 : collapsedOffset;
  const [expanded, setExpanded] = useState(initialExpanded);
  const translateY = useRef(new Animated.Value(initialOffset)).current;
  const currentOffsetRef = useRef(initialOffset);
  const transcriptListRef = useRef<FlatList<Sentence>>(null);

  useEffect(() => {
    const nextOffset = initialExpanded ? 0 : collapsedOffset;
    currentOffsetRef.current = nextOffset;
    translateY.setValue(nextOffset);
    setExpanded(initialExpanded);
  }, [collapsedOffset, initialExpanded, translateY]);

  const animateTo = useCallback(
    (nextExpanded: boolean) => {
      const nextOffset = nextExpanded ? 0 : collapsedOffset;
      setExpanded(nextExpanded);
      currentOffsetRef.current = nextOffset;
      Animated.spring(translateY, {
        toValue: nextOffset,
        useNativeDriver: true,
        tension: 68,
        friction: 12,
      }).start();
    },
    [collapsedOffset, translateY],
  );

  useEffect(() => {
    if (!expanded || !activeSentenceId) return;

    const timer = setTimeout(() => {
      scrollToSentence(transcriptListRef, sentences, activeSentenceId, true);
    }, 120);

    return () => clearTimeout(timer);
  }, [activeSentenceId, expanded, sentences]);

  useEffect(() => {
    if (!initialExpanded || !expanded || !activeSentenceId) return;

    const timer = setTimeout(() => {
      scrollToSentence(transcriptListRef, sentences, activeSentenceId, false);
    }, 360);

    return () => clearTimeout(timer);
  }, [activeSentenceId, expanded, initialExpanded, sentences]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gestureState) =>
          Math.abs(gestureState.dy) > 10 &&
          Math.abs(gestureState.dy) > Math.abs(gestureState.dx),
        onPanResponderMove: (_, gestureState) => {
          const nextOffset = clamp(
            currentOffsetRef.current + gestureState.dy,
            0,
            collapsedOffset,
          );
          translateY.setValue(nextOffset);
        },
        onPanResponderRelease: (_, gestureState) => {
          const nextOffset = clamp(
            currentOffsetRef.current + gestureState.dy,
            0,
            collapsedOffset,
          );
          const shouldExpand =
            gestureState.vy < -0.3 || nextOffset < collapsedOffset * 0.52;
          animateTo(shouldExpand);
        },
      }),
    [animateTo, collapsedOffset, translateY],
  );

  const renderItem = useCallback(
    ({ item }: { item: Sentence }) => (
      <ScriptLine
        sentence={item}
        isActive={item.id === activeSentenceId}
        isLooping={loopingSentenceId === item.id}
        isSaved={savedSentenceIds.has(item.id)}
        scriptHidden={scriptHidden}
        tone="dark"
        showActions={true}
        showTranslation={showTranslation}
        onTap={onSentencePress}
        onLoopToggle={onLoopToggle}
        onSaveToggle={onSaveToggle}
      />
    ),
    [
      activeSentenceId,
      loopingSentenceId,
      onLoopToggle,
      onSaveToggle,
      onSentencePress,
      savedSentenceIds,
      scriptHidden,
      showTranslation,
    ],
  );

  return (
    <Animated.View
      style={[
        styles.container,
        {
          height: maxHeight,
          transform: [{ translateY }],
          paddingBottom: bottomInset,
        },
      ]}
    >
      <View style={styles.dragRegion} {...panResponder.panHandlers}>
        <View style={styles.handle} />
        <Pressable
          style={styles.headerRow}
          onPress={() => animateTo(!expanded)}
          accessibilityRole="button"
          accessibilityLabel={expanded ? "스크립트 접기" : "스크립트 펼치기"}
        >
          <Text style={styles.headerTitle}>스크립트</Text>
          <View style={styles.headerActions}>
            <Ionicons
              name={expanded ? "chevron-down" : "chevron-up"}
              size={22}
              color={colors.textOnDarkSecondary}
            />
            {expanded ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="스크립트 닫기"
                hitSlop={8}
                onPress={() => animateTo(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={22} color={colors.textOnDark} />
              </Pressable>
            ) : null}
          </View>
        </Pressable>
      </View>

      {expanded ? (
        <>
          <View style={styles.toggleRow}>
            <Pressable
              style={[
                styles.toggleChip,
                showTranslation && styles.toggleChipActive,
              ]}
              onPress={onToggleTranslation}
            >
              <Text
                style={[
                  styles.toggleChipText,
                  showTranslation && styles.toggleChipTextActive,
                ]}
              >
                번역
              </Text>
            </Pressable>
            <Pressable
              style={[
                styles.toggleChip,
                !scriptHidden && styles.toggleChipActive,
              ]}
              onPress={onToggleScriptHidden}
            >
              <Text
                style={[
                  styles.toggleChipText,
                  !scriptHidden && styles.toggleChipTextActive,
                ]}
              >
                스크립트 표시
              </Text>
            </Pressable>
          </View>

          <FlatList
            ref={transcriptListRef}
            data={sentences}
            keyExtractor={(item) => item.id}
            renderItem={renderItem}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            onScrollToIndexFailed={({ index }) => {
              setTimeout(() => {
                transcriptListRef.current?.scrollToIndex({
                  index,
                  animated: false,
                  viewPosition: 0.16,
                });
              }, 120);
            }}
          />
        </>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.bgDarkSubtle,
    borderTopLeftRadius: radius["2xl"],
    borderTopRightRadius: radius["2xl"],
    borderTopWidth: 1,
    borderColor: colors.borderOnDark,
    overflow: "hidden",
  },
  dragRegion: {
    flexShrink: 0,
  },
  handle: {
    width: 42,
    height: 4,
    borderRadius: radius.pill,
    alignSelf: "center",
    marginTop: 10,
    backgroundColor: colors.borderOnDarkStrong,
  },
  headerRow: {
    minHeight: LONGFORM_SCRIPT_SHEET_COLLAPSED_HEIGHT - 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  headerTitle: {
    fontSize: font.size.base,
    lineHeight: 24,
    color: colors.textOnDark,
    fontWeight: font.weight.semibold,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  toggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
  },
  toggleChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderWidth: 1,
    borderColor: colors.borderOnDarkStrong,
  },
  toggleChipActive: {
    backgroundColor: colors.textOnDark,
  },
  toggleChipText: {
    fontSize: font.size.sm,
    lineHeight: 18,
    color: colors.textOnDark,
    fontWeight: font.weight.medium,
  },
  toggleChipTextActive: {
    color: colors.bgDark,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingBottom: spacing.lg,
  },
});
