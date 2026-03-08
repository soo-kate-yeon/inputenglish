import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { initRevenueCat } from "@/lib/revenue-cat";
import { OfflineBanner } from "@/components/OfflineBanner";
import "react-native-url-polyfill/auto";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isInitialized, user } = useAuth();

  // Hide splash screen once auth state is resolved to prevent flash of protected content
  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  // Setup notification handler after app is mounted (avoids module-level native crash)
  useEffect(() => {
    try {
      const { setupNotificationHandler } = require("@/lib/push-notifications");
      setupNotificationHandler();
    } catch (e) {
      console.warn("[Notifications] setupNotificationHandler failed:", e);
    }
  }, []);

  // Initialize RevenueCat when user is available
  useEffect(() => {
    if (user?.id) {
      void initRevenueCat(user.id);
    }
  }, [user?.id]);

  // Handle deep links for OAuth callback (PKCE code exchange)
  useEffect(() => {
    const handleUrl = async (url: string) => {
      if (url.includes("auth/callback")) {
        const urlObj = new URL(url);
        const code = urlObj.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      }
    };

    // Handle initial URL (app opened from a deep link)
    Linking.getInitialURL().then((url) => {
      if (url) handleUrl(url);
    });

    // Handle subsequent URLs (app foregrounded via deep link)
    const subscription = Linking.addEventListener("url", ({ url }) =>
      handleUrl(url),
    );

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <>
      <OfflineBanner />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)" />
        <Stack.Screen
          name="study/[videoId]"
          options={{ headerShown: true, title: "Study" }}
        />
        <Stack.Screen
          name="listening/[videoId]"
          options={{ headerShown: true, title: "Listening" }}
        />
        <Stack.Screen
          name="shadowing/[videoId]"
          options={{ headerShown: true, title: "Shadowing" }}
        />
        <Stack.Screen
          name="paywall"
          options={{ headerShown: false, presentation: "modal" }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootLayoutNav />
      <StatusBar style="auto" />
    </AuthProvider>
  );
}
