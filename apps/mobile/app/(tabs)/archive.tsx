// @MX:ANCHOR: ArchiveScreen - saved sentences + highlights with undo delete
// @MX:REASON: [AUTO] fan_in >= 3: tab navigator, deep links, and study flow navigation
// @MX:SPEC: SPEC-MOBILE-005 - REQ-E-004, REQ-E-005, REQ-N-001, REQ-C-002
import React, { useCallback, useRef, useState } from "react";
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
import { appStore } from "@/lib/stores";
import type { AppHighlight, SavedSentence } from "@shadowoo/shared";
import UndoToast from "@/components/common/UndoToast";
import ErrorToast from "@/components/common/ErrorToast";

type Tab = "sentences" | "highlights";

interface PendingDelete {
  id: string;
  type: Tab;
  timer: ReturnType<typeof setTimeout>;
}

export default function ArchiveScreen() {
  const { isAuthenticated, isLoading } = useAuth();
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
  const [errorToast, setErrorToast] = useState<{
    message: string;
    retry?: () => void;
  } | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadUserData().catch((error) => {
          console.error("[MobileArchive] Failed to load user data:", error);
        });
      }
    }, [isAuthenticated, loadUserData]),
  );

  // REQ-E-004, REQ-C-002: undo delete with 3-second timer
  const handleDelete = useCallback(
    (id: string, type: Tab) => {
      // Cancel any existing pending delete
      if (pendingDelete) {
        clearTimeout(pendingDelete.timer);
        // Actually execute the previously pending delete immediately
        const prevType = pendingDelete.type;
        const prevId = pendingDelete.id;
        if (prevType === "sentences") {
          removeSavedSentence(prevId).catch(() => {
            setErrorToast({ message: "삭제에 실패했습니다." });
          });
        } else {
          removeHighlight(prevId).catch(() => {
            setErrorToast({ message: "삭제에 실패했습니다." });
          });
        }
      }

      const timer = setTimeout(() => {
        const doDelete =
          type === "sentences" ? removeSavedSentence(id) : removeHighlight(id);
        doDelete
          .catch(() => {
            setErrorToast({
              message: "삭제에 실패했습니다.",
              retry: () => handleDelete(id, type),
            });
          })
          .finally(() => setPendingDelete(null));
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

  const visibleSentences = savedSentences.filter(
    (s) => s.id !== pendingDelete?.id || pendingDelete.type !== "sentences",
  );
  const visibleHighlights = highlights.filter(
    (h) => h.id !== pendingDelete?.id || pendingDelete.type !== "highlights",
  );

  const renderSentenceItem = useCallback(
    ({ item }: { item: SavedSentence }) => {
      const videoTitle = getVideo(item.videoId)?.title ?? item.videoId;
      return (
        <View style={styles.card}>
          <Text style={styles.videoTitle} numberOfLines={1}>
            {videoTitle}
          </Text>
          <Text style={styles.sentenceText}>{item.sentenceText}</Text>
          <View style={styles.cardFooter}>
            <Text style={styles.timestamp}>
              {new Date(item.createdAt).toLocaleString("ko-KR")}
            </Text>
            <TouchableOpacity
              onPress={() => handleDelete(item.id, "sentences")}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteButtonText}>삭제</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [getVideo, handleDelete],
  );

  const renderHighlightItem = useCallback(
    ({ item }: { item: AppHighlight }) => {
      const videoTitle = getVideo(item.videoId)?.title ?? item.videoId;
      return (
        <View style={styles.card}>
          <Text style={styles.videoTitle} numberOfLines={1}>
            {videoTitle}
          </Text>
          <Text style={styles.sentenceText}>{item.originalText}</Text>
          {item.userNote ? (
            <Text style={styles.userNote}>📝 {item.userNote}</Text>
          ) : null}
          <View style={styles.cardFooter}>
            <Text style={styles.timestamp}>
              {new Date(item.createdAt).toLocaleString("ko-KR")}
            </Text>
            <TouchableOpacity
              onPress={() => handleDelete(item.id, "highlights")}
              style={styles.deleteButton}
            >
              <Text style={styles.deleteButtonText}>삭제</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    },
    [getVideo, handleDelete],
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
        <Text style={styles.stateLabel}>ARCHIVE</Text>
        <Text style={styles.stateSubtext}>
          로그인 후 저장한 문장을 볼 수 있어요.
        </Text>
      </SafeAreaView>
    );
  }

  const isSentencesTab = activeTab === "sentences";
  const emptyText = isSentencesTab
    ? "저장한 문장이 없습니다."
    : "하이라이트가 없습니다.";
  const emptySubtext = isSentencesTab
    ? "리스닝 화면에서 북마크한 문장이 여기에 표시됩니다."
    : "학습 화면에서 문장을 꾹 눌러 하이라이트를 추가하세요.";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerWordmark}>ARCHIVE</Text>
      </View>

      {/* Tab bar - REQ-E-005 */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tab, isSentencesTab && styles.tabActive]}
          onPress={() => setActiveTab("sentences")}
        >
          <Text
            style={[styles.tabText, isSentencesTab && styles.tabTextActive]}
          >
            SENTENCES
          </Text>
          <Text
            style={[styles.tabCount, isSentencesTab && styles.tabCountActive]}
          >
            {savedSentences.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, !isSentencesTab && styles.tabActive]}
          onPress={() => setActiveTab("highlights")}
        >
          <Text
            style={[styles.tabText, !isSentencesTab && styles.tabTextActive]}
          >
            HIGHLIGHTS
          </Text>
          <Text
            style={[styles.tabCount, !isSentencesTab && styles.tabCountActive]}
          >
            {highlights.length}
          </Text>
        </TouchableOpacity>
      </View>

      {isSentencesTab ? (
        visibleSentences.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyTitle}>{emptyText}</Text>
            <Text style={styles.emptySubtitle}>{emptySubtext}</Text>
          </View>
        ) : (
          <FlatList
            data={visibleSentences}
            keyExtractor={(item) => item.id}
            renderItem={renderSentenceItem}
            contentContainerStyle={styles.listContent}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            showsVerticalScrollIndicator={false}
          />
        )
      ) : visibleHighlights.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyTitle}>{emptyText}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtext}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleHighlights}
          keyExtractor={(item) => item.id}
          renderItem={renderHighlightItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Undo Toast - REQ-E-004, REQ-N-001 */}
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

// --- Design tokens (square minimalism — matches home screen) ---
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
    fontSize: 13,
    letterSpacing: 3,
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
    letterSpacing: 4,
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
    fontSize: 10,
    letterSpacing: 2,
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

  // Card
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
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
  },
  timestamp: {
    fontSize: 11,
    color: COLOR.textMuted,
    letterSpacing: 0.3,
  },
  deleteButton: {
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  deleteButtonText: {
    fontSize: 10,
    letterSpacing: 1.5,
    color: COLOR.text,
    fontWeight: "600",
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
