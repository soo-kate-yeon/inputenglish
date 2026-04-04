// @MX:ANCHOR: ArchiveScreen - saved sentences + highlights + playbook with swipe-to-delete
// @MX:REASON: [AUTO] fan_in >= 3: tab navigator, deep links, and study flow navigation
// @MX:SPEC: SPEC-MOBILE-005 - REQ-E-004, REQ-E-005, REQ-N-001, REQ-C-002
import React, { useCallback, useMemo, useState } from "react";
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
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCardComment,
  deleteCardComment,
  deleteCardCommentsByTarget,
  fetchCardComments,
  fetchLearningSessions,
  fetchPlaybookEntries,
  updateCardComment,
  updatePlaybookEntryMastery,
  SessionListItem,
} from "@/lib/api";
import { appStore } from "@/lib/stores";
import type {
  AppHighlight,
  CardComment,
  CardCommentTargetType,
  PlaybookEntry,
  PlaybookMasteryStatus,
  SavedSentence,
} from "@inputenglish/shared";
import UndoToast from "@/components/common/UndoToast";
import ErrorToast from "@/components/common/ErrorToast";
import CommentThread from "@/components/common/CommentThread";
import SwipeableRow from "@/components/common/SwipeableRow";
import PlaybookCard from "@/components/study/PlaybookCard";
import { colors, font, palette, radius, spacing } from "@/theme";

type Tab = "sentences" | "highlights" | "playbook";

interface PendingDelete {
  id: string;
  type: Tab;
  timer: ReturnType<typeof setTimeout>;
}

interface VideoInfo {
  title: string;
  sessionId: string;
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
  // source_video_id → { title, sessionId } — avoids raw UUID display
  const [videoInfoMap, setVideoInfoMap] = useState<Record<string, VideoInfo>>(
    {},
  );
  const [comments, setComments] = useState<CardComment[]>([]);
  const [commentSaving, setCommentSaving] = useState(false);
  const [errorToast, setErrorToast] = useState<{
    message: string;
    retry?: () => void;
  } | null>(null);

