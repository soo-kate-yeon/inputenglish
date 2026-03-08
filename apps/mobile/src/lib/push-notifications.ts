// @MX:NOTE: Expo push notification setup - token registration, handler, and deep linking
// @MX:SPEC: SPEC-MOBILE-007 - push notifications (AC-PUSH-001, 002, 003, 005)
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";
import { Platform } from "react-native";
import { router } from "expo-router";
import { supabase } from "@/lib/supabase";

export function setupNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

async function requestPermission(): Promise<boolean> {
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  if (existingStatus === "granted") return true;

  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

export async function registerForPushNotifications(): Promise<string | null> {
  const granted = await requestPermission();
  if (!granted) {
    console.warn("[PushNotifications] Permission not granted");
    return null;
  }

  // Token retrieval requires physical device
  if (!Device.isDevice) {
    console.warn("[PushNotifications] Push token requires physical device");
    return null;
  }

  if (Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
    });
  }

  const token = (await Notifications.getExpoPushTokenAsync()).data;
  return token;
}

export async function savePushToken(token: string): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const platform =
    Platform.OS === "ios"
      ? "ios"
      : Platform.OS === "android"
        ? "android"
        : "web";

  const { error } = await supabase
    .from("push_tokens")
    .upsert(
      { user_id: user.id, token, platform },
      { onConflict: "user_id,token" },
    );

  if (error) console.error("[PushNotifications] Failed to save token:", error);
}

// Register token on login and save to Supabase (AC-PUSH-001, 002)
export async function initPushNotifications(): Promise<void> {
  try {
    const token = await registerForPushNotifications();
    if (token) {
      await savePushToken(token);
    }
  } catch (e) {
    console.warn("[PushNotifications] initPushNotifications failed:", e);
  }
}

// Handle notification tap -> deep link to target screen (AC-PUSH-005)
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const data = response.notification.request.content.data as Record<
    string,
    unknown
  >;
  const screen = data?.screen as string | undefined;

  if (screen) {
    try {
      router.push(screen as Parameters<typeof router.push>[0]);
    } catch (e) {
      console.warn("[PushNotifications] Deep link failed:", screen, e);
    }
  }
}
