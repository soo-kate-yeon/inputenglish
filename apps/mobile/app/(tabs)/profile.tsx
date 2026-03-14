// @MX:NOTE: [AUTO] Profile screen with avatar, study stats, join date, plan upgrade, and notification settings.
// @MX:SPEC: SPEC-MOBILE-005, SPEC-MOBILE-006, SPEC-MOBILE-007
import React, { useCallback } from "react";
import {
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

// --- Design tokens (square minimalism) ---
const COLOR = {
  bg: "#F2F2F2",
  surface: "#FFFFFF",
  border: "#111111",
  borderLight: "#E0E0E0",
  text: "#111111",
  textMuted: "#888888",
  textInverse: "#FFFFFF",
};

// --- Reusable row inside a section group ---
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
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: COLOR.borderLight,
  },
  label: {
    fontSize: 14,
    color: COLOR.text,
    letterSpacing: 0.1,
  },
  right: {
    alignItems: "flex-end",
  },
});

export default function ProfileScreen() {
  const { user, signOut, isAuthenticated } = useAuth();
  const { plan } = useSubscription();
  const savedSentences = appStore((state) => state.savedSentences);
  const highlights = appStore((state) => state.highlights);
  const loadUserData = appStore((state) => state.loadUserData);

  const sessions = studyStore((s) => s.sessions);
  const completedSessions = sessions.filter((s) => s.isCompleted).length;
  const { studyReminder, newContent, streak, toggle } =
    useNotificationSettings();

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

  const isPremium = plan === "PREMIUM";

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={COLOR.bg} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* ── User identity row (Toss-style) ── */}
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
          {/* Plan pill */}
          <TouchableOpacity
            style={[styles.planBadge, isPremium && styles.planBadgePremium]}
            onPress={!isPremium ? () => router.push("/paywall") : undefined}
            accessibilityLabel={isPremium ? "프리미엄 플랜" : "업그레이드"}
          >
            <Text
              style={[
                styles.planBadgeText,
                isPremium && styles.planBadgeTextPremium,
              ]}
            >
              {isPremium ? "PREMIUM" : "UPGRADE"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* ── Stats block ── */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>ACTIVITY</Text>
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

        {/* ── Notification settings ── */}
        <View style={styles.group}>
          <Text style={styles.groupLabel}>알림 설정</Text>
          <View style={styles.groupSurface}>
            <SettingRow
              label="학습 리마인더"
              right={
                <Switch
                  value={studyReminder}
                  onValueChange={() => toggle("studyReminder")}
                  trackColor={{ false: COLOR.borderLight, true: COLOR.text }}
                  thumbColor={COLOR.surface}
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
                  trackColor={{ false: COLOR.borderLight, true: COLOR.text }}
                  thumbColor={COLOR.surface}
                  accessibilityLabel="새 콘텐츠 알림 토글"
                />
              }
            />
            <SettingRow
              label="Streak"
              last
              right={
                <Switch
                  value={streak}
                  onValueChange={() => toggle("streak")}
                  trackColor={{ false: COLOR.borderLight, true: COLOR.text }}
                  thumbColor={COLOR.surface}
                  accessibilityLabel="Streak 알림 토글"
                />
              }
            />
          </View>
        </View>

        {/* ── Sign out ── */}
        <View style={styles.group}>
          <View style={styles.groupSurface}>
            <TouchableOpacity
              style={styles.signOutRow}
              onPress={signOut}
              accessibilityRole="button"
              accessibilityLabel="로그아웃"
            >
              <Text style={styles.signOutText}>SIGN OUT</Text>
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
    backgroundColor: COLOR.bg,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 120,
    gap: 24,
  },

  // Identity row
  identityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 52,
    height: 52,
    backgroundColor: COLOR.text,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  avatarLetter: {
    fontSize: 22,
    fontWeight: "700",
    color: COLOR.textInverse,
  },
  identityInfo: {
    flex: 1,
    gap: 3,
  },
  identityEmail: {
    fontSize: 15,
    fontWeight: "700",
    color: COLOR.text,
    letterSpacing: 0.1,
  },
  identityMeta: {
    fontSize: 11,
    color: COLOR.textMuted,
    letterSpacing: 0.2,
  },
  planBadge: {
    borderWidth: 1,
    borderColor: COLOR.border,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  planBadgePremium: {
    backgroundColor: COLOR.text,
    borderColor: COLOR.text,
  },
  planBadgeText: {
    fontSize: 9,
    letterSpacing: 1.5,
    fontWeight: "700",
    color: COLOR.text,
  },
  planBadgeTextPremium: {
    color: COLOR.textInverse,
  },

  // Group (label + surface)
  group: {
    gap: 8,
  },
  groupLabel: {
    fontSize: 10,
    letterSpacing: 2,
    fontWeight: "600",
    color: COLOR.textMuted,
    paddingHorizontal: 4,
  },
  groupSurface: {
    backgroundColor: COLOR.surface,
    overflow: "hidden",
  },

  // Stats — single surface, 4 columns
  statsContainer: {
    backgroundColor: COLOR.surface,
    flexDirection: "row",
    alignItems: "stretch",
  },
  statItem: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 18,
    gap: 5,
  },
  statDivider: {
    width: 1,
    backgroundColor: COLOR.borderLight,
    marginVertical: 14,
  },
  statValue: {
    fontSize: 22,
    fontWeight: "800",
    color: COLOR.text,
    letterSpacing: -0.5,
  },
  statLabel: {
    fontSize: 9,
    letterSpacing: 0.5,
    color: COLOR.textMuted,
    textAlign: "center",
  },

  // Sign out
  signOutRow: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    alignItems: "center",
  },
  signOutText: {
    fontSize: 11,
    letterSpacing: 2,
    fontWeight: "700",
    color: COLOR.text,
  },
});
