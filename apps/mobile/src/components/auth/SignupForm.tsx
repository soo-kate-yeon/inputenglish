import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
} from "react-native";
import { useAuth } from "@/contexts/AuthContext";
import { mapAuthError } from "@/lib/auth-errors";
import { useTheme, createThemedStyles } from "@/components/ui";

const getStyles = createThemedStyles((theme) => ({
  container: {
    width: "100%",
    gap: theme.spacing[3],
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
  successBox: {
    backgroundColor: theme.colors.surface.muted,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.md,
    padding: theme.spacing[3],
  },
  successText: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
  },
  linkText: {
    ...theme.typography.label,
    color: theme.colors.action.primary,
    fontWeight: "600",
    textAlign: "center",
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

export function SignupForm() {
  const { signUp, resendConfirmationEmail } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const styles = getStyles(useTheme());

  const handleResendConfirmation = async () => {
    setError(null);
    try {
      await resendConfirmationEmail(email);
      setSuccess("인증 메일을 다시 보냈습니다. 이메일을 확인해주세요.");
    } catch (err) {
      setError(mapAuthError(err));
    }
  };

  const handleSignUp = async () => {
    setError(null);
    setSuccess(null);

    if (!fullName || !email || !password || !confirmPassword) {
      setError("모든 항목을 입력해주세요.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    try {
      setIsSubmitting(true);
      const { needsEmailConfirmation } = await signUp(
        email,
        password,
        fullName,
      );

      if (needsEmailConfirmation) {
        setSuccess("인증 메일을 발송했습니다. 이메일을 확인해주세요.");
        setNeedsConfirm(true);
      }
      // If no email confirmation needed, navigation is handled by _layout.tsx
    } catch (err) {
      setError(mapAuthError(err));
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

      {success && (
        <View style={styles.successBox}>
          <Text style={styles.successText}>{success}</Text>
        </View>
      )}

      {needsConfirm && (
        <TouchableOpacity onPress={handleResendConfirmation}>
          <Text style={styles.linkText}>인증 메일 다시 보내기</Text>
        </TouchableOpacity>
      )}

      <TextInput
        style={styles.input}
        placeholder="이름"
        placeholderTextColor={styles.placeholderColor.color}
        value={fullName}
        onChangeText={setFullName}
        autoCapitalize="words"
        textContentType="name"
        editable={!isSubmitting}
      />

      <TextInput
        style={styles.input}
        placeholder="이메일"
        placeholderTextColor={styles.placeholderColor.color}
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
        placeholderTextColor={styles.placeholderColor.color}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        textContentType="newPassword"
        editable={!isSubmitting}
      />

      <TextInput
        style={styles.input}
        placeholder="비밀번호 확인"
        placeholderTextColor={styles.placeholderColor.color}
        value={confirmPassword}
        onChangeText={setConfirmPassword}
        secureTextEntry
        textContentType="newPassword"
        editable={!isSubmitting}
      />

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSignUp}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={styles.activityColor.color} />
        ) : (
          <Text style={styles.buttonText}>가입하기</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}
