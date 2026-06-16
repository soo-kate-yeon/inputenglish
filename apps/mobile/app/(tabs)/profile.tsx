// @MX:NOTE: [AUTO] Profile screen — editorial-tech design system, v1.3 comprehensible-input model.
// @MX:SPEC: SPEC-MOBILE-005, SPEC-MOBILE-006, SPEC-MOBILE-007
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  TouchableOpacity,
  View,
} from "react-native";
import { Text } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { appStore } from "@/lib/stores";
import { useSubscription } from "@/hooks/useSubscription";
import { getCustomerInfo } from "@/lib/revenue-cat";
import { createThemedStyles, useTheme } from "@/components/ui";

// -- Helper: level_band -> Korean label --

function levelBandLabel(band: string | undefined | null): string | null {
  switch (band) {
    case "beginner":
      return "초급 — 거의 한 마디도 못해요";
    case "basic":
      return "기초 — 간단한 의사표현 정도만 가능해요";
    case "conversation":
      return "생활회화 — 일상 회화는 가능해요";
    case "professional":
      return "비즈니스 — 영어로 업무 소통이나 논의까지 가능해요";
    default:
      return null;
  }
}

// -- Sub-components --

const getRowStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  label: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
  },
  right: {
    alignItems: "flex-end" as const,
  },
}));

function SettingRow({
  label,
  right,
  last = false,
}: {
  label: string;
  right: React.ReactNode;
  last?: boolean;
}) {
  const theme = useTheme();
  const rowStyles = getRowStyles(theme);
  return (
    <View style={[rowStyles.row, !last && rowStyles.rowBorder]}>
      <Text style={rowStyles.label}>{label}</Text>
      <View style={rowStyles.right}>{right}</View>
    </View>
  );
}

// -- Membership banner --

interface MembershipBannerProps {
  isPremium: boolean;
  renewalDate: string | null;
  onUpgrade: () => void;
}

const getBannerStyles = createThemedStyles((theme) => ({
  // Premium state
  premiumCard: {
    backgroundColor: theme.colors.text.primary,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 18,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    ...theme.shadows.card,
  },
  premiumLeft: {
    flex: 1,
    gap: theme.spacing[1],
  },
  premiumTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.inverse,
  },
  premiumSub: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  premiumBadge: {
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: theme.radius.full,
    marginLeft: theme.spacing[2],
  },
  premiumBadgeText: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: "700" as const,
    color: theme.colors.text.inverse,
  },

  // Free state
  freeCard: {
    backgroundColor: theme.colors.surface.muted,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 18,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
  },
  freeLeft: {
    flex: 1,
    gap: theme.spacing[1],
  },
  freeTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
  freeSub: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  freeCta: {
    backgroundColor: theme.colors.action.primary,
    paddingHorizontal: 14,
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.full,
    marginLeft: theme.spacing[2],
  },
  freeCtaText: {
    ...theme.typography.label,
    color: theme.colors.text.inverse,
  },
}));

