// @MX:NOTE: [AUTO] Profile screen with avatar, study stats, join date, and plan upgrade button.
// @MX:SPEC: SPEC-MOBILE-005, SPEC-MOBILE-006
import React, { useCallback } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { appStore, studyStore } from "@/lib/stores";
import { useSubscription } from "@/hooks/useSubscription";

export default function ProfileScreen() {
  const { user, signOut, isAuthenticated } = useAuth();
  const { plan } = useSubscription();
  const savedSentences = appStore((state) => state.savedSentences);
  const highlights = appStore((state) => state.highlights);
  const loadUserData = appStore((state) => state.loadUserData);

  const sessions = studyStore((s) => s.sessions);
  const completedSessions = sessions.filter((s) => s.isCompleted).length;

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

      <TouchableOpacity style={styles.signOutButton} onPress={signOut}>
        <Text style={styles.signOutText}>Sign Out</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: "#f8f8f8",
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
  },
  signOutText: {
    color: "white",
    fontWeight: "600",
  },
});
