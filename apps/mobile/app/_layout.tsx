import { useEffect } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import * as Linking from "expo-linking";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";
import { initRevenueCat } from "@/lib/revenue-cat";
import { OfflineBanner } from "@/components/OfflineBanner";
import "react-native-url-polyfill/auto";
import * as Notifications from "expo-notifications";

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { isInitialized, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  // Hide splash screen once auth state is resolved to prevent flash of protected content
  useEffect(() => {
    if (isInitialized) {
      SplashScreen.hideAsync();
    }
  }, [isInitialized]);

  // Declarative auth-based navigation. Runs after React commits state,
  // preventing the race condition where router.replace fires before
  // isAuthenticated updates in TabLayout (which would redirect back to login).
  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (user && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [user, isInitialized, segments, router]);

  // Setup notification handler after app is mounted (avoids module-level native crash)
  useEffect(() => {
    try {
      const { setupNotificationHandler } = require("@/lib/push-notifications");
      setupNotificationHandler();
    } catch (e) {
      console.warn("[Notifications] setupNotificationHandler failed:", e);
    }
  }, []);

  // Register push token when user logs in (AC-PUSH-001, 002)
  useEffect(() => {
    if (!user?.id) return;
    const { initPushNotifications } = require("@/lib/push-notifications");
    void initPushNotifications();
  }, [user?.id]);

  // Handle notification tap for deep linking (AC-PUSH-005)
  useEffect(() => {
    const { handleNotificationResponse } = require("@/lib/push-notifications");
    const sub = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );
    return () => sub.remove();
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
          options={{
            headerShown: false,
            gestureEnabled: true,
          }}
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
