import React, { useCallback, useEffect, useState } from "react";
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

const SOURCE_TYPE_LABELS: Record<string, string> = {
  keynote: "KEYNOTE",
  demo: "DEMO",
  "earnings-call": "EARNINGS",
  podcast: "PODCAST",
  interview: "INTERVIEW",
  panel: "PANEL",
};

const SPEAKING_FUNCTION_LABELS: Record<string, string> = {
  persuade: "PERSUADE",
  "explain-metric": "EXPLAIN METRIC",
  summarize: "SUMMARIZE",
  hedge: "HEDGE",
  disagree: "DISAGREE",
  propose: "PROPOSE",
  "answer-question": "Q&A",
};

const ROLE_RELEVANCE_LABELS: Record<string, string> = {
  engineer: "ENGINEER",
  pm: "PM",
  designer: "DESIGNER",
  founder: "FOUNDER",
  marketer: "MARKETER",
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function SessionCard({ item }: { item: SessionListItem }) {
  const diffLabel = item.difficulty ? DIFFICULTY_LABELS[item.difficulty] : null;
  const diffBg = item.difficulty ? DIFFICULTY_BG[item.difficulty] : "#111111";
  const sourceLabel = item.source_type
    ? SOURCE_TYPE_LABELS[item.source_type]
    : null;
  const speakingLabel = item.speaking_function
    ? SPEAKING_FUNCTION_LABELS[item.speaking_function]
    : null;
  const roleLabels =
    item.role_relevance?.map((role) => ROLE_RELEVANCE_LABELS[role]) ?? [];

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

        {sourceLabel || speakingLabel || item.premium_required ? (
          <View style={styles.taxonomyRow}>
            {sourceLabel ? (
              <View style={styles.taxonomyBadge}>
                <Text style={styles.taxonomyText}>{sourceLabel}</Text>
              </View>
            ) : null}
            {speakingLabel ? (
              <View style={styles.taxonomyBadge}>
                <Text style={styles.taxonomyText}>{speakingLabel}</Text>
              </View>
            ) : null}
            {item.premium_required ? (
              <View style={styles.premiumBadge}>
                <Text style={styles.premiumText}>PREMIUM</Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {roleLabels.length ? (
          <View style={styles.roleRow}>
            {roleLabels.map((role) => (
              <View key={role} style={styles.roleBadge}>
                <Text style={styles.roleText}>{role}</Text>
              </View>
            ))}
          </View>
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
  const [selectedFunction, setSelectedFunction] = useState<string>("all");
  const [selectedSourceType, setSelectedSourceType] = useState<string>("all");

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

  const speakingFunctionOptions = Array.from(
    new Set(
      sessions
        .map((session) => session.speaking_function)
        .filter(
          (value): value is NonNullable<SessionListItem["speaking_function"]> =>
            Boolean(value),
        ),
    ),
  );
  const sourceTypeOptions = Array.from(
    new Set(
      sessions
        .map((session) => session.source_type)
        .filter((value): value is NonNullable<SessionListItem["source_type"]> =>
          Boolean(value),
        ),
    ),
  );
  const filteredSessions = sessions.filter((session) => {
    const matchesFunction =
      selectedFunction === "all" ||
      session.speaking_function === selectedFunction;
    const matchesSourceType =
      selectedSourceType === "all" ||
      session.source_type === selectedSourceType;

    return matchesFunction && matchesSourceType;
  });

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

      <View style={styles.filters}>
        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>SPEAKING FUNCTION</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            <TouchableOpacity
              testID="function-filter-all"
              style={[
                styles.filterChip,
                selectedFunction === "all" && styles.filterChipActive,
              ]}
              onPress={() => setSelectedFunction("all")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedFunction === "all" && styles.filterChipTextActive,
                ]}
              >
                ALL
              </Text>
            </TouchableOpacity>

            {speakingFunctionOptions.map((value) => (
              <TouchableOpacity
                key={value}
                testID={`function-filter-${value}`}
                style={[
                  styles.filterChip,
                  selectedFunction === value && styles.filterChipActive,
                ]}
                onPress={() => setSelectedFunction(value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedFunction === value && styles.filterChipTextActive,
                  ]}
                >
                  {SPEAKING_FUNCTION_LABELS[value]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <View style={styles.filterSection}>
          <Text style={styles.filterLabel}>SOURCE TYPE</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.filterScrollContent}
          >
            <TouchableOpacity
              testID="source-filter-all"
              style={[
                styles.filterChip,
                selectedSourceType === "all" && styles.filterChipActive,
              ]}
              onPress={() => setSelectedSourceType("all")}
              activeOpacity={0.8}
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedSourceType === "all" && styles.filterChipTextActive,
                ]}
              >
                ALL
              </Text>
            </TouchableOpacity>

            {sourceTypeOptions.map((value) => (
              <TouchableOpacity
                key={value}
                testID={`source-filter-${value}`}
                style={[
                  styles.filterChip,
                  selectedSourceType === value && styles.filterChipActive,
                ]}
                onPress={() => setSelectedSourceType(value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    selectedSourceType === value && styles.filterChipTextActive,
                  ]}
                >
                  {SOURCE_TYPE_LABELS[value]}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyStateTitle}>NO MATCHING SESSIONS</Text>
            <Text style={styles.emptyStateText}>
              다른 speaking function 또는 source type을 선택해보세요.
            </Text>
          </View>
        }
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
  filters: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.borderLight,
  },
  filterSection: {
    gap: 8,
  },
  filterLabel: {
    fontSize: 10,
    letterSpacing: 1.6,
    color: COLOR.textMuted,
    fontWeight: "700",
  },
  filterScrollContent: {
    gap: 8,
    paddingRight: 16,
  },
  filterChip: {
    borderWidth: 1,
    borderColor: COLOR.borderLight,
    backgroundColor: COLOR.bg,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  filterChipActive: {
    borderColor: COLOR.border,
    backgroundColor: COLOR.border,
  },
  filterChipText: {
    fontSize: 10,
    letterSpacing: 1.1,
    color: COLOR.textMuted,
    fontWeight: "700",
  },
  filterChipTextActive: {
    color: COLOR.textInverse,
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
  taxonomyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  roleRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  taxonomyBadge: {
    borderWidth: 1,
    borderColor: COLOR.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F7F7F7",
  },
  taxonomyText: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLOR.textMuted,
    fontWeight: "600",
  },
  premiumBadge: {
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: COLOR.text,
  },
  premiumText: {
    fontSize: 10,
    letterSpacing: 1.2,
    color: COLOR.textInverse,
    fontWeight: "700",
  },
  roleBadge: {
    borderWidth: 1,
    borderColor: COLOR.borderLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: "#F7F7F7",
  },
  roleText: {
    fontSize: 9,
    letterSpacing: 1.1,
    color: COLOR.textMuted,
    fontWeight: "600",
  },
  channel: {
    fontSize: 12,
    color: COLOR.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  emptyState: {
    paddingHorizontal: 24,
    paddingTop: 48,
    alignItems: "center",
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 12,
    letterSpacing: 1.8,
    color: COLOR.text,
    fontWeight: "700",
  },
  emptyStateText: {
    fontSize: 12,
    lineHeight: 18,
    color: COLOR.textMuted,
    textAlign: "center",
  },
});
