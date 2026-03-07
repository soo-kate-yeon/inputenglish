import React, { useCallback } from "react";
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

export default function ArchiveScreen() {
  const { isAuthenticated, isLoading } = useAuth();
  const savedSentences = appStore((state) => state.savedSentences);
  const loadUserData = appStore((state) => state.loadUserData);
  const removeSavedSentence = appStore((state) => state.removeSavedSentence);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        loadUserData().catch((error) => {
          console.error("[MobileArchive] Failed to load user data:", error);
        });
      }
    }, [isAuthenticated, loadUserData]),
  );

  const renderItem = useCallback(
    ({
      item,
    }: {
      item: {
        id: string;
        videoId: string;
        sentenceText: string;
        createdAt: number;
      };
    }) => (
      <View style={styles.card}>
        <Text style={styles.videoId}>{item.videoId}</Text>
        <Text style={styles.sentenceText}>{item.sentenceText}</Text>
        <View style={styles.cardFooter}>
          <Text style={styles.timestamp}>
            {new Date(item.createdAt).toLocaleString("ko-KR")}
          </Text>
          <TouchableOpacity
            onPress={() => removeSavedSentence(item.id)}
            style={styles.deleteButton}
          >
            <Text style={styles.deleteButtonText}>삭제</Text>
          </TouchableOpacity>
        </View>
      </View>
    ),
    [removeSavedSentence],
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Archive</Text>
        <Text style={styles.subtitle}>
          저장한 문장 {savedSentences.length}개
        </Text>
      </View>

      {savedSentences.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.emptyTitle}>아직 저장한 문장이 없어요.</Text>
          <Text style={styles.emptySubtitle}>
            리스닝 화면에서 북마크한 문장이 여기에 표시됩니다.
          </Text>
        </View>
      ) : (
        <FlatList
          data={[...savedSentences].sort((a, b) => b.createdAt - a.createdAt)}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
        />
      )}
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
  videoId: {
    fontSize: 12,
    color: "#888",
    fontWeight: "600",
  },
  sentenceText: {
    fontSize: 16,
    lineHeight: 23,
    color: "#222",
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
