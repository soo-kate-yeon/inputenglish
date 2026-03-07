import React, { useCallback } from "react";
import {
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { appStore } from "@/lib/stores";

export default function ProfileScreen() {
  const { user, signOut, isAuthenticated } = useAuth();
  const savedSentences = appStore((state) => state.savedSentences);
  const highlights = appStore((state) => state.highlights);
  const loadUserData = appStore((state) => state.loadUserData);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadUserData().catch((error) => {
          console.error("[MobileProfile] Failed to load user data:", error);
        });
      }
    }, [isAuthenticated, loadUserData]),
  );

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Profile</Text>
      {user ? <Text style={styles.email}>{user.email}</Text> : null}

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>저장한 문장</Text>
          <Text style={styles.statValue}>{savedSentences.length}</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>하이라이트</Text>
          <Text style={styles.statValue}>{highlights.length}</Text>
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
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 8,
    color: "#111",
  },
  email: {
    fontSize: 16,
    color: "#666",
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 16,
  },
  statLabel: {
    fontSize: 13,
    color: "#777",
    marginBottom: 6,
  },
  statValue: {
    fontSize: 24,
    fontWeight: "700",
    color: "#111",
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
