// @MX:ANCHOR: ArchiveScreen - saved sentences + highlights + playbook with swipe-to-delete
// @MX:REASON: [AUTO] fan_in >= 3: tab navigator, deep links, and study flow navigation
// @MX:SPEC: SPEC-MOBILE-005 - REQ-E-004, REQ-E-005, REQ-N-001, REQ-C-002
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchLearningSessions,
  fetchPlaybookEntries,
  updatePlaybookEntryMastery,
  SessionListItem,
} from "@/lib/api";
import { appStore } from "@/lib/stores";
import type {
  AppHighlight,
  PlaybookEntry,
  PlaybookMasteryStatus,
  SavedSentence,
} from "@inputenglish/shared";
import UndoToast from "@/components/common/UndoToast";
import ErrorToast from "@/components/common/ErrorToast";
import SwipeableRow from "@/components/common/SwipeableRow";
import PlaybookCard from "@/components/study/PlaybookCard";

type Tab = "sentences" | "highlights" | "playbook";

interface PendingDelete {
  id: string;
  type: Tab;
  timer: ReturnType<typeof setTimeout>;
}

export default function ArchiveScreen() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const savedSentences = appStore((state) => state.savedSentences);
  const highlights = appStore((state) => state.highlights);
  const getVideo = appStore((state) => state.getVideo);
  const loadUserData = appStore((state) => state.loadUserData);
  const removeSavedSentence = appStore((state) => state.removeSavedSentence);
  const removeHighlight = appStore((state) => state.removeHighlight);

  const [activeTab, setActiveTab] = useState<Tab>("sentences");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [playbookEntries, setPlaybookEntries] = useState<PlaybookEntry[]>([]);
  const [playbookLoading, setPlaybookLoading] = useState(false);
  const [sessionMap, setSessionMap] = useState<Record<string, string>>({});
  const [errorToast, setErrorToast] = useState<{
    message: string;
    retry?: () => void;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated || !user?.id) return;

      setPlaybookLoading(true);
      Promise.all([
        loadUserData(),
        fetchPlaybookEntries(user.id),
        fetchLearningSessions(),
      ])
        .then(([, entries, sessions]) => {
          setPlaybookEntries(entries);
          const map: Record<string, string> = {};
          for (const s of sessions as SessionListItem[]) {
            map[s.id] = s.title;
          }
          setSessionMap(map);
        })
        .catch((error) => {
          console.error("[MobileArchive] Failed to load archive data:", error);
        })
        .finally(() => setPlaybookLoading(false));
    }, [isAuthenticated, loadUserData, user?.id]),
  );

  // REQ-E-004, REQ-C-002: undo delete with 3-second timer
  const handleDelete = useCallback(
    (id: string, type: Tab) => {
      if (pendingDelete) {
        clearTimeout(pendingDelete.timer);
        const prevType = pendingDelete.type;
        const prevId = pendingDelete.id;
        if (prevType === "sentences") {
          removeSavedSentence(prevId).catch(() => {
            setErrorToast({ message: "삭제에 실패했습니다." });
          });
        } else if (prevType === "highlights") {
          removeHighlight(prevId).catch(() => {
            setErrorToast({ message: "삭제에 실패했습니다." });
          });
        } else {
          // playbook — remove from local state immediately
          setPlaybookEntries((prev) => prev.filter((e) => e.id !== prevId));
        }
      }

      const timer = setTimeout(() => {
        if (type === "sentences") {
          removeSavedSentence(id).catch(() => {
            setErrorToast({
              message: "삭제에 실패했습니다.",
              retry: () => handleDelete(id, type),
            });
          });
        } else if (type === "highlights") {
          removeHighlight(id).catch(() => {
            setErrorToast({
              message: "삭제에 실패했습니다.",
              retry: () => handleDelete(id, type),
            });
          });
        } else {
          setPlaybookEntries((prev) => prev.filter((e) => e.id !== id));
        }
        setPendingDelete(null);
      }, 3000);

      setPendingDelete({ id, type, timer });
    },
    [pendingDelete, removeSavedSentence, removeHighlight],
  );

  const handleUndo = useCallback(() => {
    if (pendingDelete) {
      clearTimeout(pendingDelete.timer);
      setPendingDelete(null);
    }
  }, [pendingDelete]);

  const handleSetMastery = useCallback(
    async (entry: PlaybookEntry, status: PlaybookMasteryStatus) => {
      if (!user?.id) return;

      setPlaybookEntries((prev) =>
        prev.map((item) =>
          item.id === entry.id
            ? {
                ...item,
                mastery_status: status,
                updated_at: new Date().toISOString(),
              }
            : item,
        ),
      );

      try {
        await updatePlaybookEntryMastery(user.id, entry.id, status);
      } catch (error) {
        console.error("[MobileArchive] Failed to update mastery:", error);
        setPlaybookEntries((prev) =>
          prev.map((item) => (item.id === entry.id ? entry : item)),
        );
      }
    },
    [user?.id],
  );

  const visibleSentences = savedSentences.filter(
    (s) => s.id !== pendingDelete?.id || pendingDelete.type !== "sentences",
  );
  const visibleHighlights = highlights.filter(
    (h) => h.id !== pendingDelete?.id || pendingDelete.type !== "highlights",
  );
  const visiblePlaybookEntries = playbookEntries.filter(
    (e) => e.id !== pendingDelete?.id || pendingDelete.type !== "playbook",
  );

  const renderSentenceItem = useCallback(
    ({ item }: { item: SavedSentence }) => {
      const videoTitle = getVideo(item.videoId)?.title ?? item.videoId;
      return (
        <SwipeableRow onDelete={() => handleDelete(item.id, "sentences")}>
          <View style={styles.card}>
            <Text style={styles.videoTitle} numberOfLines={1}>
              {videoTitle}
            </Text>
            <Text style={styles.sentenceText}>{item.sentenceText}</Text>
            <Text style={styles.timestamp}>
              {new Date(item.createdAt).toLocaleString("ko-KR")}
            </Text>
          </View>
        </SwipeableRow>
      );
    },
    [getVideo, handleDelete],
  );

  const renderHighlightItem = useCallback(
    ({ item }: { item: AppHighlight }) => {
      const videoTitle = getVideo(item.videoId)?.title ?? item.videoId;
      return (
        <SwipeableRow onDelete={() => handleDelete(item.id, "highlights")}>
          <View style={styles.card}>
            <Text style={styles.videoTitle} numberOfLines={1}>
              {videoTitle}
            </Text>
            <Text style={styles.sentenceText}>{item.originalText}</Text>
            {item.userNote ? (
              <Text style={styles.userNote}>{item.userNote}</Text>
            ) : null}
            <Text style={styles.timestamp}>
              {new Date(item.createdAt).toLocaleString("ko-KR")}
            </Text>
          </View>
        </SwipeableRow>
      );
    },
    [getVideo, handleDelete],
  );

  const renderPlaybookItem = useCallback(
    ({ item }: { item: PlaybookEntry }) => (
      <SwipeableRow onDelete={() => handleDelete(item.id, "playbook")}>
        <PlaybookCard
          entry={item}
          sessionTitle={sessionMap[item.session_id]}
          onSetMastery={handleSetMastery}
        />
      </SwipeableRow>
    ),
    [handleSetMastery, handleDelete, sessionMap],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <ActivityIndicator size="small" color="#111111" />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
        <Text style={styles.stateLabel}>보관함</Text>
        <Text style={styles.stateSubtext}>
          로그인 후 저장한 문장을 볼 수 있어요.
        </Text>
      </SafeAreaView>
    );
  }

  const isSentencesTab = activeTab === "sentences";
  const isPlaybookTab = activeTab === "playbook";
  const emptyText = isSentencesTab
    ? "저장한 문장이 없습니다."
    : isPlaybookTab
      ? "플레이북에 저장된 문장이 없습니다."
      : "하이라이트가 없습니다.";
  const emptySubtext = isSentencesTab
    ? "리스닝 화면에서 북마크한 문장이 여기에 표시됩니다."
    : isPlaybookTab
      ? "변형 연습에서 저장한 문장이 여기에 표시됩니다."
      : "학습 화면에서 문장을 꾹 눌러 하이라이트를 추가하세요.";

  const currentData = isSentencesTab
    ? visibleSentences
    : isPlaybookTab
      ? visiblePlaybookEntries
      : visibleHighlights;

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerWordmark}>보관함</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, isSentencesTab && styles.tabActive]}
          onPress={() => setActiveTab("sentences")}
        >
          <Text
            style={[styles.tabText, isSentencesTab && styles.tabTextActive]}
          >
            문장
          </Text>
          <Text
            style={[styles.tabCount, isSentencesTab && styles.tabCountActive]}
          >
            {savedSentences.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === "highlights" && styles.tabActive]}
          onPress={() => setActiveTab("highlights")}
        >
          <Text
            style={[
              styles.tabText,
              activeTab === "highlights" && styles.tabTextActive,
            ]}
          >
            하이라이트
          </Text>
          <Text
            style={[
              styles.tabCount,
              activeTab === "highlights" && styles.tabCountActive,
            ]}
          >
            {highlights.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, isPlaybookTab && styles.tabActive]}
          onPress={() => setActiveTab("playbook")}
        >
          <Text style={[styles.tabText, isPlaybookTab && styles.tabTextActive]}>
            플레이북
          </Text>
          <Text
            style={[styles.tabCount, isPlaybookTab && styles.tabCountActive]}
          >
            {playbookEntries.length}
          </Text>
        </TouchableOpacity>
      </View>

      {playbookLoading && isPlaybookTab ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color="#111111" />
        </View>
      ) : currentData.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>{emptyText}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtext}</Text>
        </View>
      ) : (
        <FlatList
          data={currentData as (SavedSentence | AppHighlight | PlaybookEntry)[]}
          keyExtractor={(item) => item.id}
          renderItem={
            isSentencesTab
              ? (renderSentenceItem as never)
              : isPlaybookTab
                ? (renderPlaybookItem as never)
                : (renderHighlightItem as never)
          }
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Undo Toast */}
      <UndoToast
        visible={pendingDelete !== null}
        message="삭제되었습니다."
        onUndo={handleUndo}
      />

      {/* Error Toast */}
      <ErrorToast
        visible={errorToast !== null}
        message={errorToast?.message ?? ""}
        onRetry={errorToast?.retry}
        onDismiss={() => setErrorToast(null)}
      />
    </SafeAreaView>
  );
}

