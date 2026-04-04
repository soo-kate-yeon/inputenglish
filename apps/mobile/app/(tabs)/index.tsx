import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { fetchLearningSessions, SessionListItem } from "../../src/lib/api";
import { colors, radius, font, spacing } from "../../src/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_SIZE = (SCREEN_WIDTH - spacing.md * 2 - 12) / 2.4;
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * 0.68);
const HERO_MAX = 5;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// -- Feed Categories --

interface FeedCategory {
  key: string;
  title: string;
  filter: (s: SessionListItem) => boolean;
}

const FEED_CATEGORIES: FeedCategory[] = [
  {
    key: "podcast",
    title: "팟캐스트",
    filter: (s) => s.source_type === "podcast",
  },
  {
    key: "interview",
    title: "인터뷰",
    filter: (s) => s.source_type === "interview",
  },
  {
    key: "persuade",
    title: "설득하는 말하기",
    filter: (s) => s.speaking_function === "persuade",
  },
];

// -- Hero Banner Slide --

function HeroBannerSlide({
  item,
  onPress,
}: {
  item: SessionListItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.heroSlide}
      onPress={onPress}
      activeOpacity={0.95}
    >
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={StyleSheet.absoluteFill}
          resizeMode="cover"
        />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]} />
      )}

      <LinearGradient
        colors={["rgba(0,0,0,0.1)", "rgba(0,0,0,0.78)"]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.heroContent}>
        <Text style={styles.heroDuration}>{formatDuration(item.duration)}</Text>
        <Text style={styles.heroTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.expected_takeaway && (
          <Text style={styles.heroTakeaway} numberOfLines={2}>
            {item.expected_takeaway}
          </Text>
        )}
        {item.channel_name && (
          <Text style={styles.heroChannel}>{item.channel_name}</Text>
        )}
      </View>

      <View style={styles.heroPlayButton}>
        <Ionicons name="play" size={18} color={colors.text} />
      </View>
    </TouchableOpacity>
  );
}

// -- Hero Carousel --

function HeroCarousel({
  items,
  onPress,
}: {
  items: SessionListItem[];
  onPress: (item: SessionListItem) => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    setActiveIndex(idx);
  }, []);

  return (
    <View style={styles.heroCarousel}>
      <FlatList
        data={items}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <HeroBannerSlide item={item} onPress={() => onPress(item)} />
        )}
      />

      {/* Title + dots overlay — non-interactive */}
      <View style={styles.heroOverlay} pointerEvents="none">
        <Text style={styles.heroHeaderTitle}>홈</Text>
        {items.length > 1 && (
          <View style={styles.heroDots}>
            {items.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.heroDot,
                  i === activeIndex && styles.heroDotActive,
                ]}
              />
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

// -- Square Card --

function SquareCard({
  item,
  onPress,
}: {
  item: SessionListItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.squareCard}
      onPress={onPress}
      activeOpacity={0.85}
    >
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.squareThumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.squareThumb, styles.squareThumbPlaceholder]}>
          <Ionicons name="musical-notes" size={24} color={colors.textMuted} />
        </View>
      )}
      <Text style={styles.squareTitle} numberOfLines={2}>
        {item.title}
      </Text>
      <Text style={styles.squareMeta}>{formatDuration(item.duration)}</Text>
    </TouchableOpacity>
  );
}

// -- Category Section --

function CategorySection({
  title,
  sessions,
  onSessionPress,
}: {
  title: string;
  sessions: SessionListItem[];
  onSessionPress: (s: SessionListItem) => void;
}) {
  if (sessions.length === 0) return null;

  return (
    <View style={styles.categorySection}>
      <Text style={styles.categoryTitle}>{title}</Text>
      <FlatList
        horizontal
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <SquareCard item={item} onPress={() => onSessionPress(item)} />
        )}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.categoryList}
        ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
      />
    </View>
  );
}

// -- HomeScreen --

function navigateToStudy(session: SessionListItem) {
  router.push(`/study/${session.source_video_id}?sessionId=${session.id}`);
}

export default function HomeScreen() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchLearningSessions()
      .then(setSessions)
      .catch((e) => setError(e.message ?? "세션 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const heroItems = useMemo(() => sessions.slice(0, HERO_MAX), [sessions]);

  const categoryData = useMemo(
    () =>
      FEED_CATEGORIES.map((cat) => ({
        ...cat,
        sessions: sessions.filter(cat.filter),
      })),
    [sessions],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (sessions.length === 0) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <Text style={styles.stateText}>아직 등록된 세션이 없어요</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <HeroCarousel items={heroItems} onPress={navigateToStudy} />

        {categoryData.map((cat) => (
          <CategorySection
            key={cat.key}
            title={cat.title}
            sessions={cat.sessions}
            onSessionPress={navigateToStudy}
          />
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scrollContent: {
    paddingBottom: 120,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  stateText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: "500",
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
    fontSize: 13,
    color: colors.text,
    fontWeight: "600",
  },

  // -- Hero Carousel --
  heroCarousel: {
    height: HERO_HEIGHT,
  },
  heroSlide: {
    width: SCREEN_WIDTH,
    height: HERO_HEIGHT,
    backgroundColor: colors.bgInverse,
  },
  heroPlaceholder: {
    backgroundColor: colors.bgInverse,
  },
  heroContent: {
    position: "absolute",
    bottom: 36,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.md,
    gap: 4,
  },
  heroDuration: {
    fontSize: 12,
    color: "rgba(255,255,255,0.65)",
    fontWeight: "500",
  },
  heroTitle: {
    fontSize: font.size["2xl"],
    fontWeight: font.weight.bold,
    color: "#fff",
    lineHeight: 34,
  },
  heroTakeaway: {
    fontSize: font.size.sm,
    color: "rgba(255,255,255,0.75)",
    lineHeight: 18,
    fontWeight: "400",
  },
  heroChannel: {
    fontSize: 14,
    color: "rgba(255,255,255,0.6)",
    fontWeight: "500",
  },
  heroPlayButton: {
    position: "absolute",
    top: spacing.md,
    right: spacing.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "space-between",
    paddingTop: 16,
    paddingBottom: 12,
  },
  heroHeaderTitle: {
    color: "#fff",
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    paddingHorizontal: spacing.md,
  },
  heroDots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
  },
  heroDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "rgba(255,255,255,0.4)",
  },
  heroDotActive: {
    width: 18,
    backgroundColor: "#fff",
  },

  // -- Category Section --
  categorySection: {
    marginTop: spacing.xl,
    gap: 12,
  },
  categoryTitle: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.text,
    paddingHorizontal: spacing.md,
  },
  categoryList: {
    paddingHorizontal: spacing.md,
  },

  // -- Square Card --
  squareCard: {
    width: CARD_SIZE,
    gap: 8,
  },
  squareThumb: {
    width: CARD_SIZE,
    height: CARD_SIZE,
    borderRadius: radius.lg,
    backgroundColor: colors.bgMuted,
  },
  squareThumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  squareTitle: {
    fontSize: 15,
    fontWeight: font.weight.semibold,
    color: colors.text,
    lineHeight: 20,
  },
  squareMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "500",
  },
});
