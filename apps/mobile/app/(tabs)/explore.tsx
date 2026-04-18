import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  LayoutChangeEvent,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  fetchFeaturedSpeakers,
  fetchLearningSessionsPaginated,
  fetchSessionsByIds,
  FeedFilters,
  FeaturedSpeakerItem,
  SessionListItem,
} from "../../src/lib/api";
import SpeakerStackCard from "../../src/components/home/SpeakerStackCard";
import { useSubscription } from "../../src/hooks/useSubscription";
import { getRecentSessionIds } from "../../src/lib/recent-sessions";
import { getSessionPressDestination } from "../../src/lib/session-access";
import {
  DIFFICULTY_OPTIONS,
  DifficultyFilter,
  FEED_CHIPS,
  FeedChip,
} from "../../src/lib/feed-categories";
import { colors, font, radius, spacing } from "../../src/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const THUMB_HEIGHT = (SCREEN_WIDTH - spacing.md * 2) * (9 / 16);
const CONTINUE_CARD_W = (SCREEN_WIDTH - spacing.md * 2 - 12) / 2.2;
const CHIP_ROW_H = 52;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}\ucd08`;
  if (s === 0) return `${m}\ubd84`;
  return `${m}\ubd84 ${s}\ucd08`;
}

function buildFilters(
  activeChip: string,
  difficulty: DifficultyFilter,
): FeedFilters {
  const chip = FEED_CHIPS.find((c) => c.key === activeChip);
  return {
    sourceType: chip?.type === "source_type" ? chip.value : undefined,
    genre: chip?.type === "genre" ? chip.value : undefined,
    difficulty: difficulty !== "all" ? difficulty : undefined,
  };
}

// Spread sessions so the same source_video_id never appears back-to-back.
// Accepts an optional lastVideoId to handle pagination boundaries.
function spreadByVideo(
  sessions: SessionListItem[],
  lastVideoId?: string | null,
): SessionListItem[] {
  const result: SessionListItem[] = [];
  const remaining = [...sessions];
  let prevId = lastVideoId ?? null;

  while (remaining.length > 0) {
    const idx = remaining.findIndex((s) => s.source_video_id !== prevId);
    if (idx === -1) {
      result.push(...remaining);
      break;
    }
    const [picked] = remaining.splice(idx, 1);
    result.push(picked);
    prevId = picked.source_video_id;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Continue Learning Card (horizontal scroll)
// ---------------------------------------------------------------------------

function ContinueCard({
  item,
  onPress,
}: {
  item: SessionListItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.continueCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.continueThumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.continueThumb, styles.thumbPlaceholder]}>
          <Ionicons name="musical-notes" size={20} color={colors.textMuted} />
        </View>
      )}
      <Text style={styles.continueTitle} numberOfLines={2}>
        {item.title}
      </Text>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Full-Width Feed Card (YouTube-style)
// ---------------------------------------------------------------------------

function FeedCard({
  item,
  onPress,
}: {
  item: SessionListItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.feedCard}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <View>
        {item.thumbnail_url ? (
          <Image
            source={{ uri: item.thumbnail_url }}
            style={styles.feedThumb}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.feedThumb, styles.thumbPlaceholder]}>
            <Ionicons name="musical-notes" size={32} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.durationBadge}>
          <Text style={styles.durationText}>
            {formatDuration(item.duration)}
          </Text>
        </View>
      </View>
      <View style={styles.feedCardInfo}>
        <Text style={styles.feedTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {(item.channel_name || item.subtitle) && (
          <Text style={styles.feedMeta}>
            {[item.channel_name, item.subtitle]
              .filter(Boolean)
              .join(" \u00b7 ")}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ---------------------------------------------------------------------------
// Chip Row
// ---------------------------------------------------------------------------

function ChipRow({
  activeChip,
  onChipPress,
  difficulty,
  onDifficultyPress,
  style,
}: {
  activeChip: string;
  onChipPress: (chip: FeedChip) => void;
  difficulty: DifficultyFilter;
  onDifficultyPress: () => void;
  style?: object;
}) {
  const diffLabel =
    difficulty === "all"
      ? "\ub09c\uc774\ub3c4"
      : (DIFFICULTY_OPTIONS.find((d) => d.key === difficulty)?.label ??
        "\ub09c\uc774\ub3c4");

  return (
    <View style={[styles.chipRow, style]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipRowContent}
      >
        {/* Difficulty dropdown chip */}
        <TouchableOpacity
          style={[styles.chip, difficulty !== "all" && styles.chipActive]}
          onPress={onDifficultyPress}
          activeOpacity={0.7}
        >
          <Text
            style={[
              styles.chipText,
              difficulty !== "all" && styles.chipTextActive,
            ]}
          >
            {diffLabel}
          </Text>
          <Ionicons
            name="chevron-down"
            size={14}
            color={difficulty !== "all" ? colors.textInverse : colors.text}
            style={{ marginLeft: 2 }}
          />
        </TouchableOpacity>

        {/* Filter chips */}
        {FEED_CHIPS.map((chip) => (
          <TouchableOpacity
            key={chip.key}
            style={[styles.chip, activeChip === chip.key && styles.chipActive]}
            onPress={() => onChipPress(chip)}
            activeOpacity={0.7}
          >
            <Text
              style={[
                styles.chipText,
                activeChip === chip.key && styles.chipTextActive,
              ]}
            >
              {chip.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Difficulty Dropdown
// ---------------------------------------------------------------------------

function DifficultyDropdown({
  visible,
  current,
  anchorTop,
  onSelect,
  onClose,
}: {
  visible: boolean;
  current: DifficultyFilter;
  anchorTop: number;
  onSelect: (d: DifficultyFilter) => void;
  onClose: () => void;
}) {
  if (!visible) return null;

  return (
    <Modal
      transparent
      animationType="fade"
      visible={visible}
      onRequestClose={onClose}
    >
      <Pressable style={styles.dropdownOverlay} onPress={onClose}>
        <View style={[styles.dropdownMenu, { top: anchorTop }]}>
          {DIFFICULTY_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={[
                styles.dropdownItem,
                current === opt.key && styles.dropdownItemActive,
              ]}
              onPress={() => {
                onSelect(opt.key);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.dropdownItemText,
                  current === opt.key && styles.dropdownItemTextActive,
                ]}
              >
                {opt.label}
              </Text>
              {current === opt.key && (
                <Ionicons name="checkmark" size={18} color={colors.primary} />
              )}
            </TouchableOpacity>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// HomeScreen
// ---------------------------------------------------------------------------

export default function HomeScreen() {
  const { plan } = useSubscription();
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [continueSessions, setContinueSessions] = useState<SessionListItem[]>(
    [],
  );
  const [featuredSpeakers, setFeaturedSpeakers] = useState<
    FeaturedSpeakerItem[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [activeChip, setActiveChip] = useState("all");
  const [difficulty, setDifficulty] = useState<DifficultyFilter>("all");
  const [showDifficulty, setShowDifficulty] = useState(false);
  const [chipStickyOffset, setChipStickyOffset] = useState(Infinity);
  const [isChipSticky, setIsChipSticky] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const offsetRef = useRef(0);
  const insets = useSafeAreaInsets();

  // -- Continue learning (from local MMKV history, refresh on tab focus) --

  useFocusEffect(
    useCallback(() => {
      const ids = getRecentSessionIds();

      if (ids.length > 0) {
        fetchSessionsByIds(ids.slice(0, 10))
          .then(setContinueSessions)
          .catch((error) => {
            console.warn("[Home] Failed to load continue sessions", error);
          });
      } else {
        setContinueSessions([]);
      }

      fetchFeaturedSpeakers()
        .then(setFeaturedSpeakers)
        .catch((error) => {
          console.warn("[Home] Failed to load featured speakers", error);
          setFeaturedSpeakers([]);
        });
    }, []),
  );

  // -- Feed load --

  const loadFeed = useCallback(
    async (reset: boolean = true) => {
      if (reset) {
        setLoading(true);
        setError(null);
        offsetRef.current = 0;
      }
      try {
        const filters = buildFilters(activeChip, difficulty);
        const result = await fetchLearningSessionsPaginated(
          reset ? 0 : offsetRef.current,
          filters,
        );
        if (reset) {
          setSessions(spreadByVideo(result.sessions));
        } else {
          setSessions((prev) => {
            const lastId =
              prev.length > 0 ? prev[prev.length - 1].source_video_id : null;
            return [...prev, ...spreadByVideo(result.sessions, lastId)];
          });
        }
        setHasMore(result.hasMore);
        offsetRef.current = reset
          ? result.sessions.length
          : offsetRef.current + result.sessions.length;
      } catch (e: unknown) {
        if (reset)
          setError(
            e instanceof Error
              ? e.message
              : "\uc138\uc158\uc744 \ubd88\ub7ec\uc624\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.",
          );
      } finally {
        setLoading(false);
      }
    },
    [activeChip, difficulty],
  );

  // Reload when filters change
  useEffect(() => {
    loadFeed(true);
  }, [loadFeed]);

  // -- Load more (pagination) --

  const handleEndReached = useCallback(() => {
    if (loadingMore || !hasMore || loading) return;
    setLoadingMore(true);
    const filters = buildFilters(activeChip, difficulty);
    fetchLearningSessionsPaginated(offsetRef.current, filters)
      .then((result) => {
        setSessions((prev) => {
          const lastId =
            prev.length > 0 ? prev[prev.length - 1].source_video_id : null;
          return [...prev, ...spreadByVideo(result.sessions, lastId)];
        });
        setHasMore(result.hasMore);
        offsetRef.current += result.sessions.length;
      })
      .catch((error) => {
        console.warn("[Home] Failed to load more sessions", error);
      })
      .finally(() => setLoadingMore(false));
  }, [loadingMore, hasMore, loading, activeChip, difficulty]);

  // -- Chip handlers --

  const handleChipPress = useCallback((chip: FeedChip) => {
    setActiveChip((prev) => (prev === chip.key ? "all" : chip.key));
  }, []);

  const handleDifficultySelect = useCallback((d: DifficultyFilter) => {
    setDifficulty(d);
  }, []);

  const handleOpenSession = useCallback(
    (session: SessionListItem) => {
      router.push(getSessionPressDestination(session, plan));
    },
    [plan],
  );

  // -- Scroll / sticky --

  const handleAboveChipsLayout = useCallback((e: LayoutChangeEvent) => {
    setChipStickyOffset(e.nativeEvent.layout.height);
  }, []);

  const handleScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const y = e.nativeEvent.contentOffset.y;
      setIsChipSticky((prev) => {
        const shouldStick =
          chipStickyOffset < Infinity && y >= chipStickyOffset;
        return prev === shouldStick ? prev : shouldStick;
      });
    },
    [chipStickyOffset],
  );

  // -- Dropdown anchor --
  const STICKY_TITLE_H = 44;
  const dropdownTop = insets.top + STICKY_TITLE_H + CHIP_ROW_H;

  // -- Render helpers --

  const renderHeader = () => (
    <>
      <View onLayout={handleAboveChipsLayout}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={styles.headerTitle}>{"\ud648"}</Text>
        </View>

        {/* Continue Learning */}
        {continueSessions.length > 0 && (
          <View style={styles.continueSection}>
            <View style={styles.sectionHeaderInset}>
              <Text style={styles.sectionTitle}>
                {"\uc774\uc5b4\uc11c \ud559\uc2b5\ud558\uae30"}
              </Text>
            </View>
            <FlatList
              horizontal
              data={continueSessions}
              keyExtractor={(item) => `cont-${item.id}`}
              renderItem={({ item }) => (
                <ContinueCard
                  item={item}
                  onPress={() => handleOpenSession(item)}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.continueList}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            />
          </View>
        )}

        {featuredSpeakers.length > 0 && (
          <View style={styles.speakerSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>인물 큐레이션</Text>
              <Text style={styles.sectionMetaText}>인물별 영상 모아보기</Text>
            </View>
            <FlatList
              horizontal
              data={featuredSpeakers}
              keyExtractor={(item) => `speaker-${item.id}`}
              renderItem={({ item }) => (
                <SpeakerStackCard
                  item={item}
                  onPress={() => router.push(`/speaker/${item.slug}`)}
                />
              )}
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.speakerList}
              ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
            />
          </View>
        )}
      </View>

      {/* Chip Row (in-flow, scrolls with content) */}
      <ChipRow
        activeChip={activeChip}
        onChipPress={handleChipPress}
        difficulty={difficulty}
        onDifficultyPress={() => setShowDifficulty(true)}
      />
    </>
  );

  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      );
    }
    return (
      <View style={styles.emptyContainer}>
        <Text style={styles.emptyText}>
          {error ??
            "\ud574\ub2f9\ud558\ub294 \uc138\uc158\uc774 \uc5c6\uc5b4\uc694"}
        </Text>
        {error && (
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => loadFeed(true)}
          >
            <Text style={styles.retryText}>{"\ub2e4\uc2dc \uc2dc\ub3c4"}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Sticky header + chip overlay */}
      {isChipSticky && (
        <View style={[styles.stickyHeader, { paddingTop: insets.top }]}>
          <View style={styles.stickyHeaderTitle}>
            <Text style={styles.headerTitle}>{"\ud648"}</Text>
          </View>
          <ChipRow
            activeChip={activeChip}
            onChipPress={handleChipPress}
            difficulty={difficulty}
            onDifficultyPress={() => setShowDifficulty(true)}
          />
        </View>
      )}

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <FeedCard item={item} onPress={() => handleOpenSession(item)} />
        )}
        ListHeaderComponent={renderHeader}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        onEndReached={handleEndReached}
        onEndReachedThreshold={0.5}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: 120 + insets.bottom },
        ]}
      />

      {/* Difficulty dropdown */}
      <DifficultyDropdown
        visible={showDifficulty}
        current={difficulty}
        anchorTop={dropdownTop}
        onSelect={handleDifficultySelect}
        onClose={() => setShowDifficulty(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  listContent: {
    paddingBottom: 120,
  },

  // -- Header --
  header: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
  },
  headerTitle: {
    fontSize: font.size["2xl"],
    fontWeight: font.weight.bold,
    letterSpacing: 0.5,
    color: colors.text,
  },

  // -- Continue Learning --
  continueSection: {
    marginBottom: spacing.lg,
    gap: 12,
  },
  sectionTitle: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.text,
  },
  sectionHeaderInset: {
    paddingHorizontal: spacing.md,
  },
  continueList: {
    paddingHorizontal: spacing.md,
  },
  continueCard: {
    width: CONTINUE_CARD_W,
    gap: 8,
  },
  continueThumb: {
    width: CONTINUE_CARD_W,
    height: CONTINUE_CARD_W * (9 / 16),
    borderRadius: radius.lg,
    backgroundColor: colors.bgMuted,
  },
  continueTitle: {
    fontSize: 14,
    fontWeight: font.weight.semibold,
    color: colors.text,
    lineHeight: 19,
  },

  // -- Key Speakers --
  speakerSection: {
    marginTop: spacing.md,
    marginBottom: spacing.lg,
    gap: 12,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
  },
  sectionMetaText: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
  },
  speakerList: {
    paddingHorizontal: spacing.md,
    paddingTop: 2,
  },

  // -- Chip Row --
  chipRow: {
    height: CHIP_ROW_H,
    justifyContent: "center",
    backgroundColor: colors.bg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  chipRowContent: {
    paddingHorizontal: spacing.md,
    gap: 8,
    alignItems: "center",
  },
  stickyHeader: {
    position: "absolute",
    left: 0,
    right: 0,
    zIndex: 10,
    backgroundColor: colors.bg,
  },
  stickyHeaderTitle: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: colors.bgMuted,
  },
  chipActive: {
    backgroundColor: colors.primary,
  },
  chipText: {
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
    color: colors.text,
  },
  chipTextActive: {
    color: colors.textInverse,
  },

  // -- Feed Card --
  feedCard: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  feedThumb: {
    width: SCREEN_WIDTH - spacing.md * 2,
    height: THUMB_HEIGHT,
    borderRadius: radius.lg,
    backgroundColor: colors.bgMuted,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  feedCardInfo: {
    paddingTop: 10,
    gap: 4,
  },
  feedTitle: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.text,
    lineHeight: 22,
  },
  feedMeta: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  durationBadge: {
    position: "absolute",
    bottom: 8,
    right: 8,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },

  // -- Dropdown --
  dropdownOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.15)",
  },
  dropdownMenu: {
    position: "absolute",
    left: spacing.md,
    backgroundColor: colors.bg,
    borderRadius: radius.lg,
    paddingVertical: 4,
    minWidth: 160,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemActive: {
    backgroundColor: colors.bgSubtle,
  },
  dropdownItemText: {
    fontSize: font.size.md,
    color: colors.text,
  },
  dropdownItemTextActive: {
    fontWeight: font.weight.semibold,
  },

  // -- States --
  emptyContainer: {
    paddingTop: 60,
    alignItems: "center",
    gap: 16,
  },
  emptyText: {
    fontSize: font.size.md,
    color: colors.textSecondary,
    fontWeight: font.weight.medium,
    textAlign: "center",
  },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: radius.pill,
  },
  retryText: {
    fontSize: font.size.sm,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  footerLoader: {
    paddingVertical: 24,
    alignItems: "center",
  },
});
