import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchLearningSessions, SessionListItem } from "../../src/lib/api";
import { FEED_CATEGORIES } from "../../src/lib/feed-categories";
import { colors, radius, font, spacing } from "../../src/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const CARD_SIZE = (SCREEN_WIDTH - spacing.md * 2 - 12) / 1.4;

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  if (m === 0) return `${s}초`;
  if (s === 0) return `${m}분`;
  return `${m}분 ${s}초`;
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
      <View>
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
        <View style={styles.durationBadge}>
          <Text style={styles.durationBadgeText}>
            {formatDuration(item.duration)}
          </Text>
        </View>
      </View>
      <Text style={styles.squareTitle} numberOfLines={2}>
        {item.title}
      </Text>
      {item.subtitle ? (
        <Text style={styles.squareSubtitle}>{item.subtitle}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// -- Category Section --

function CategorySection({
  title,
  sessions,
  onSessionPress,
  onTitlePress,
}: {
  title: string;
  sessions: SessionListItem[];
  onSessionPress: (s: SessionListItem) => void;
  onTitlePress?: () => void;
}) {
  if (sessions.length === 0) return null;

  return (
    <View style={styles.categorySection}>
      <TouchableOpacity
        style={styles.categoryHeader}
        onPress={onTitlePress}
        activeOpacity={0.7}
        disabled={!onTitlePress}
      >
        <Text style={styles.categoryTitle}>{title}</Text>
        {onTitlePress && (
          <Ionicons name="chevron-forward" size={20} color={colors.text} />
        )}
      </TouchableOpacity>
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
  const insets = useSafeAreaInsets();

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
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 120 + insets.bottom },
        ]}
      >
        <View style={[styles.header, { paddingTop: insets.top + spacing.lg }]}>
          <Text style={styles.headerWordmark}>홈</Text>
        </View>

        {categoryData.map((cat) => (
          <CategorySection
            key={cat.key}
            title={cat.title}
            sessions={cat.sessions}
            onSessionPress={navigateToStudy}
            onTitlePress={() =>
              router.push(
                `/collection/${cat.key}?title=${encodeURIComponent(cat.title)}`,
              )
            }
          />
        ))}
      </ScrollView>
    </View>
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

  // -- Header --
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  headerWordmark: {
    fontSize: font.size["2xl"],
    fontWeight: font.weight.bold,
    letterSpacing: 0.5,
    color: colors.text,
  },

  // -- Category Section --
  categorySection: {
    marginTop: spacing.xl,
    gap: 12,
  },
  categoryHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.md,
  },
  categoryTitle: {
    fontSize: font.size.xl,
    fontWeight: font.weight.bold,
    color: colors.text,
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
    height: CARD_SIZE * (3 / 5),
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
  squareSubtitle: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  durationBadge: {
    position: "absolute",
    bottom: 6,
    right: 6,
    backgroundColor: "rgba(0,0,0,0.75)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  durationBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
});
