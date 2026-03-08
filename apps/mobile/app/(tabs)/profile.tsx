// @MX:NOTE: [AUTO] Profile screen with avatar, study stats, join date, plan upgrade, and notification settings.
// @MX:SPEC: SPEC-MOBILE-005, SPEC-MOBILE-006, SPEC-MOBILE-007
import React, { useCallback } from "react";
import {
  SafeAreaView,
  ScrollView,
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Avatar */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarLetter}>{avatarLetter}</Text>
          </View>
          {user ? <Text style={styles.email}>{user.email}</Text> : null}
          {joinDate ? (
            <Text style={styles.joinDate}>가입일 {joinDate}</Text>
          ) : null}
        </View>

        {/* Plan badge + upgrade button */}
        <View style={styles.planRow}>
          <View
            style={[
              styles.planBadge,
              plan === "PREMIUM" && styles.planBadgePremium,
            ]}
          >
            <Text style={styles.planBadgeText}>
              {plan === "PREMIUM" ? "✦ Premium" : "Free"}
            </Text>
          </View>
          {plan === "FREE" ? (
            <TouchableOpacity
              style={styles.upgradeButton}
              onPress={() => router.push("/paywall")}
              accessibilityRole="button"
              accessibilityLabel="프리미엄 업그레이드"
            >
              <Text style={styles.upgradeText}>업그레이드</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{savedSentences.length}</Text>
            <Text style={styles.statLabel}>저장 문장</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{highlights.length}</Text>
            <Text style={styles.statLabel}>하이라이트</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{sessions.length}</Text>
            <Text style={styles.statLabel}>학습 세션</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{completedSessions}</Text>
            <Text style={styles.statLabel}>완료 세션</Text>
          </View>
        </View>

        {/* Notification settings (AC-PUSH-006) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>알림 설정</Text>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>학습 리마인더</Text>
            <Switch
              value={studyReminder}
              onValueChange={() => toggle("studyReminder")}
              accessibilityLabel="학습 리마인더 알림 토글"
            />
          </View>
          <View style={styles.settingRow}>
            <Text style={styles.settingLabel}>새 콘텐츠</Text>
            <Switch
              value={newContent}
              onValueChange={() => toggle("newContent")}
              accessibilityLabel="새 콘텐츠 알림 토글"
            />
          </View>
          <View style={[styles.settingRow, styles.settingRowLast]}>
            <Text style={styles.settingLabel}>Streak</Text>
            <Switch
              value={streak}
              onValueChange={() => toggle("streak")}
              accessibilityLabel="Streak 알림 토글"
            />
          </View>
        </View>

        <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
          <Text style={styles.signOutText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8f8f8",
  },
  scrollContent: {
    padding: 20,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 16,
    marginTop: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#007AFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  avatarLetter: {
    fontSize: 30,
    fontWeight: "700",
    color: "#fff",
  },
  email: {
    fontSize: 16,
    color: "#333",
    fontWeight: "600",
    marginBottom: 4,
  },
  joinDate: {
    fontSize: 13,
    color: "#999",
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    marginBottom: 24,
  },
  planBadge: {
    backgroundColor: "#8E8E93",
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  planBadgePremium: {
    backgroundColor: "#007AFF",
  },
  planBadgeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  upgradeButton: {
    backgroundColor: "#007AFF",
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  upgradeText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 28,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    backgroundColor: "#fff",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  statValue: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111",
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 13,
    color: "#777",
  },
  signOutButton: {
    backgroundColor: "#FF3B30",
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    alignSelf: "flex-start",
    marginBottom: 32,
  },
  signOutText: {
    color: "white",
    fontWeight: "600",
  },
  section: {
    backgroundColor: "#fff",
    borderRadius: 14,
    marginBottom: 20,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    color: "#999",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E5EA",
  },
  settingRowLast: {
    marginBottom: 4,
  },
  settingLabel: {
    fontSize: 15,
    color: "#111",
  },
});
