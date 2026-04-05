import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { fetchLearningSessions, SessionListItem } from "../../src/lib/api";
import { FEED_CATEGORIES } from "../../src/lib/feed-categories";
import { colors, font, radius, spacing } from "../../src/theme";

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function ListItem({
  item,
  onPress,
}: {
  item: SessionListItem;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.listItem}
      onPress={onPress}
      activeOpacity={0.8}
    >
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
          <Ionicons name="musical-notes" size={20} color={colors.textMuted} />
        </View>
      )}
      <View style={styles.itemInfo}>
        <Text style={styles.itemTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={styles.itemSubtitle}>{item.subtitle}</Text>
        ) : null}
        <View style={styles.itemMeta}>
          {item.channel_name ? (
            <Text style={styles.metaText} numberOfLines={1}>
              {item.channel_name}
            </Text>
          ) : null}
          <Text style={styles.metaText}>{formatDuration(item.duration)}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function CollectionScreen() {
  const { key, title } = useLocalSearchParams<{ key: string; title: string }>();
  const decodedTitle = title ? decodeURIComponent(title) : "";
  const insets = useSafeAreaInsets();

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

  const category = useMemo(
    () => FEED_CATEGORIES.find((c) => c.key === key),
    [key],
  );

  const filtered = useMemo(
    () => (category ? sessions.filter(category.filter) : sessions),
    [category, sessions],
  );

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          title: decodedTitle,
          headerTitleAlign: "center",
          headerBackTitle: "",
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: {
            fontSize: font.size.base,
            fontWeight: font.weight.semibold,
            color: colors.text,
          },
          headerTintColor: colors.text,
          headerShadowVisible: false,
        }}
      />

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      ) : error ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={load}>
            <Text style={styles.retryText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : filtered.length === 0 ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>등록된 콘텐츠가 없어요</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ListItem
              item={item}
              onPress={() =>
                router.push(
                  `/study/${item.source_video_id}?sessionId=${item.id}`,
                )
              }
            />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 40 + insets.bottom },
          ]}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

const THUMB_W = 120;
const THUMB_H = 78;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  stateText: {
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
  listContent: {
    paddingTop: spacing.sm,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    gap: spacing.sm + 4,
  },
  thumbnail: {
    width: THUMB_W,
    height: THUMB_H,
    borderRadius: radius.md,
    backgroundColor: colors.bgMuted,
    flexShrink: 0,
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  itemInfo: {
    flex: 1,
    gap: 6,
  },
  itemTitle: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.text,
    lineHeight: 21,
  },
  itemSubtitle: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  itemMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  metaText: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    fontWeight: font.weight.medium,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
    marginHorizontal: spacing.md,
  },
});
