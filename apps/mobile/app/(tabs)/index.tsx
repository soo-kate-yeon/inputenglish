import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ImageBackground,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import type { PremiumSession } from "@inputenglish/shared";
import {
  fetchTodayPremiumSession,
  fetchTodayCiSession,
  type TodayCiSessionShape,
} from "@/lib/premium-api";
import {
  getPremiumSessionProgress,
  type PremiumSessionProgress,
} from "@/lib/premium-session-progress";
import { colors, font, leading, radius, spacing } from "@/theme";

const STEP_STATUS_LABELS: Record<string, string> = {
  article: "오늘 배워갈 것",
  "content-catch": "영상 시청하기",
  "delivery-analysis": "분석하며 듣기",
  "expression-cards": "오늘 핵심표현",
  roleplay: "말하기 연습",
  completion: "학습 마치기",
};

function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return `${minutes}분 소요`;
}

function getProgressDetail(
  progress: PremiumSessionProgress | null,
): string | null {
  if (!progress) return null;
  if (progress.status === "completed") {
    return `${progress.savedExpressionCount}개 표현이 복습 자산에 저장됐어요.`;
  }
  return `마지막 위치: ${
    STEP_STATUS_LABELS[progress.lastStep] ?? "오늘의 세션"
  }`;
}

export default function PremiumHomeScreen() {
  const [session, setSession] = useState<PremiumSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<PremiumSessionProgress | null>(null);
  const [ciSession, setCiSession] = useState<TodayCiSessionShape | null>(null);

  const loadToday = useCallback(async () => {
    setError(null);
    try {
      const [premiumPayload, ciPayload] = await Promise.allSettled([
        fetchTodayPremiumSession(),
        fetchTodayCiSession(),
      ]);

      const payload =
        premiumPayload.status === "fulfilled" ? premiumPayload.value : null;
      if (payload?.entitlement && !payload.entitlement.hasAccess) {
        setSession(null);
        setProgress(null);
        router.push("/paywall");
      } else if (payload?.session) {
        setSession(payload.session);
        setProgress(getPremiumSessionProgress(payload.session.id));
      } else if (!payload?.session && !payload?.entitlement) {
        router.push("/paywall");
      }

      if (ciPayload.status === "fulfilled") {
        setCiSession(ciPayload.value.session);
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "오늘의 큐레이션을 불러오지 못했어요.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  useFocusEffect(
    useCallback(() => {
      if (session) {
        setProgress(getPremiumSessionProgress(session.id));
      }
    }, [session]),
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadToday();
  }, [loadToday]);

  const handleOpenSession = useCallback(() => {
    if (!session) return;
    router.push(`/premium/${session.id}` as never);
  }, [session]);

  const handleOpenReview = useCallback(() => {
    router.push("/(tabs)/archive" as never);
  }, []);

  const progressDetail = getProgressDetail(progress);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={colors.textPremium}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.greeting}>Good morning,</Text>
        <Text style={styles.greetingName}>오늘의 인풋</Text>
      </View>
      <Text style={styles.sectionTitle}>오늘 도착한 큐레이션</Text>

      {ciSession && (
        <Pressable
          testID="ci-session-card"
          style={({ pressed }) => [
            styles.ciSessionCard,
            pressed && styles.sessionCardPressed,
          ]}
          onPress={() => router.push("/premium" as never)}
        >
          <Text style={styles.ciSessionLabel}>오늘의 세션</Text>
          {ciSession.readingPiece ? (
            <Text style={styles.ciSessionTitle} numberOfLines={2}>
              {ciSession.readingPiece.topic}
            </Text>
          ) : null}
          <Text style={styles.ciSessionMeta}>
            영상 {ciSession.segments.length}편 포함
          </Text>
        </Pressable>
      )}

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={colors.textPremium} />
        </View>
      ) : error ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>잠깐 멈췄어요</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.secondaryButton} onPress={handleRefresh}>
            <Text style={styles.secondaryButtonText}>다시 불러오기</Text>
          </Pressable>
        </View>
      ) : session ? (
        <Pressable
          testID="premium-session-card"
          style={({ pressed }) => [
            styles.sessionCard,
            pressed && styles.sessionCardPressed,
          ]}
          onPress={handleOpenSession}
        >
          <View style={styles.cardMedia}>
            <ImageBackground
              source={{
                uri:
                  session.thumbnail_url ??
                  `https://img.youtube.com/vi/${session.source_video_id}/hqdefault.jpg`,
              }}
              style={styles.sessionImage}
              imageStyle={styles.sessionImageStyle}
            >
              <View style={styles.imageOverlay} />
              <View style={styles.cardTopRow}>
                <Text style={styles.durationPill}>
                  {formatDuration(session.duration_seconds)}
                </Text>
                <Text style={styles.sourcePill}>
                  {session.channel_name ?? "Premium"}
                </Text>
              </View>
              <View style={styles.mediaFade} />
            </ImageBackground>
          </View>
          <View style={styles.cardTextBlock}>
            <Text style={styles.sessionTitle}>{session.title}</Text>
            {session.description ? (
              <Text style={styles.sessionDescription}>
                {session.description}
              </Text>
            ) : null}
            <View style={styles.expressionBlock}>
              <Text style={styles.expressionBlockTitle}>오늘 배워갈 표현</Text>
              <View style={styles.expressionRow}>
                {session.expression_cards.slice(0, 3).map((card) => (
                  <View key={card.id} style={styles.expressionChip}>
                    <Text style={styles.expressionChipText}>
                      {card.expression}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </View>
          {progress?.status === "completed" ? (
            <View
              pointerEvents="box-none"
              style={styles.statusOverlay}
              testID="premium-home-done-overlay"
            >
              <Text style={styles.overlayTitle}>
                이미 학습을 완료한 큐레이션이에요
              </Text>
              {progressDetail ? (
                <Text
                  style={styles.overlayDetail}
                  testID="premium-home-progress-detail"
                >
                  {progressDetail}
                </Text>
              ) : null}
              <View style={styles.overlayActions}>
                <Pressable
                  style={styles.overlayPrimaryButton}
                  onPress={handleOpenSession}
                >
                  <Text style={styles.overlayPrimaryButtonText}>
                    다시 학습하기
                  </Text>
                </Pressable>
                <Pressable
                  style={styles.overlaySecondaryButton}
                  onPress={handleOpenReview}
                >
                  <Text style={styles.overlaySecondaryButtonText}>
                    복습하러가기
                  </Text>
                </Pressable>
              </View>
            </View>
          ) : progress?.status === "in-progress" ? (
            <View
              pointerEvents="box-none"
              style={styles.statusOverlay}
              testID="premium-home-pause-overlay"
            >
              <Text style={styles.overlayTitle}>아직 학습 중이에요</Text>
              {progressDetail ? (
                <Text
                  style={styles.overlayDetail}
                  testID="premium-home-progress-detail"
                >
                  {progressDetail}
                </Text>
              ) : null}
              <Pressable
                style={styles.overlayPrimaryButton}
                onPress={handleOpenSession}
              >
                <Text style={styles.overlayPrimaryButtonText}>
                  이어서 학습하기
                </Text>
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      ) : (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>오늘 세션을 준비 중이에요</Text>
          <Text style={styles.stateText}>
            publish된 premium session이 생기면 이곳에 바로 도착해요.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing["2xl"],
    paddingBottom: spacing["3xl"],
    gap: spacing.lg,
  },
  hero: {
    gap: spacing.xs,
  },
  greeting: {
    color: colors.textPremiumSecondary,
    fontSize: font.size["3xl"],
    lineHeight: leading(font.size["3xl"], font.lineHeight.tight),
    fontWeight: font.weight.semibold,
  },
  greetingName: {
    color: colors.textPremium,
    fontSize: font.size["4xl"],
    lineHeight: leading(font.size["4xl"], font.lineHeight.tight),
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.normal,
  },
  sectionTitle: {
    color: colors.textPremium,
    fontSize: font.size.lg,
    lineHeight: leading(font.size.lg, font.lineHeight.tight),
    fontWeight: font.weight.semibold,
    letterSpacing: font.tracking.normal,
    marginTop: spacing.md,
  },
  stateBox: {
    minHeight: 360,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    borderRadius: radius["2xl"],
    borderWidth: 1,
    borderColor: colors.borderPremium,
    backgroundColor: colors.bgPremiumCard,
    padding: spacing.lg,
  },
  stateTitle: {
    color: colors.textPremium,
    fontSize: font.size.xl,
    lineHeight: leading(font.size.xl, font.lineHeight.tight),
    fontWeight: font.weight.bold,
  },
  stateText: {
    color: colors.textPremiumSecondary,
    textAlign: "center",
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
  },
  secondaryButton: {
    borderRadius: radius.pill,
    backgroundColor: colors.bgPremiumControl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  secondaryButtonText: {
    color: colors.textPremium,
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
  },
  sessionCard: {
    height: 456,
    overflow: "hidden",
    borderRadius: radius["2xl"],
    backgroundColor: colors.bgPremiumCard,
  },
  sessionCardPressed: {
    opacity: 0.9,
  },
  cardMedia: {
    height: 192,
    overflow: "hidden",
  },
  sessionImage: {
    flex: 1,
    justifyContent: "flex-start",
    padding: spacing.md,
  },
  sessionImageStyle: {
    resizeMode: "cover",
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.bgDark,
    opacity: 0.16,
  },
  mediaFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 60,
    backgroundColor: colors.bgDark,
    opacity: 0.72,
  },
  statusOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    backgroundColor: colors.bgPremiumOverlay,
    padding: spacing.xl,
  },
  overlayTitle: {
    color: colors.textPremium,
    textAlign: "center",
    fontSize: font.size.xl,
    lineHeight: leading(font.size.xl, font.lineHeight.tight),
    fontWeight: font.weight.bold,
  },
  overlayDetail: {
    color: colors.textPremiumSecondary,
    textAlign: "center",
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
    fontWeight: font.weight.semibold,
  },
  overlayActions: {
    alignSelf: "stretch",
    gap: spacing.md,
  },
  overlayPrimaryButton: {
    alignSelf: "stretch",
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.textPremium,
    paddingVertical: spacing.md,
  },
  overlayPrimaryButtonText: {
    color: colors.bgDark,
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
  },
  overlaySecondaryButton: {
    alignSelf: "stretch",
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderPremium,
    backgroundColor: colors.bgPremiumControl,
    paddingVertical: spacing.md,
  },
  overlaySecondaryButtonText: {
    color: colors.textPremium,
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
  },
  cardTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  durationPill: {
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.bgPremiumControl,
    color: colors.textPremium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  sourcePill: {
    flexShrink: 1,
    overflow: "hidden",
    borderRadius: radius.pill,
    backgroundColor: colors.bgPremiumControl,
    color: colors.textPremium,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  cardTextBlock: {
    flex: 1,
    gap: spacing.md,
    padding: spacing.lg,
  },
  sessionTitle: {
    color: colors.textPremium,
    fontSize: font.size.xl,
    lineHeight: leading(font.size.xl, font.lineHeight.tight),
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.normal,
  },
  sessionDescription: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
    fontWeight: font.weight.semibold,
  },
  expressionBlock: {
    marginTop: "auto",
    gap: spacing.sm,
  },
  expressionBlockTitle: {
    color: colors.textPremium,
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.tight),
    fontWeight: font.weight.semibold,
  },
  expressionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  expressionChip: {
    borderRadius: radius.pill,
    backgroundColor: colors.bgPremiumControl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  expressionChipText: {
    color: colors.textPremium,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  ciSessionCard: {
    borderRadius: radius.xl,
    backgroundColor: colors.bgPremiumCard,
    borderWidth: 1,
    borderColor: colors.borderPremium,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  ciSessionLabel: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  ciSessionTitle: {
    color: colors.textPremium,
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    lineHeight: leading(font.size.lg, font.lineHeight.tight),
  },
  ciSessionMeta: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
});
