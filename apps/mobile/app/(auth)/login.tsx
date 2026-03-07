import { View, Text, StyleSheet, ScrollView } from "react-native";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default function LoginScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Shadowoo</Text>
      <Text style={styles.subtitle}>소셜 계정으로 로그인하세요</Text>
      <OAuthButtons />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: "center",
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
    textAlign: "center",
  },
});
