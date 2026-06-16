import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { router } from "expo-router";
import { createThemedStyles, useTheme } from "@/components/ui";
import {
  fetchTodayCiSession,
  fetchTodayPremiumSession,
  type TodayCiSessionShape,
} from "@/lib/premium-api";

// @MX:NOTE: [AUTO] v1.3 home — CI session is the primary surface (supersedes the
// PREMIUM-001 curation card). Entitlement is still gated server-side; a denied
// entitlement redirects to the paywall.
// @MX:SPEC: SPEC-INPUT-001 - REQ-INPUT-005 (session assembly entry point)
export default function HomeScreen() {
  const theme = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();

  const [ciSession, setCiSession] = useState<TodayCiSessionShape | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadToday = useCallback(async () => {
    setError(null);
    try {
      const [entitlementResult, ciResult] = await Promise.allSettled([
        fetchTodayPremiumSession(),
        fetchTodayCiSession(),
      ]);

      // Entitlement gate (server-authoritative): no access -> paywall.
      if (entitlementResult.status === "fulfilled") {
        const ent = entitlementResult.value.entitlement;
        if (ent && !ent.hasAccess) {
          router.push("/paywall");
        }
      }

      if (ciResult.status === "fulfilled") {
        setCiSession(ciResult.value.session);
      } else {
        throw ciResult.reason;
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "오늘의 세션을 불러오지 못했어요.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadToday();
  }, [loadToday]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    void loadToday();
  }, [loadToday]);

  const openSession = useCallback(() => {
    router.push("/premium");
  }, []);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + theme.spacing[6] },
      ]}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={theme.colors.text.secondary}
        />
      }
    >
      <View style={styles.hero}>
        <Text style={styles.greeting}>Good morning,</Text>
        <Text style={styles.greetingName}>오늘의 인풋</Text>
      </View>

      <Text style={styles.sectionTitle}>오늘 도착한 세션</Text>

      {loading ? (
        <View style={styles.stateBox}>
          <ActivityIndicator color={theme.colors.text.secondary} />
        </View>
      ) : error ? (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>잠깐 멈췄어요</Text>
          <Text style={styles.stateText}>{error}</Text>
          <Pressable style={styles.retryButton} onPress={handleRefresh}>
            <Text style={styles.retryButtonText}>다시 불러오기</Text>
          </Pressable>
        </View>
      ) : ciSession ? (
        <Pressable
          testID="ci-session-card"
          style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
          onPress={openSession}
        >
          <Text style={styles.cardLabel}>오늘의 세션</Text>
          {ciSession.readingPiece ? (
            <Text style={styles.cardTitle} numberOfLines={3}>
              {ciSession.readingPiece.topic}
            </Text>
          ) : (
            <Text style={styles.cardTitle}>리딩 + 듣기 한 세트</Text>
          )}
          <View style={styles.metaRow}>
            <Text style={styles.metaText}>읽기 1편</Text>
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>
              영상 {ciSession.segments.length}편
            </Text>
            {ciSession.readingPiece?.level ? (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>
                  Lv {ciSession.readingPiece.level}
                </Text>
              </>
            ) : null}
          </View>
          <View style={styles.startPill}>
            <Text style={styles.startPillText}>시작하기</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>오늘 세션을 준비 중이에요</Text>
          <Text style={styles.stateText}>
            오늘의 읽기와 듣기 세트가 준비되면 이곳에 도착해요.
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const getStyles = createThemedStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing[6],
    paddingBottom: theme.spacing[12],
    gap: theme.spacing[6],
  },
  hero: {
    gap: theme.spacing[1],
  },
  greeting: {
    ...theme.typography.title,
    color: theme.colors.text.secondary,
  },
  greetingName: {
    ...theme.typography.display,
    color: theme.colors.text.primary,
  },
  sectionTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.text.primary,
  },
  stateBox: {
    minHeight: 320,
    alignItems: "center",
    justifyContent: "center",
    gap: theme.spacing[3],
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.surface.muted,
    padding: theme.spacing[6],
  },
  stateTitle: {
    ...theme.typography.sectionTitle,
    color: theme.colors.text.primary,
  },
  stateText: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    textAlign: "center",
  },
  retryButton: {
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.action.primary,
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[3],
  },
  retryButtonText: {
    ...theme.typography.button,
    color: theme.colors.text.inverse,
  },
  card: {
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.surface.base,
    padding: theme.spacing[6],
    gap: theme.spacing[3],
    minHeight: 320,
    justifyContent: "center",
  },
  cardPressed: {
    opacity: 0.9,
  },
  cardLabel: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  cardTitle: {
    ...theme.typography.title,
    color: theme.colors.text.primary,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: theme.spacing[2],
  },
  metaText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  metaDot: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
  },
  startPill: {
    alignSelf: "flex-start",
    marginTop: theme.spacing[2],
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.action.primary,
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[3],
  },
  startPillText: {
    ...theme.typography.button,
    color: theme.colors.text.inverse,
  },
}));
