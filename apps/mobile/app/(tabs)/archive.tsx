// @MX:ANCHOR: ArchiveScreen - comprehensible input review hub (질문 기록 + 저장 문장)
// @MX:REASON: [AUTO] fan_in >= 3: tab navigator, deep links, and study flow navigation
// @MX:SPEC: SPEC-INPUT-001 - REQ-INPUT-004-E2, SPEC-MOBILE-005 - REQ-E-004, REQ-E-005, REQ-N-001, REQ-C-002
import React, { useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import {
  createCardComment,
  deleteCardComment,
  deleteCardCommentsByTarget,
  fetchCardComments,
  fetchPlaybookEntries,
  updateCardComment,
  updatePlaybookEntryMastery,
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
import QuestionHistoryTab from "@/components/premium/QuestionHistoryTab";
import {
  SegmentedControl,
  createThemedStyles,
  useTheme,
} from "@/components/ui";

// Top-level segment: "질문 기록" | "저장 문장"
type MainSegment = "questions" | "saved";

// Sub-tab within "저장 문장"
type SavedSubTab = "sentences" | "highlights" | "playbook";

interface PendingDelete {
  id: string;
  type: SavedSubTab;
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

  const styles = getStyles(useTheme());
  const flatListRef = useRef<FlatList>(null);

  const [mainSegment, setMainSegment] = useState<MainSegment>("questions");
  const [savedSubTab, setSavedSubTab] = useState<SavedSubTab>("sentences");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [playbookEntries, setPlaybookEntries] = useState<PlaybookEntry[]>([]);
  const [playbookLoading, setPlaybookLoading] = useState(false);
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
        fetchCardComments(user.id),
      ])
        .then(([, entries, cardComments]) => {
          setPlaybookEntries(entries);
          setComments(cardComments);
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
    (id: string, type: SavedSubTab) => {
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
      } catch (err) {
        console.error("[Archive] createCardComment error:", err);
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
      } catch (err) {
        console.error("[Archive] updateCardComment error:", err);
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
    (sentence: SavedSentence): string => {
      return (
        sentence.sessionTitle ??
        getVideo(sentence.videoId)?.title ??
        "프리미엄 세션"
      );
    },
    [getVideo],
  );

  const resolveFallbackVideoTitle = useCallback(
    (videoId: string): string => {
      return getVideo(videoId)?.title ?? "프리미엄 세션";
    },
    [getVideo],
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

  const scrollToIndex = useCallback((index: number) => {
    setTimeout(() => {
      flatListRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.3,
      });
    }, 300);
  }, []);

  const renderSentenceItem = useCallback(
    ({ item, index }: { item: SavedSentence; index: number }) => {
      const videoTitle = resolveVideoTitle(item);
      return (
        <View style={styles.cardShadow}>
          <SwipeableRow onDelete={() => handleDelete(item.id, "sentences")}>
            <View style={styles.card}>
              <View style={styles.videoTitleRow}>
                <Text style={styles.videoTitleText} numberOfLines={1}>
                  {videoTitle}
                </Text>
              </View>
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
                onInputActivate={() => scrollToIndex(index)}
              />
            </View>
          </SwipeableRow>
        </View>
      );
    },
    [
      styles,
      resolveVideoTitle,
      handleDelete,
      commentsByTarget,
      handleAddComment,
      handleEditComment,
      handleDeleteComment,
      commentSaving,
      scrollToIndex,
    ],
  );

  const renderHighlightItem = useCallback(
    ({ item, index }: { item: AppHighlight; index: number }) => {
      const videoTitle = resolveFallbackVideoTitle(item.videoId);
      return (
        <View style={styles.cardShadow}>
          <SwipeableRow onDelete={() => handleDelete(item.id, "highlights")}>
            <View style={styles.card}>
              <View style={styles.videoTitleRow}>
                <Text style={styles.videoTitleText} numberOfLines={1}>
                  {videoTitle}
                </Text>
              </View>
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
                onInputActivate={() => scrollToIndex(index)}
              />
            </View>
          </SwipeableRow>
        </View>
      );
    },
    [
      styles,
      resolveFallbackVideoTitle,
      handleDelete,
      commentsByTarget,
      handleAddComment,
      handleEditComment,
      handleDeleteComment,
      commentSaving,
      scrollToIndex,
    ],
  );

  const renderPlaybookItem = useCallback(
    ({ item }: { item: PlaybookEntry }) => {
      const sessionTitle =
        typeof item.attempt_metadata?.sessionTitle === "string"
          ? item.attempt_metadata.sessionTitle
          : undefined;

      return (
        <SwipeableRow onDelete={() => handleDelete(item.id, "playbook")}>
          <PlaybookCard
            entry={item}
            sessionTitle={sessionTitle}
            onSetMastery={handleSetMastery}
          />
        </SwipeableRow>
      );
    },
    [handleSetMastery, handleDelete],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" />
        <ActivityIndicator size="small" color={styles.activityColor.color} />
      </SafeAreaView>
    );
  }

  if (!isAuthenticated) {
    return (
      <SafeAreaView style={styles.stateContainer}>
        <StatusBar barStyle="dark-content" />
        <Text style={styles.stateLabel}>보관함</Text>
        <Text style={styles.stateSubtext}>
          로그인 후 저장한 문장을 볼 수 있어요.
        </Text>
      </SafeAreaView>
    );
  }

  // Saved view sub-tab configuration
  const isSentencesTab = savedSubTab === "sentences";
  const isHighlightsTab = savedSubTab === "highlights";
  const isPlaybookTab = savedSubTab === "playbook";

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
      <StatusBar barStyle="dark-content" />

      {/* Screen header */}
      <View style={styles.header}>
        <Text style={styles.headerWordmark}>보관함</Text>
      </View>

      {/* Top-level SegmentedControl: 질문 기록 | 저장 문장 */}
      <View style={styles.segmentWrapper}>
        <SegmentedControl
          options={[
            { value: "questions", label: "질문 기록" },
            { value: "saved", label: "저장 문장" },
          ]}
          value={mainSegment}
          onValueChange={(v) => setMainSegment(v as MainSegment)}
        />
      </View>

      {/* Question History Tab — self-fetches via supabase + useAuth */}
      {mainSegment === "questions" ? (
        <QuestionHistoryTab />
      ) : (
        <>
          {/* Sub-tab bar for saved sentences / highlights / playbook */}
          <View style={styles.subTabBar}>
            {(
              [
                {
                  key: "sentences",
                  label: "문장",
                  count: savedSentences.length,
                },
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
              ] as { key: SavedSubTab; label: string; count: number }[]
            ).map(({ key, label, count }) => {
              const active = savedSubTab === key;
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.subTab, active && styles.subTabActive]}
                  onPress={() => setSavedSubTab(key)}
                >
                  <Text
                    style={[
                      styles.subTabText,
                      active && styles.subTabTextActive,
                    ]}
                  >
                    {label}
                  </Text>
                  <View
                    style={[
                      styles.subTabCountBadge,
                      active && styles.subTabCountBadgeActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.subTabCount,
                        active && styles.subTabCountActive,
                      ]}
                    >
                      {count}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>

          <KeyboardAvoidingView
            style={styles.flex}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
          >
            {playbookLoading && isPlaybookTab ? (
              <View style={styles.emptyContainer}>
                <ActivityIndicator
                  size="small"
                  color={styles.activityColor.color}
                />
              </View>
            ) : currentData.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyTitle}>{emptyText}</Text>
                <Text style={styles.emptySubtitle}>{emptySubtext}</Text>
              </View>
            ) : (
              <FlatList
                ref={flatListRef}
                data={
                  currentData as (
                    | SavedSentence
                    | AppHighlight
                    | PlaybookEntry
                  )[]
                }
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
                keyboardShouldPersistTaps="handled"
                keyboardDismissMode="on-drag"
                onScrollToIndexFailed={(info) => {
                  setTimeout(() => {
                    flatListRef.current?.scrollToIndex({
                      index: info.index,
                      animated: true,
                      viewPosition: 0.3,
                    });
                  }, 100);
                }}
              />
            )}
          </KeyboardAvoidingView>
        </>
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

const getStyles = createThemedStyles((theme) => ({
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
  },
  stateContainer: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[3],
  },
  stateLabel: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
  stateSubtext: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    letterSpacing: 0.3,
  },
  // Indicator color helper — used via .color property in StatusBar / ActivityIndicator
  activityColor: {
    color: theme.colors.text.tertiary,
  },

  // ── Header ──────────────────────────────────────────
  header: {
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[6],
    paddingBottom: theme.spacing[3],
  },
  headerWordmark: {
    ...theme.typography.title,
    color: theme.colors.text.primary,
    letterSpacing: 0.5,
  },

  // ── SegmentedControl wrapper ─────────────────────────
  segmentWrapper: {
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[3],
  },

  // ── Sub-tab bar (sentences / highlights / playbook) ──
  subTabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
    backgroundColor: theme.colors.background.canvas,
  },
  subTab: {
    flex: 1,
    paddingVertical: theme.spacing[3],
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: theme.spacing[1] + 2,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  subTabActive: {
    borderBottomColor: theme.colors.text.primary,
  },
  subTabText: {
    ...theme.typography.label,
    color: theme.colors.text.tertiary,
  },
  subTabTextActive: {
    color: theme.colors.text.primary,
  },
  subTabCountBadge: {
    backgroundColor: theme.colors.background.muted,
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing[1],
    paddingVertical: 1,
    minWidth: 20,
    alignItems: "center",
  },
  subTabCountBadgeActive: {
    backgroundColor: theme.colors.text.primary,
  },
  subTabCount: {
    fontSize: 11,
    fontWeight: "500",
    color: theme.colors.text.tertiary,
    letterSpacing: 0.2,
  },
  subTabCountActive: {
    color: theme.colors.text.inverse,
  },

  // ── List ────────────────────────────────────────────
  listContent: {
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: 120,
  },
  cardGap: {
    height: theme.spacing[2],
  },

  // ── Card ────────────────────────────────────────────
  cardShadow: {
    borderRadius: theme.radius.lg,
    overflow: "hidden",
  },
  card: {
    backgroundColor: theme.colors.surface.base,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    padding: theme.spacing[4],
    gap: theme.spacing[2],
  },

  // Video title row — tappable
  videoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[1],
  },
  videoTitleText: {
    ...theme.typography.caption,
    fontWeight: "600",
    color: theme.colors.text.secondary,
    flex: 1,
    letterSpacing: 0.2,
  },
  videoTitleChevron: {
    ...theme.typography.body,
    color: theme.colors.text.tertiary,
  },

  // Sentence / highlight content
  sentenceText: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
  },
  userNote: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
    backgroundColor: theme.colors.background.subtle,
    padding: theme.spacing[3],
    borderLeftWidth: 2,
    borderLeftColor: theme.colors.border.default,
    borderRadius: theme.radius.sm,
  },
  timestamp: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    letterSpacing: 0.2,
  },

  // ── Empty state ─────────────────────────────────────
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing[8],
    gap: theme.spacing[3],
  },
  emptyTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
    letterSpacing: 0.3,
  },
  emptySubtitle: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    textAlign: "center",
    letterSpacing: 0.2,
  },
}));
