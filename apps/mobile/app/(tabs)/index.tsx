// @MX:NOTE: [AUTO] Home tab showing curated video list loaded from Supabase.
// @MX:SPEC: SPEC-MOBILE-003 - REQ-E-001, AC-006
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Image,
} from "react-native";
import { router } from "expo-router";
import { fetchCuratedVideos, VideoListItem } from "../../src/lib/api";

const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "#4CAF50",
  intermediate: "#FF9800",
  advanced: "#F44336",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  beginner: "초급",
  intermediate: "중급",
  advanced: "고급",
};

function VideoCard({ item }: { item: VideoListItem }) {
  const diffColor = item.difficulty
    ? DIFFICULTY_COLORS[item.difficulty]
    : "#999";
  const diffLabel = item.difficulty ? DIFFICULTY_LABELS[item.difficulty] : "";

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={() => router.push(`/study/${item.video_id}`)}
      activeOpacity={0.75}
    >
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Text style={styles.thumbnailPlaceholderText}>▶</Text>
        </View>
      )}
      <View style={styles.cardInfo}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.channel_name ? (
          <Text style={styles.channelName} numberOfLines={1}>
            {item.channel_name}
          </Text>
        ) : null}
        {diffLabel ? (
          <View style={[styles.diffBadge, { backgroundColor: diffColor }]}>
            <Text style={styles.diffBadgeText}>{diffLabel}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen() {
  const [videos, setVideos] = useState<VideoListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchCuratedVideos()
      .then(setVideos)
      .catch((e) => setError(e.message ?? "영상 목록을 불러오지 못했습니다."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const renderItem = useCallback(
    ({ item }: { item: VideoListItem }) => <VideoCard item={item} />,
    [],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={load}>
          <Text style={styles.retryText}>다시 시도</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  if (videos.length === 0) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.emptyText}>큐레이션 영상이 없습니다.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Shadowoo</Text>
        <Text style={styles.headerSubtitle}>오늘의 영어 학습 영상</Text>
      </View>
      <FlatList
        data={videos}
        keyExtractor={(item) => item.video_id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f8f8f8",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#007AFF",
  },
  headerSubtitle: {
    fontSize: 13,
    color: "#888",
    marginTop: 2,
  },
  listContent: {
    padding: 12,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  thumbnail: {
    width: "100%",
    aspectRatio: 16 / 9,
  },
  thumbnailPlaceholder: {
    backgroundColor: "#ddd",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailPlaceholderText: {
    fontSize: 32,
    color: "#999",
  },
  cardInfo: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#222",
    lineHeight: 21,
  },
  channelName: {
    fontSize: 12,
    color: "#888",
    marginTop: 4,
  },
  diffBadge: {
    alignSelf: "flex-start",
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  diffBadgeText: {
    fontSize: 11,
    color: "#fff",
    fontWeight: "600",
  },
  errorText: {
    fontSize: 16,
    color: "#e00",
    textAlign: "center",
    paddingHorizontal: 24,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: "#007AFF",
    borderRadius: 8,
  },
  retryText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  emptyText: {
    fontSize: 15,
    color: "#888",
  },
});
