import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { ActivityIndicator, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FloatingTabBar from "@/components/common/FloatingTabBar";
import MiniPlayer from "@/components/player/MiniPlayer";
import SessionSheet from "@/components/player/SessionSheet";
import {
  SessionSheetProvider,
  useSessionSheet,
} from "@/contexts/SessionSheetContext";

function MiniPlayerSlot() {
  const { session, isExpanded } = useSessionSheet();
  const insets = useSafeAreaInsets();
  if (!session || isExpanded) return null;
  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: insets.bottom + 68,
        zIndex: 10,
      }}
    >
      <MiniPlayer />
    </View>
  );
}

function TabsContent() {
  return (
    <View style={{ flex: 1 }}>
      <Tabs
        tabBar={(props) => <FloatingTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="explore" />
        <Tabs.Screen name="archive" />
        <Tabs.Screen name="profile" />
      </Tabs>
      <MiniPlayerSlot />
      <SessionSheet />
    </View>
  );
}

export default function TabLayout() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator size="small" color="#111111" />
      </View>
    );
  }

  if (!isAuthenticated) {
    return <Redirect href="/(auth)/login" />;
  }

  return (
    <SessionSheetProvider>
      <TabsContent />
    </SessionSheetProvider>
  );
}