function MembershipBanner({
  isPremium,
  renewalDate,
  onUpgrade,
}: MembershipBannerProps) {
  const theme = useTheme();
  const bannerStyles = getBannerStyles(theme);

  if (isPremium) {
    return (
      <View style={bannerStyles.premiumCard}>
        <View style={bannerStyles.premiumLeft}>
          <Text style={bannerStyles.premiumTitle}>
            무제한 학습 멤버십 이용중
          </Text>
          {renewalDate ? (
            <Text style={bannerStyles.premiumSub}>갱신일 {renewalDate}</Text>
          ) : null}
        </View>
        <View style={bannerStyles.premiumBadge}>
          <Text style={bannerStyles.premiumBadgeText}>PREMIUM</Text>
        </View>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={bannerStyles.freeCard}
      onPress={onUpgrade}
      activeOpacity={0.88}
      accessibilityRole="button"
      accessibilityLabel="무제한 학습 멤버십 업그레이드"
    >
      <View style={bannerStyles.freeLeft}>
        <Text style={bannerStyles.freeTitle}>무제한 학습 멤버십</Text>
        <Text style={bannerStyles.freeSub}>
          모든 세션 · AI 코칭 · 광고 없음
        </Text>
      </View>
      <View style={bannerStyles.freeCta}>
        <Text style={bannerStyles.freeCtaText}>시작하기</Text>
      </View>
    </TouchableOpacity>
  );
}

// -- Main screen --

const getStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
  },

  // Header
  header: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[5],
    paddingBottom: theme.spacing[4],
  },
  headerTitle: {
    ...theme.typography.title,
    color: theme.colors.text.primary,
    letterSpacing: 0.5,
  },

  scrollContent: {
    paddingHorizontal: theme.spacing[5],
    paddingTop: theme.spacing[5],
    paddingBottom: 120,
    gap: theme.spacing[6],
  },

  // Identity row
  identityRow: {
    flexDirection: "row" as const,
    alignItems: "flex-start" as const,
    gap: theme.spacing[3],
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.action.primary,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    flexShrink: 0,
  },
  avatarLetter: {
    ...theme.typography.sectionTitle,
    color: theme.colors.text.inverse,
  },
  identityInfo: {
    flex: 1,
    gap: theme.spacing[1],
    paddingTop: 2,
  },
  identityEmail: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
  identityMetaBlock: {
    gap: 2,
  },
  identityMetaLine: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    flexShrink: 1,
  },

  // Level band chip
  levelBandRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 14,
  },
  levelBandLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    flex: 1,
  },
  levelBandValue: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
    maxWidth: 200,
    textAlign: "right" as const,
  },

  // Group (label + surface)
  group: {
    gap: theme.spacing[2],
  },
  groupLabel: {
    ...theme.typography.caption,
    fontSize: 11,
    letterSpacing: 1.5,
    fontWeight: "600" as const,
    color: theme.colors.text.tertiary,
    textTransform: "uppercase" as const,
    paddingHorizontal: 4,
  },
  groupSurface: {
    backgroundColor: theme.colors.surface.muted,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    overflow: "hidden" as const,
  },
  settingValue: {
    ...theme.typography.caption,
    maxWidth: 180,
    color: theme.colors.text.secondary,
    textAlign: "right" as const,
  },

  // Nav buttons (학습 설정 다시 하기, 질문 히스토리)
  navButton: {
    backgroundColor: theme.colors.surface.muted,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 14,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
  },
  navButtonText: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
  },
  navChevron: {
    ...theme.typography.sectionTitle,
    color: theme.colors.text.tertiary,
    fontWeight: "300" as const,
  },

  // Legal / action rows
  legalRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 14,
  },
  legalRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border.subtle,
  },
  legalLabel: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
  },
  legalChevron: {
    ...theme.typography.sectionTitle,
    color: theme.colors.text.tertiary,
    fontWeight: "300" as const,
  },

  actionRow: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 16,
    alignItems: "center" as const,
  },
  signOutText: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
  deleteText: {
    ...theme.typography.body,
    color: theme.colors.text.danger,
  },
}));

