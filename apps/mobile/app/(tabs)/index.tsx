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
import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import BottomSheet from "../../src/components/common/BottomSheet";
import { fetchLearningSessions, SessionListItem } from "../../src/lib/api";
import {
  DIFFICULTY_LABELS,
  SOURCE_TYPE_LABELS,
  SPEAKING_FUNCTION_LABELS,
} from "../../src/lib/professional-labels";
import { colors, radius, font, spacing, shadow } from "../../src/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;

const DIFFICULTY_BG: Record<string, string> = {
  beginner: colors.primary,
  intermediate: colors.textSecondary,
  advanced: colors.primary,
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ── FilterDropdown ──

interface FilterDropdownProps {
  label: string;
  value: string;
  options: { key: string; label: string }[];
  onSelect: (key: string) => void;
}

function FilterDropdown({
  label,
  value,
  options,
  onSelect,
}: FilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);
  const isFiltered = value !== "all";

  return (
    <>
      <TouchableOpacity
        style={[
          styles.dropdownTrigger,
          isFiltered && styles.dropdownTriggerActive,
        ]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text
          style={[
            styles.dropdownTriggerText,
            isFiltered && styles.dropdownTriggerTextActive,
          ]}
          numberOfLines={1}
        >
          {isFiltered ? selected?.label : label}
        </Text>
        <Ionicons
          name="chevron-down"
          size={14}
          color={isFiltered ? colors.textInverse : colors.textSecondary}
        />
      </TouchableOpacity>

      <BottomSheet visible={open} onClose={() => setOpen(false)}>
        <Text style={styles.sheetTitle}>{label}</Text>
        {options.map((opt) => {
          const active = opt.key === value;
          return (
            <TouchableOpacity
              key={opt.key}
              style={[styles.sheetItem, active && styles.sheetItemActive]}
              onPress={() => {
                onSelect(opt.key);
                setOpen(false);
              }}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.sheetItemText,
                  active && styles.sheetItemTextActive,
                ]}
              >
                {opt.label}
              </Text>
              {active && (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={colors.textInverse}
                />
              )}
            </TouchableOpacity>
          );
        })}
      </BottomSheet>
    </>
  );
}

// ── SessionCard ──

function SessionCard({ item }: { item: SessionListItem }) {
  const diffLabel = item.difficulty ? DIFFICULTY_LABELS[item.difficulty] : null;
  const diffBg = item.difficulty ? DIFFICULTY_BG[item.difficulty] : "#111111";
  const sourceLabel = item.source_type
    ? SOURCE_TYPE_LABELS[item.source_type]
    : null;
  const speakingLabel = item.speaking_function
    ? SPEAKING_FUNCTION_LABELS[item.speaking_function]
    : null;

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
                <Ionicons
                  name="cash-outline"
                  size={10}
                  color={colors.textInverse}
                />
                <Text style={styles.premiumText}>프리미엄</Text>
              </View>
            ) : null}
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

// ── HomeScreen ──

