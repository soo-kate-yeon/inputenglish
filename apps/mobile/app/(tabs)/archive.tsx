// @MX:ANCHOR: ArchiveScreen - saved sentences + highlights with undo delete
// @MX:REASON: [AUTO] fan_in >= 3: tab navigator, deep links, and study flow navigation
// @MX:SPEC: SPEC-MOBILE-005 - REQ-E-004, REQ-E-005, REQ-N-001, REQ-C-002
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
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
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.center}>
        <Text style={styles.title}>Archive</Text>
        <Text style={styles.subtitle}>
          로그인 후 저장한 문장을 볼 수 있어요.
        </Text>
      </SafeAreaView>
    );
  }

  const isSentencesTab = activeTab === "sentences";
  const emptyText = isSentencesTab
    ? "아직 저장한 문장이 없어요."
    : "아직 하이라이트가 없어요.";
  const emptySubtext = isSentencesTab
    ? "리스닝 화면에서 북마크한 문장이 여기에 표시됩니다."
    : "학습 화면에서 문장을 꾹 눌러 하이라이트를 추가하세요.";

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Archive</Text>
      </View>

      {/* Segmented Control - REQ-E-005 */}
      <View style={styles.segmentedControl}>
        <TouchableOpacity
          style={[styles.segment, isSentencesTab && styles.segmentActive]}
          onPress={() => setActiveTab("sentences")}
        >
          <Text
            style={[
              styles.segmentText,
              isSentencesTab && styles.segmentTextActive,
            ]}
          >
            저장 문장 {savedSentences.length}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segment, !isSentencesTab && styles.segmentActive]}
          onPress={() => setActiveTab("highlights")}
        >
          <Text
            style={[
              styles.segmentText,
              !isSentencesTab && styles.segmentTextActive,
            ]}
          >
            하이라이트 {highlights.length}
          </Text>
        </TouchableOpacity>
      </View>

      {isSentencesTab ? (
        visibleSentences.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyTitle}>{emptyText}</Text>
            <Text style={styles.emptySubtitle}>{emptySubtext}</Text>
          </View>
        ) : (
          <FlatList
            data={visibleSentences}
            keyExtractor={(item) => item.id}
            renderItem={renderSentenceItem}
            contentContainerStyle={styles.listContent}
          />
        )
      ) : visibleHighlights.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>{emptyText}</Text>
          <Text style={styles.emptySubtitle}>{emptySubtext}</Text>
        </View>
      ) : (
        <FlatList
          data={visibleHighlights}
          keyExtractor={(item) => item.id}
          renderItem={renderHighlightItem}
          contentContainerStyle={styles.listContent}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
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
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 14,
    color: "#666",
  },
  segmentedControl: {
    flexDirection: "row",
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
    paddingHorizontal: 16,
    paddingBottom: 0,
  },
  segment: {
    flex: 1,
    paddingVertical: 12,
    alignItems: "center",
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  segmentActive: {
    borderBottomColor: "#007AFF",
  },
  segmentText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#999",
  },
  segmentTextActive: {
    color: "#007AFF",
  },
  listContent: {
    padding: 12,
    gap: 12,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  videoTitle: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
  },
  sentenceText: {
    fontSize: 16,
    lineHeight: 23,
    color: "#222",
  },
  userNote: {
    fontSize: 13,
    color: "#555",
    backgroundColor: "#FFF9C4",
    padding: 8,
    borderRadius: 6,
    lineHeight: 19,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: "#999",
  },
  deleteButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: "#FFE5E2",
  },
  deleteButtonText: {
    color: "#D93025",
    fontSize: 12,
    fontWeight: "600",
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#222",
  },
  emptySubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#777",
    textAlign: "center",
    lineHeight: 20,
  },
});
