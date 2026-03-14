import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router } from "expo-router";
import { fetchLearningSessions, SessionListItem } from "../../src/lib/api";

const SCREEN_WIDTH = Dimensions.get("window").width;

const COLOR = {
  bg: "#FFFFFF",
  border: "#111111",
  borderLight: "#E0E0E0",
  text: "#111111",
  textMuted: "#888888",
  textInverse: "#FFFFFF",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "BEGINNER",
  intermediate: "INTERMEDIATE",
  advanced: "ADVANCED",
};

const DIFFICULTY_BG: Record<string, string> = {
  beginner: "#111111",
  intermediate: "#555555",
  advanced: "#111111",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SessionCard({ item }: { item: SessionListItem }) {
  const diffLabel = item.difficulty ? DIFFICULTY_LABELS[item.difficulty] : null;
  const diffBg = item.difficulty ? DIFFICULTY_BG[item.difficulty] : "#111111";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() =>
        router.push(`/study/${item.source_video_id}?sessionId=${item.id}`)
      }
      activeOpacity={0.9}
    >
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Text style={styles.thumbnailPlaceholderIcon}>▶</Text>
        </View>
      )}

      <View style={styles.info}>
        <View style={styles.metaRow}>
          {diffLabel ? (
            <View style={[styles.levelBadge, { backgroundColor: diffBg }]}>
              <Text style={styles.levelText}>{diffLabel}</Text>
            </View>
          ) : null}
          <Text style={styles.duration}>{formatDuration(item.duration)}</Text>
        </View>

        <Text style={styles.title} numberOfLines={2}>
          {item.title}
        </Text>

        {item.description ? (
          <Text style={styles.description} numberOfLines={1}>
            {item.description}
          </Text>
        ) : null}

        {item.channel_name ? (
          <Text style={styles.channel} numberOfLines={1}>
            {item.channel_name}
          </Text>
        ) : null}
      </View>
    </TouchableOpacity>
  );
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

  const renderItem = useCallback(
    ({ item }: { item: SessionListItem }) => <SessionCard item={item} />,
    [],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={COLOR.bg} />
        <ActivityIndicator size="small" color={COLOR.text} />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={COLOR.bg} />
        <Text style={styles.stateText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>RETRY</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (sessions.length === 0) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={COLOR.bg} />
        <Text style={styles.stateText}>NO SESSIONS</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLOR.bg} />

      <View style={styles.header}>
        <Text style={styles.headerWordmark}>SHADOWOO</Text>
        <Text style={styles.headerLabel}>SESSIONS</Text>
      </View>

      <FlatList
        data={sessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLOR.bg,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: COLOR.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  stateText: {
    fontSize: 13,
    letterSpacing: 2,
    color: COLOR.textMuted,
    fontWeight: "500",
  },
  retryButton: {
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 20,
    paddingVertical: 8,
  },
  retryText: {
    fontSize: 11,
    letterSpacing: 2,
    color: COLOR.text,
    fontWeight: "600",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
  },
  headerWordmark: {
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: 4,
    color: COLOR.text,
  },
  headerLabel: {
    fontSize: 10,
    letterSpacing: 2,
    color: COLOR.textMuted,
    fontWeight: "500",
  },
  listContent: {
    paddingBottom: 120,
  },
  separator: {
    height: 1,
    backgroundColor: COLOR.borderLight,
  },
  card: {
    backgroundColor: COLOR.bg,
  },
  thumbnail: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (9 / 16),
    backgroundColor: "#F0F0F0",
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailPlaceholderIcon: {
    fontSize: 36,
    color: COLOR.textMuted,
  },
  info: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  levelBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  levelText: {
    fontSize: 9,
    letterSpacing: 2,
    fontWeight: "700",
    color: COLOR.textInverse,
  },
  duration: {
    fontSize: 11,
    letterSpacing: 1,
    color: COLOR.textMuted,
    fontWeight: "500",
  },
  title: {
    fontSize: 17,
    fontWeight: "700",
    color: COLOR.text,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 13,
    color: COLOR.textMuted,
    lineHeight: 18,
  },
  channel: {
    fontSize: 12,
    color: COLOR.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
});