export default function HomeScreen() {
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
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

  const difficultyOptions: { key: string; label: string }[] = [
    { key: "all", label: "전체" },
    ...Array.from(
      new Set(
        sessions
          .map((s) => s.difficulty)
          .filter((v): v is NonNullable<SessionListItem["difficulty"]> =>
            Boolean(v),
          ),
      ),
    ).map((v) => ({ key: v, label: DIFFICULTY_LABELS[v] })),
  ];

  const speakingFunctionOpts: { key: string; label: string }[] = [
    { key: "all", label: "전체" },
    ...Array.from(
      new Set(
        sessions
          .map((s) => s.speaking_function)
          .filter((v): v is NonNullable<SessionListItem["speaking_function"]> =>
            Boolean(v),
          ),
      ),
    ).map((v) => ({ key: v, label: SPEAKING_FUNCTION_LABELS[v] })),
  ];

  const sourceTypeOpts: { key: string; label: string }[] = [
    { key: "all", label: "전체" },
    ...Array.from(
      new Set(
        sessions
          .map((s) => s.source_type)
          .filter((v): v is NonNullable<SessionListItem["source_type"]> =>
            Boolean(v),
          ),
      ),
    ).map((v) => ({ key: v, label: SOURCE_TYPE_LABELS[v] })),
  ];

  const filteredSessions = sessions.filter((session) => {
    const matchesDifficulty =
      selectedDifficulty === "all" || session.difficulty === selectedDifficulty;
    const matchesFunction =
      selectedFunction === "all" ||
      session.speaking_function === selectedFunction;
    const matchesSourceType =
      selectedSourceType === "all" ||
      session.source_type === selectedSourceType;
    return matchesDifficulty && matchesFunction && matchesSourceType;
  });

  const activeFilterCount = [
    selectedDifficulty,
    selectedFunction,
    selectedSourceType,
  ].filter((v) => v !== "all").length;

  const renderItem = useCallback(
    ({ item }: { item: SessionListItem }) => <SessionCard item={item} />,
    [],
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <ActivityIndicator size="small" color={colors.text} />
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      <View style={styles.header}>
        <Text style={styles.headerWordmark}>인풋영어</Text>
        <Text style={styles.headerLabel}>업무 영어 세션</Text>
      </View>

      {/* ── Filter dropdowns ── */}
      <View style={styles.filterBar}>
        <FilterDropdown
          label="난이도"
          value={selectedDifficulty}
          options={difficultyOptions}
          onSelect={setSelectedDifficulty}
        />
        <FilterDropdown
          label="말하기 목적"
          value={selectedFunction}
          options={speakingFunctionOpts}
          onSelect={setSelectedFunction}
        />
        <FilterDropdown
          label="콘텐츠 형식"
          value={selectedSourceType}
          options={sourceTypeOpts}
          onSelect={setSelectedSourceType}
        />
        {activeFilterCount > 0 && (
          <TouchableOpacity
            style={styles.resetButton}
            onPress={() => {
              setSelectedDifficulty("all");
              setSelectedFunction("all");
              setSelectedSourceType("all");
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.resetText}>초기화</Text>
          </TouchableOpacity>
        )}
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
            <Text style={styles.emptyStateTitle}>
              조건에 맞는 세션이 없어요
            </Text>
            <Text style={styles.emptyStateText}>
              필터를 변경하거나 초기화해보세요.
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
    backgroundColor: colors.bg,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  stateText: {
    fontSize: 13,
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
    fontSize: 11,
    color: colors.text,
    fontWeight: "600",
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: "row",
    alignItems: "baseline",
    gap: 12,
  },
  headerWordmark: {
    fontSize: 18,
    fontWeight: font.weight.semibold,
    letterSpacing: 2,
    color: colors.text,
  },
  headerLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
  },

  // ── Filter bar ──
  filterBar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },

  // ── Dropdown trigger ──
  dropdownTrigger: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    paddingVertical: 7,
    gap: 4,
    borderRadius: radius.pill,
  },
  dropdownTriggerActive: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dropdownTriggerText: {
    fontSize: 11,
    fontWeight: font.weight.semibold,
    color: colors.textSecondary,
    letterSpacing: 0.5,
  },
  dropdownTriggerTextActive: {
    color: colors.textInverse,
  },

  // ── Bottom sheet content ──
  sheetTitle: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 2,
    color: colors.textSecondary,
    textTransform: "uppercase",
    paddingHorizontal: 20,
    paddingBottom: 12,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  sheetItemActive: {
    backgroundColor: colors.primary,
  },
  sheetItemText: {
    fontSize: 15,
    fontWeight: "600",
    color: colors.text,
  },
  sheetItemTextActive: {
    color: colors.textInverse,
  },

  // ── Reset ──
  resetButton: {
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  resetText: {
    fontSize: 11,
    fontWeight: "600",
    color: colors.textSecondary,
    textDecorationLine: "underline",
  },

  // ── List ──
  listContent: {
    paddingBottom: 120,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },

  // ── Card ──
  card: {
    backgroundColor: colors.bg,
  },
  thumbnail: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (9 / 16),
    backgroundColor: colors.bgMuted,
  },
  thumbnailPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  thumbnailPlaceholderIcon: {
    fontSize: 36,
    color: colors.textSecondary,
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
    borderRadius: radius.pill,
  },
  levelText: {
    fontSize: 10,
    fontWeight: "700",
    color: colors.textInverse,
  },
  duration: {
    fontSize: 11,
    letterSpacing: 1,
    color: colors.textSecondary,
    fontWeight: "500",
  },
  title: {
    fontSize: 17,
    fontWeight: font.weight.semibold,
    color: colors.text,
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  description: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  taxonomyRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  taxonomyBadge: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.pill,
  },
  taxonomyText: {
    fontSize: 10,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
  },
  premiumText: {
    fontSize: 10,
    color: colors.textInverse,
    fontWeight: "700",
  },
  channel: {
    fontSize: 12,
    color: colors.textSecondary,
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
    fontSize: 14,
    color: colors.text,
    fontWeight: "700",
  },
  emptyStateText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