export default function ProfileScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);

  const { user, learningProfile, signOut, deleteAccount, isAuthenticated } =
    useAuth();
  const [isDeleting, setIsDeleting] = useState(false);
  const [renewalDate, setRenewalDate] = useState<string | null>(null);

  const handleDeleteAccount = () => {
    Alert.alert(
      "계정 삭제",
      "정말로 계정을 삭제하시겠습니까? 모든 학습 데이터가 영구적으로 삭제되며 복구할 수 없습니다.",
      [
        { text: "취소", style: "cancel" },
        {
          text: "삭제",
          style: "destructive",
          onPress: async () => {
            try {
              setIsDeleting(true);
              await deleteAccount();
            } catch {
              Alert.alert(
                "오류",
                "계정 삭제에 실패했습니다. 다시 시도해주세요.",
              );
            } finally {
              setIsDeleting(false);
            }
          },
        },
      ],
    );
  };

  const { plan } = useSubscription();
  const loadUserData = appStore((state) => state.loadUserData);

  const isPremium = plan === "PREMIUM";

  // Fetch renewal date from RevenueCat when premium
  useEffect(() => {
    if (!isPremium) {
      setRenewalDate(null);
      return;
    }
    getCustomerInfo()
      .then((info) => {
        const expDate = info.latestExpirationDate;
        if (expDate) {
          const formatted = new Date(expDate).toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          });
          setRenewalDate(formatted);
        }
      })
      .catch(() => {
        // Non-critical — silently ignore
      });
  }, [isPremium]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadUserData().catch((error) => {
          console.error("[MobileProfile] Failed to load user data:", error);
        });
      }
    }, [isAuthenticated, loadUserData]),
  );

  const avatarLetter = user?.email?.[0]?.toUpperCase() ?? "?";
  const joinDate = user?.created_at
    ? new Date(user.created_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const lastSignInDate = user?.last_sign_in_at
    ? new Date(user.last_sign_in_at).toLocaleDateString("ko-KR", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : null;
  const identityMetaItems = [
    joinDate ? `가입일 ${joinDate}` : null,
    lastSignInDate ? `마지막 로그인 ${lastSignInDate}` : null,
  ].filter(Boolean) as string[];

  // level_band -> friendly Korean label (graceful omit if not set)
  const levelLabel = levelBandLabel(learningProfile?.level_band);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        barStyle="dark-content"
        backgroundColor={theme.colors.background.canvas}
      />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>프로필</Text>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* User identity row */}
        <View style={styles.identityRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{avatarLetter}</Text>
          </View>
          <View style={styles.identityInfo}>
            <Text style={styles.identityEmail} numberOfLines={1}>
              {user?.email ?? "로그인이 필요합니다"}
            </Text>
            {identityMetaItems.length > 0 ? (
              <View style={styles.identityMetaBlock}>
                {identityMetaItems.map((item) => (
                  <Text key={item} style={styles.identityMetaLine}>
                    {item}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        {/* Membership banner */}
        <MembershipBanner
          isPremium={isPremium}
          renewalDate={renewalDate}
          onUpgrade={() => router.push("/paywall")}
        />

        {/* 내 학습 수준 — gracefully omitted if learningProfile.level_band is not set */}
        {levelLabel ? (
          <View style={styles.group}>
            <Text style={styles.groupLabel}>내 학습 수준</Text>
            <View style={styles.groupSurface}>
              <View style={styles.levelBandRow}>
                <Text style={styles.levelBandValue}>{levelLabel}</Text>
              </View>
            </View>
          </View>
        ) : null}

        {/* 학습 설정 */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>학습 설정</Text>
          <View style={styles.groupSurface}>
            <SettingRow
              label="현재 목표"
              right={
                <Text style={styles.settingValue}>
                  {learningProfile?.goal_mode === "pronunciation"
                    ? "발음/억양 훔치기"
                    : learningProfile?.goal_mode === "expression"
                      ? "표현 훔치기"
                      : "아직 설정 안됨"}
                </Text>
              }
            />
            <SettingRow
              label="선호 포커스"
              last
              right={
                <Text style={styles.settingValue} numberOfLines={2}>
                  {learningProfile?.goal_mode === "pronunciation" &&
                  learningProfile.preferred_speakers.length > 0
                    ? learningProfile.preferred_speakers.join(", ")
                    : learningProfile?.goal_mode === "expression" &&
                        (learningProfile.preferred_situations.length > 0 ||
                          learningProfile.preferred_genres.length > 0)
                      ? [
                          ...learningProfile.preferred_situations,
                          ...learningProfile.preferred_genres,
                        ].join(", ")
                      : learningProfile?.focus_tags?.length
                        ? learningProfile.focus_tags.join(", ")
                        : "아직 설정 안됨"}
                </Text>
              }
            />
          </View>

          {/* 학습 설정 다시 하기 */}
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/onboarding?edit=1" as never)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="학습 설정 다시 하기"
          >
            <Text style={styles.navButtonText}>학습 설정 다시 하기</Text>
            <Text style={styles.navChevron}>›</Text>
          </TouchableOpacity>

          {/* 질문 히스토리 */}
          <TouchableOpacity
            style={styles.navButton}
            onPress={() => router.push("/question-history" as never)}
            activeOpacity={0.88}
            accessibilityRole="button"
            accessibilityLabel="질문 히스토리"
          >
            <Text style={styles.navButtonText}>질문 히스토리</Text>
            <Text style={styles.navChevron}>›</Text>
          </TouchableOpacity>
        </View>

        {/* Legal links */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>약관 및 정책</Text>
          <View style={styles.groupSurface}>
            <TouchableOpacity
              style={[styles.legalRow, styles.legalRowBorder]}
              onPress={() =>
                Linking.openURL("https://inputenglish.vercel.app/terms")
              }
              accessibilityRole="link"
              accessibilityLabel="이용약관"
            >
              <Text style={styles.legalLabel}>이용약관</Text>
              <Text style={styles.legalChevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.legalRow}
              onPress={() =>
                Linking.openURL("https://inputenglish.vercel.app/privacy")
              }
              accessibilityRole="link"
              accessibilityLabel="개인정보처리방침"
            >
              <Text style={styles.legalLabel}>개인정보처리방침</Text>
              <Text style={styles.legalChevron}>›</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Sign out */}
        <View style={styles.group}>
          <View style={styles.groupSurface}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="로그아웃"
            >
              <Text style={styles.signOutText}>로그아웃</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Delete account */}
        <View style={styles.group}>
          <View style={styles.groupSurface}>
            <TouchableOpacity
              style={styles.actionRow}
              onPress={handleDeleteAccount}
              disabled={isDeleting}
              accessibilityRole="button"
              accessibilityLabel="계정 삭제"
            >
              <Text style={styles.deleteText}>
                {isDeleting ? "삭제 중..." : "계정 삭제"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