// --- Design tokens (square minimalism) ---
const COLOR = {
  bg: "#FFFFFF",
  border: "#111111",
  borderLight: "#E0E0E0",
  text: "#111111",
  textMuted: "#888888",
  noteBg: "#F5F5F5",
};

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
    gap: 10,
  },
  stateLabel: {
    fontSize: 15,
    color: COLOR.text,
    fontWeight: "700",
  },
  stateSubtext: {
    fontSize: 12,
    color: COLOR.textMuted,
    letterSpacing: 0.3,
  },

  // Header
  header: {
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.border,
  },
  headerWordmark: {
    fontSize: 18,
    fontWeight: "800",
    color: COLOR.text,
  },

  // Tab bar
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: COLOR.borderLight,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: COLOR.border,
  },
  tabText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLOR.textMuted,
  },
  tabTextActive: {
    color: COLOR.text,
  },
  tabCount: {
    fontSize: 10,
    letterSpacing: 1,
    color: COLOR.textMuted,
    fontWeight: "500",
  },
  tabCountActive: {
    color: COLOR.text,
  },

  // List
  listContent: {
    paddingBottom: 120,
  },
  separator: {
    height: 1,
    backgroundColor: COLOR.borderLight,
  },

  // Card (sentences / highlights)
  card: {
    backgroundColor: COLOR.bg,
    padding: 16,
    gap: 8,
  },
  videoTitle: {
    fontSize: 10,
    color: COLOR.textMuted,
    fontWeight: "600",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  sentenceText: {
    fontSize: 16,
    lineHeight: 24,
    color: COLOR.text,
    fontWeight: "400",
  },
  userNote: {
    fontSize: 13,
    color: COLOR.text,
    backgroundColor: COLOR.noteBg,
    padding: 10,
    lineHeight: 19,
    borderLeftWidth: 2,
    borderLeftColor: COLOR.border,
  },
  timestamp: {
    fontSize: 11,
    color: COLOR.textMuted,
    letterSpacing: 0.3,
    marginTop: 2,
  },

  // Empty state
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 13,
    letterSpacing: 1,
    color: COLOR.text,
    fontWeight: "600",
  },
  emptySubtitle: {
    fontSize: 12,
    color: COLOR.textMuted,
    textAlign: "center",
    lineHeight: 18,
    letterSpacing: 0.2,
  },
});
