import React from "react";
import { ActivityIndicator, SafeAreaView, View } from "react-native";
import { Redirect } from "expo-router";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme, createThemedStyles } from "@/components/ui";

const getStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
  },
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  indicator: {
    color: theme.colors.action.primary,
  },
}));

export default function AppEntryScreen() {
  const { user, learningProfile, isInitialized, isProfileLoading } = useAuth();
  const styles = getStyles(useTheme());

  if (!isInitialized || (user && isProfileLoading)) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator color={styles.indicator.color} />
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return <Redirect href="/(auth)/login" />;
  }

  if (!learningProfile?.onboarding_completed_at) {
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/(tabs)" />;
}
