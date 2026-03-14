import { Redirect, Tabs } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { ActivityIndicator, View } from "react-native";
import FloatingTabBar from "@/components/common/FloatingTabBar";

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
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" />
      <Tabs.Screen name="archive" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
