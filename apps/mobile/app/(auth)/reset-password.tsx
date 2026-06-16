import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "@/contexts/AuthContext";
import { mapAuthError } from "@/lib/auth-errors";
import { useTheme, createThemedStyles } from "@/components/ui";

const getStyles = createThemedStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
  },
  flex: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: theme.spacing[6],
    gap: theme.spacing[3],
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text.primary,
  },
  subtitle: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[2],
  },
  errorBox: {
    backgroundColor: theme.colors.surface.danger,
    borderWidth: 1,
    borderColor: theme.colors.border.danger,
    borderRadius: theme.radius.md,
    padding: theme.spacing[3],
  },
  errorText: {
    ...theme.typography.label,
    color: theme.colors.text.danger,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 14,
    ...theme.typography.body,
    backgroundColor: theme.colors.surface.muted,
    color: theme.colors.text.primary,
  },
  button: {
    backgroundColor: theme.colors.action.primary,
    borderRadius: theme.radius.lg,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: theme.spacing[1],
  },
  buttonDisabled: {
    backgroundColor: theme.colors.action.primaryDisabled,
  },
  buttonText: {
    ...theme.typography.button,
    color: theme.colors.text.inverse,
  },
  placeholderColor: {
    color: theme.colors.text.tertiary,
  },
  activityColor: {
    color: theme.colors.text.inverse,
  },
}));

export default function ResetPasswordScreen() {
  const { updatePassword } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const styles = getStyles(useTheme());

  const handleSubmit = async () => {
    setError(null);

    if (!password || !confirmPassword) {
      setError("새 비밀번호를 입력해주세요.");
      return;
    }
    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }
    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    try {
      setIsSubmitting(true);
      // On success, AuthContext clears isPasswordRecovery and the root
      // navigation guard routes the user into the app.
      await updatePassword(password);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
        <View style={styles.container}>
          <Text style={styles.title}>새 비밀번호 설정</Text>
          <Text style={styles.subtitle}>
            로그인에 사용할 새 비밀번호를 입력해주세요.
          </Text>

          {error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <TextInput
            style={styles.input}
            placeholder="새 비밀번호"
            placeholderTextColor={styles.placeholderColor.color}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            textContentType="newPassword"
            editable={!isSubmitting}
          />
          <TextInput
            style={styles.input}
            placeholder="새 비밀번호 확인"
            placeholderTextColor={styles.placeholderColor.color}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            secureTextEntry
            textContentType="newPassword"
            editable={!isSubmitting}
          />

          <TouchableOpacity
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator color={styles.activityColor.color} />
            ) : (
              <Text style={styles.buttonText}>비밀번호 변경</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