  const commentsByTarget = useMemo(() => {
    const map: Record<string, CardComment[]> = {};
    for (const c of comments) {
      (map[c.targetId] ??= []).push(c);
    }
    return map;
  }, [comments]);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated || !user?.id) return;

      setPlaybookLoading(true);
      Promise.all([
        loadUserData(),
        fetchPlaybookEntries(user.id),
        fetchLearningSessions(),
        fetchCardComments(user.id),
      ])
        .then(([, entries, sessions, cardComments]) => {
          setPlaybookEntries(entries);
          setComments(cardComments);
          const sMap: Record<string, string> = {};
          const vMap: Record<string, VideoInfo> = {};
          for (const s of sessions as SessionListItem[]) {
            sMap[s.id] = s.title;
            vMap[s.source_video_id] = { title: s.title, sessionId: s.id };
          }
          setSessionMap(sMap);
          setVideoInfoMap(vMap);
        })
        .catch((error) => {
          console.error("[MobileArchive] Failed to load archive data:", error);
        })
        .finally(() => setPlaybookLoading(false));
    }, [isAuthenticated, loadUserData, user?.id]),
  );

  // Cascade-delete comments when a card is permanently removed
  const cleanupCommentsForCard = useCallback(
    (cardId: string) => {
      setComments((prev) => prev.filter((c) => c.targetId !== cardId));
      if (user?.id) {
        deleteCardCommentsByTarget(user.id, cardId).catch(() => {
          // Silent fail on orphan cleanup — non-critical
        });
      }
    },
    [user?.id],
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
          cleanupCommentsForCard(prevId);
        } else if (prevType === "highlights") {
          removeHighlight(prevId).catch(() => {
            setErrorToast({ message: "삭제에 실패했습니다." });
          });
          cleanupCommentsForCard(prevId);
        } else {
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
          cleanupCommentsForCard(id);
        } else if (type === "highlights") {
          removeHighlight(id).catch(() => {
            setErrorToast({
              message: "삭제에 실패했습니다.",
              retry: () => handleDelete(id, type),
            });
          });
          cleanupCommentsForCard(id);
        } else {
          setPlaybookEntries((prev) => prev.filter((e) => e.id !== id));
        }
        setPendingDelete(null);
      }, 3000);

      setPendingDelete({ id, type, timer });
    },
    [
      pendingDelete,
      removeSavedSentence,
      removeHighlight,
      cleanupCommentsForCard,
    ],
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

  const handleAddComment = useCallback(
    async (
      targetType: CardCommentTargetType,
      targetId: string,
      body: string,
    ) => {
      if (!user?.id) return;
      const tempId = `temp-${Date.now()}`;
      const optimistic: CardComment = {
        id: tempId,
        targetType,
        targetId,
        body,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      setComments((prev) => [...prev, optimistic]);

      try {
        setCommentSaving(true);
        const persisted = await createCardComment(user.id, {
          targetType,
          targetId,
          body,
        });
        setComments((prev) =>
          prev.map((c) => (c.id === tempId ? persisted : c)),
        );
      } catch {
        setComments((prev) => prev.filter((c) => c.id !== tempId));
        setErrorToast({ message: "메모 저장에 실패했습니다." });
      } finally {
        setCommentSaving(false);
      }
    },
    [user?.id],
  );

  const handleEditComment = useCallback(
    async (commentId: string, body: string) => {
      if (!user?.id) return;
      const original = comments.find((c) => c.id === commentId);
      setComments((prev) =>
        prev.map((c) =>
          c.id === commentId
            ? { ...c, body, updatedAt: new Date().toISOString() }
            : c,
        ),
      );
      try {
        setCommentSaving(true);
        const persisted = await updateCardComment(user.id, commentId, body);
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? persisted : c)),
        );
      } catch {
        if (original)
          setComments((prev) =>
            prev.map((c) => (c.id === commentId ? original : c)),
          );
        setErrorToast({ message: "메모 수정에 실패했습니다." });
      } finally {
        setCommentSaving(false);
      }
    },
    [user?.id, comments],
  );

  const handleDeleteComment = useCallback(
    async (commentId: string) => {
      if (!user?.id) return;
      const original = comments.find((c) => c.id === commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
      try {
        await deleteCardComment(user.id, commentId);
      } catch {
        if (original) setComments((prev) => [...prev, original]);
        setErrorToast({ message: "메모 삭제에 실패했습니다." });
      }
    },
    [user?.id, comments],
  );

  const resolveVideoTitle = useCallback(
    (videoId: string): string => {
      if (videoInfoMap[videoId]) return videoInfoMap[videoId].title;
      return getVideo(videoId)?.title ?? "영상 보기";
    },
    [videoInfoMap, getVideo],
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
      const videoTitle = resolveVideoTitle(item.videoId);
      return (
        <View style={styles.cardShadow}>
          <SwipeableRow onDelete={() => handleDelete(item.id, "sentences")}>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.videoTitleRow}
                onPress={() => {
                  const info = videoInfoMap[item.videoId];
                  router.push(
                    `/study/${item.videoId}?sessionId=${info?.sessionId ?? ""}`,
                  );
                }}
                accessibilityRole="link"
                accessibilityLabel={`${videoTitle} 열기`}
              >
                <Text style={styles.videoTitleText} numberOfLines={1}>
                  {videoTitle}
                </Text>
                <Text style={styles.videoTitleChevron}>›</Text>
              </TouchableOpacity>
              <Text style={styles.sentenceText}>{item.sentenceText}</Text>
              <Text style={styles.timestamp}>
                {new Date(item.createdAt).toLocaleString("ko-KR")}
              </Text>
              <CommentThread
                comments={commentsByTarget[item.id] ?? []}
                onAdd={(body) =>
                  handleAddComment("saved_sentence", item.id, body)
                }
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
                saving={commentSaving}
              />
            </View>
          </SwipeableRow>
        </View>
      );
    },
    [
      resolveVideoTitle,
      handleDelete,
      commentsByTarget,
      handleAddComment,
      handleEditComment,
      handleDeleteComment,
      commentSaving,
    ],
  );

  const renderHighlightItem = useCallback(
    ({ item }: { item: AppHighlight }) => {
      const videoTitle = resolveVideoTitle(item.videoId);
      return (
        <View style={styles.cardShadow}>
          <SwipeableRow onDelete={() => handleDelete(item.id, "highlights")}>
            <View style={styles.card}>
              <TouchableOpacity
                style={styles.videoTitleRow}
                onPress={() => {
                  const info = videoInfoMap[item.videoId];
                  router.push(
                    `/study/${item.videoId}?sessionId=${info?.sessionId ?? ""}`,
                  );
                }}
                accessibilityRole="link"
                accessibilityLabel={`${videoTitle} 열기`}
              >
                <Text style={styles.videoTitleText} numberOfLines={1}>
                  {videoTitle}
                </Text>
                <Text style={styles.videoTitleChevron}>›</Text>
              </TouchableOpacity>
              <Text style={styles.sentenceText}>{item.originalText}</Text>
              {item.userNote ? (
                <Text style={styles.userNote}>{item.userNote}</Text>
              ) : null}
              <Text style={styles.timestamp}>
                {new Date(item.createdAt).toLocaleString("ko-KR")}
              </Text>
              <CommentThread
                comments={commentsByTarget[item.id] ?? []}
                onAdd={(body) => handleAddComment("highlight", item.id, body)}
                onEdit={handleEditComment}
                onDelete={handleDeleteComment}
                saving={commentSaving}
              />
            </View>
          </SwipeableRow>
        </View>
      );
    },
    [
      resolveVideoTitle,
      handleDelete,
      commentsByTarget,
      handleAddComment,
      handleEditComment,
      handleDeleteComment,
      commentSaving,
    ],
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
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
        <ActivityIndicator size="small" color={colors.textSecondary} />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
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
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerWordmark}>보관함</Text>
      </View>

      {/* Tab bar */}
      <View style={styles.tabBar}>
        {(
          [
            { key: "sentences", label: "문장", count: savedSentences.length },
            {
              key: "highlights",
              label: "하이라이트",
              count: highlights.length,
            },
            {
              key: "playbook",
              label: "플레이북",
              count: playbookEntries.length,
            },
          ] as { key: Tab; label: string; count: number }[]
        ).map(({ key, label, count }) => {
          const active = activeTab === key;
          return (
            <TouchableOpacity
              key={key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setActiveTab(key)}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {label}
              </Text>
              <View
                style={[
                  styles.tabCountBadge,
                  active && styles.tabCountBadgeActive,
                ]}
              >
                <Text
                  style={[styles.tabCount, active && styles.tabCountActive]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </View>

      {playbookLoading && isPlaybookTab ? (
        <View style={styles.emptyContainer}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
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
          ItemSeparatorComponent={() => <View style={styles.cardGap} />}
          showsVerticalScrollIndicator={false}
        />
      )}

      <UndoToast
        visible={pendingDelete !== null}
        message="삭제되었습니다."
        onUndo={handleUndo}
      />
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
    backgroundColor: colors.bg,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm + spacing.xs, // 12
  },
  stateLabel: {
    fontSize: font.size.base,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  stateSubtext: {
    fontSize: font.size.md - 1, // 14
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },

  // ── Header ──────────────────────────────────────────
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

  // ── Tab bar ─────────────────────────────────────────
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.bg,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.sm + spacing.xs, // 12
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: spacing.xs + 2, // 6
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomColor: colors.text,
  },
  tabText: {
    fontSize: font.size.md - 1, // 14
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
  },
  tabTextActive: {
    color: colors.text,
  },
  tabCountBadge: {
    backgroundColor: colors.bgMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.xs,
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  tabCountBadgeActive: {
    backgroundColor: palette.neutral800,
  },
  tabCount: {
    fontSize: 11,
    fontWeight: font.weight.medium,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },
  tabCountActive: {
    color: palette.white,
  },

  // ── List ────────────────────────────────────────────
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: 120,
  },
  cardGap: {
    height: spacing.sm, // 8 — gap between cards
  },

  // ── Card (podcast-ambient list recipe) ──────────────
  cardShadow: {
    borderRadius: radius.xl,
    overflow: "hidden",
  },
  card: {
    backgroundColor: palette.white,
    borderRadius: radius.xl, // 16
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.sm,
  },

  // Video title row — tappable
  videoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  videoTitleText: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.textSecondary,
    flex: 1,
    letterSpacing: 0.2,
  },
  videoTitleChevron: {
    fontSize: font.size.md,
    color: colors.textMuted,
    lineHeight: font.size.md * 1.2,
  },

  // Sentence / highlight content
  sentenceText: {
    fontSize: font.size.base,
    lineHeight: font.size.base * 1.55, // ~26
    color: colors.text,
    fontWeight: font.weight.regular,
  },
  userNote: {
    fontSize: font.size.md,
    color: colors.text,
    backgroundColor: colors.bgSubtle,
    padding: spacing.sm + spacing.xs, // 12
    lineHeight: font.size.md * 1.4, // 21
    borderLeftWidth: 2,
    borderLeftColor: colors.borderStrong,
    borderRadius: radius.sm,
  },
  timestamp: {
    fontSize: font.size.xs,
    color: colors.textMuted,
    letterSpacing: 0.2,
  },

  // ── Empty state ─────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm + spacing.xs, // 12
  },
  emptyTitle: {
    fontSize: font.size.md,
    letterSpacing: 0.3,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  emptySubtitle: {
    fontSize: font.size.md - 1, // 14
    color: colors.textSecondary,
    textAlign: "center",
    lineHeight: font.size.md * 1.4, // ~21
    letterSpacing: 0.2,
  },
});
