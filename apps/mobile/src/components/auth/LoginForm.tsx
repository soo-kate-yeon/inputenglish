import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";

export function LoginForm() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignIn = async () => {
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);
      await signIn(email, password);
      // Auth state change in AuthContext handles navigation redirect
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Sign in failed. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <TextInput
        style={styles.input}
        placeholder="이메일"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        textContentType="emailAddress"
        editable={!isSubmitting}
      />

      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="password"
        editable={!isSubmitting}
      />

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>로그인</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 12,
  },
  errorBox: {
    backgroundColor: "rgba(255,59,48,0.15)",
    borderWidth: 1,
    borderColor: "rgba(255,59,48,0.4)",
    borderRadius: 8,
    padding: 12,
  },
  errorText: {
    color: "#FF6B6B",
    fontSize: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: "rgba(255,255,255,0.1)",
    color: "#FFFFFF",
  },
  button: {
    backgroundColor: "rgba(255,255,255,0.9)",
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#1A1A14",
    fontSize: 16,
    fontWeight: "600",
  },
});
