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
  infoBox: {
    backgroundColor: theme.colors.surface.muted,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    borderRadius: theme.radius.md,
    padding: theme.spacing[3],
  },
  infoText: {
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
  forgotRow: {
    alignItems: "center",
    paddingVertical: theme.spacing[1],
  },
  forgotText: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
  },
  placeholderColor: {
    color: theme.colors.text.tertiary,
  },
  activityColor: {
    color: theme.colors.text.inverse,
  },
}));

export function LoginForm() {
  const { signIn, sendPasswordResetEmail, resendConfirmationEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHelping, setIsHelping] = useState(false);
  const styles = getStyles(useTheme());

  const handleSignIn = async () => {
    setInfo(null);
    setNeedsConfirm(false);
    if (!email || !password) {
      setError("이메일과 비밀번호를 입력해주세요.");
      return;
    }

    try {
      setError(null);
      setIsSubmitting(true);
      await signIn(email, password);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (raw.includes("Email not confirmed")) {
        setNeedsConfirm(true);
      }
      setError(mapAuthError(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("비밀번호를 재설정할 이메일을 먼저 입력해주세요.");
      return;
    }
    try {
      setIsHelping(true);
      await sendPasswordResetEmail(email);
      setInfo("비밀번호 재설정 메일을 보냈습니다. 이메일을 확인해주세요.");
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsHelping(false);
    }
  };

  const handleResendConfirmation = async () => {
    setError(null);
    setInfo(null);
    if (!email) {
      setError("인증 메일을 받을 이메일을 먼저 입력해주세요.");
      return;
    }
    try {
      setIsHelping(true);
      await resendConfirmationEmail(email);
      setInfo("인증 메일을 다시 보냈습니다. 이메일을 확인해주세요.");
      setNeedsConfirm(false);
    } catch (err) {
      setError(mapAuthError(err));
    } finally {
      setIsHelping(false);
    }
  };

  return (
    <View style={styles.container}>
      {error && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {info && (
        <View style={styles.infoBox}>
          <Text style={styles.infoText}>{info}</Text>
        </View>
      )}

      {needsConfirm && (
        <TouchableOpacity
          onPress={handleResendConfirmation}
          disabled={isHelping}
        >
          <Text style={styles.linkText}>인증 메일 다시 보내기</Text>
        </TouchableOpacity>
      )}

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
        textContentType="password"
        editable={!isSubmitting}
      />

      <TouchableOpacity
        style={[styles.button, isSubmitting && styles.buttonDisabled]}
        onPress={handleSignIn}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <ActivityIndicator color={styles.activityColor.color} />
        ) : (
          <Text style={styles.buttonText}>로그인</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.forgotRow}
        onPress={handleForgotPassword}
        disabled={isHelping}
      >
        <Text style={styles.forgotText}>비밀번호를 잊으셨나요?</Text>
      </TouchableOpacity>
    </View>
  );
}
