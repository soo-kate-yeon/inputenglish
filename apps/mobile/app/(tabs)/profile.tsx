// @MX:NOTE: [AUTO] Profile screen with membership banner, study stats, notification settings, and account actions.
// @MX:SPEC: SPEC-MOBILE-005, SPEC-MOBILE-006, SPEC-MOBILE-007
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Linking,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { appStore, studyStore } from "@/lib/stores";
import { useSubscription } from "@/hooks/useSubscription";
import { useNotificationSettings } from "@/hooks/useNotificationSettings";
import { getCustomerInfo } from "@/lib/revenue-cat";
import { colors, font, radius, shadow, spacing } from "@/theme";

// -- Sub-components --

function SettingRow({
  label,
  right,
  last = false,
}: {
  label: string;
  right: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[rowStyles.row, !last && rowStyles.rowBorder]}>
      <Text style={rowStyles.label}>{label}</Text>
      <View style={rowStyles.right}>{right}</View>
    </View>
  );
}

const rowStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  label: {
    fontSize: 16,
    color: colors.text,
    letterSpacing: 0.1,
  },
  right: {
    alignItems: "flex-end",
  },
});

// -- Membership banner --

interface MembershipBannerProps {
  isPremium: boolean;
  renewalDate: string | null;
  onUpgrade: () => void;
}

function MembershipBanner({
  isPremium,
  renewalDate,
  onUpgrade,
}: MembershipBannerProps) {
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

const bannerStyles = StyleSheet.create({
  // Premium state
  premiumCard: {
    backgroundColor: colors.bgBrand,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    ...shadow.md,
  },
  premiumLeft: {
    flex: 1,
    gap: 4,
  },
  premiumTitle: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
    letterSpacing: 0.1,
  },
  premiumSub: {
    fontSize: font.size.sm,
    color: "rgba(255,255,255,0.6)",
    letterSpacing: 0.1,
  },
  premiumBadge: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  premiumBadgeText: {
    fontSize: 10,
    letterSpacing: 1.5,
    fontWeight: font.weight.bold,
    color: "rgba(255,255,255,0.9)",
  },

  // Free state
  freeCard: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.xl,
    paddingHorizontal: spacing.md,
    paddingVertical: 18,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.sm,
  },
  freeLeft: {
    flex: 1,
    gap: 4,
  },
  freeTitle: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.text,
    letterSpacing: 0.1,
  },
  freeSub: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    letterSpacing: 0.1,
  },
  freeCta: {
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: radius.pill,
    marginLeft: spacing.sm,
  },
  freeCtaText: {
    fontSize: 13,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
    letterSpacing: 0.2,
  },
});

// -- Main screen --

