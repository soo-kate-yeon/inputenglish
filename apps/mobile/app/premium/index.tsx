import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router } from "expo-router";
import { ImmersiveThemeProvider, useTheme } from "@/components/ui";
import {
  fetchTodayCiSession,
  type TodayCiSessionShape,
} from "@/lib/premium-api";
import CiSessionScreen from "@/components/premium/CiSessionScreen";

/**
 * /premium — v1.3 daily CI session (reading + segments + highlight question).
 * Always rendered with the dark immersive theme, regardless of app color mode.
 */
export default function CiSessionRoute() {
  return (
    <ImmersiveThemeProvider>
      <CiSessionRouteInner />
    </ImmersiveThemeProvider>
  );
}

function CiSessionRouteInner() {
  const theme = useTheme();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<TodayCiSessionShape | null>(null);
  const [cap, setCap] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await fetchTodayCiSession();
      setSession(payload.session);
      setCap(payload.remainingQuestionCap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "세션을 불러오지 못했어요.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onClose = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)");
    }
  }, []);

  if (loading) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: theme.colors.background.canvas },
        ]}
      >
        <ActivityIndicator color={theme.colors.text.primary} />
      </View>
    );
  }

  if (error || !session) {
    return (
      <View
        style={[
          styles.center,
          { backgroundColor: theme.colors.background.canvas },
        ]}
      >
        <Text style={[styles.message, { color: theme.colors.text.primary }]}>
          {error ?? "오늘 준비된 세션이 없어요."}
        </Text>
        <Pressable
          onPress={error ? load : onClose}
          style={[
            styles.button,
            { backgroundColor: theme.colors.action.primary },
          ]}
        >
          <Text
            style={[styles.buttonText, { color: theme.colors.text.inverse }]}
          >
            {error ? "다시 시도" : "돌아가기"}
          </Text>
        </Pressable>
      </View>
    );
  }

  return (
    <CiSessionScreen
      session={session}
      remainingQuestionCap={cap}
      onClose={onClose}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    padding: 24,
  },
  message: {
    fontSize: 16,
    textAlign: "center",
  },
  button: {
    borderRadius: 999,
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
