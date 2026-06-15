import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { PremiumSession } from "@inputenglish/shared";
import PremiumSessionScreen from "@/components/premium/PremiumSessionScreen";
import { fetchPremiumSessionById } from "@/lib/premium-api";
import { colors, font, leading, radius, spacing } from "@/theme";

export default function PremiumSessionRoute() {
  const params = useLocalSearchParams<{ sessionId?: string }>();
  const [session, setSession] = useState<PremiumSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!params.sessionId) {
        setError("세션 ID가 없어요.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const payload = await fetchPremiumSessionById(params.sessionId);
        if (!cancelled) {
          if (payload.session) {
            setSession(payload.session);
          } else {
            router.replace("/paywall");
          }
        }
      } catch (nextError) {
        if (!cancelled) {
          setError(
            nextError instanceof Error
              ? nextError.message
              : "세션을 불러오지 못했어요.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [params.sessionId]);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.textPremium} />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>세션을 열 수 없어요</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.button} onPress={() => router.back()}>
          <Text style={styles.buttonText}>돌아가기</Text>
        </Pressable>
      </View>
    );
  }

  return <PremiumSessionScreen session={session} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
    backgroundColor: colors.bgDark,
    padding: spacing.lg,
  },
  errorTitle: {
    color: colors.textPremium,
    fontSize: font.size.xl,
    lineHeight: leading(font.size.xl, font.lineHeight.tight),
    fontWeight: font.weight.bold,
  },
  errorText: {
    color: colors.textPremiumSecondary,
    textAlign: "center",
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
  },
  button: {
    borderRadius: radius.pill,
    backgroundColor: colors.bgPremiumControl,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  buttonText: {
    color: colors.textPremium,
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
  },
});