export default function ProfileScreen() {
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
  const savedSentences = appStore((state) => state.savedSentences);
  const highlights = appStore((state) => state.highlights);
  const loadUserData = appStore((state) => state.loadUserData);

  const sessions = studyStore((s) => s.sessions);
  const completedSessions = sessions.filter((s) => s.isCompleted).length;
  const { studyReminder, newContent, streak, toggle } =
    useNotificationSettings();

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

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerWordmark}>프로필</Text>
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
            {joinDate ? (
              <Text style={styles.identityMeta}>가입일 {joinDate}</Text>
            ) : null}
          </View>
        </View>

        {/* Membership banner — above stats */}
        <MembershipBanner
          isPremium={isPremium}
          renewalDate={renewalDate}
          onUpgrade={() => router.push("/paywall")}
        />

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
              label="현재 수준"
              right={
                <Text style={styles.settingValue}>
                  {learningProfile?.level_band === "beginner"
                    ? "거의 한마디도 못한다"
                    : learningProfile?.level_band === "basic"
                      ? "간단한 의사표현 가능"
                      : learningProfile?.level_band === "conversation"
                        ? "일상 회화 가능"
                        : learningProfile?.level_band === "professional"
                          ? "영어로 업무 소통 가능"
                          : "아직 설정 안됨"}
                </Text>
              }
            />
            <SettingRow
              label="선호 포커스"
              last
              right={
                <Text style={styles.settingValue} numberOfLines={2}>
                  {learningProfile?.focus_tags?.length
                    ? learningProfile.focus_tags.join(", ")
                    : "아직 설정 안됨"}
                </Text>
              }
            />
          </View>
          <TouchableOpacity
            style={styles.learningSettingsButton}
            onPress={() => router.push("/onboarding?edit=1" as never)}
            activeOpacity={0.88}
          >
            <Text style={styles.learningSettingsButtonText}>
              학습 설정 다시 하기
            </Text>
          </TouchableOpacity>
        </View>

        {/* Stats block */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>활동</Text>
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{savedSentences.length}</Text>
              <Text style={styles.statLabel}>저장 문장</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{highlights.length}</Text>
              <Text style={styles.statLabel}>하이라이트</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{sessions.length}</Text>
              <Text style={styles.statLabel}>학습 세션</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{completedSessions}</Text>
              <Text style={styles.statLabel}>완료 세션</Text>
            </View>
          </View>
        </View>

        {/* Notification settings */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>알림 설정</Text>
          <View style={styles.groupSurface}>
            <SettingRow
              label="학습 리마인더"
              right={
                <Switch
                  value={studyReminder}
                  onValueChange={() => toggle("studyReminder")}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.bg}
                  accessibilityLabel="학습 리마인더 알림 토글"
                />
              }
            />
            <SettingRow
              label="새 콘텐츠"
              right={
                <Switch
                  value={newContent}
                  onValueChange={() => toggle("newContent")}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.bg}
                  accessibilityLabel="새 콘텐츠 알림 토글"
                />
              }
            />
            <SettingRow
              label="연속 학습"
              last
              right={
                <Switch
                  value={streak}
                  onValueChange={() => toggle("streak")}
                  trackColor={{ false: colors.border, true: colors.primary }}
                  thumbColor={colors.bg}
                  accessibilityLabel="연속 학습 알림 토글"
                />
              }
            />
          </View>
        </View>

        {/* Legal links */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>약관 및 정책</Text>
          <View style={styles.groupSurface}>
            <TouchableOpacity
              style={[rowStyles.row, rowStyles.rowBorder]}
              onPress={() =>
                Linking.openURL("https://inputenglish.vercel.app/terms")
              }
              accessibilityRole="link"
              accessibilityLabel="이용약관"
            >
              <Text style={rowStyles.label}>이용약관</Text>
              <Text style={styles.chevron}>›</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={rowStyles.row}
              onPress={() =>
                Linking.openURL("https://inputenglish.vercel.app/privacy")
              }
              accessibilityRole="link"
              accessibilityLabel="개인정보처리방침"
            >
              <Text style={rowStyles.label}>개인정보처리방침</Text>
              <Text style={styles.chevron}>›</Text>
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  // Header
  header: {
    paddingHorizontal: spacing.md,
    paddingTop: 20,
    paddingBottom: 16,
  },
  headerWordmark: {
    fontSize: font.size["2xl"],
    fontWeight: font.weight.bold,
    letterSpacing: 1,
    color: colors.text,
  },

  scrollContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.lg,
    paddingBottom: 120,
    gap: 24,
  },

  // Identity row (no plan badge — banner handles it now)
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: "700",
    color: colors.textInverse,
  },
  identityInfo: {
    flex: 1,
    gap: 3,
  },
  identityEmail: {
    fontSize: 17,
    fontWeight: "700",
    color: colors.text,
    letterSpacing: 0.1,
  },
  identityMeta: {
    fontSize: 13,
    color: colors.textSecondary,
    letterSpacing: 0.2,
  },

  // Group (label + surface)
  group: {
    gap: 8,
  },
  groupLabel: {
    fontSize: 12,
    letterSpacing: 1.5,
    fontWeight: "600",
    color: colors.textMuted,
    paddingHorizontal: 4,
  },
  groupSurface: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    overflow: "hidden",
  },
  settingValue: {
    maxWidth: 180,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: "right",
  },
  learningSettingsButton: {
    marginTop: spacing.sm,
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  learningSettingsButtonText: {
    fontSize: 15,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },

  // Stats
  statsContainer: {
    backgroundColor: colors.bgSubtle,
    borderRadius: radius.lg,
    flexDirection: "row",
    alignItems: "stretch",
    overflow: "hidden",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 20,
    gap: 5,
  },
  statDivider: {
    width: 1,
    backgroundColor: colors.border,
    marginVertical: 14,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.textSecondary,
    textAlign: "center",
  },

  // Action rows
  actionRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 16,
    alignItems: "center",
  },
  signOutText: {
    fontSize: 15,
    fontWeight: font.weight.semibold,
    color: colors.text,
  },
  deleteText: {
    fontSize: 15,
    fontWeight: "500",
    color: colors.error,
  },
  chevron: {
    fontSize: 18,
    color: colors.textMuted,
    fontWeight: "300",
  },
});
