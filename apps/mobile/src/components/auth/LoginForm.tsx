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
import { mapAuthError } from "@/lib/auth-errors";
import { colors, font, radius, spacing } from "@/theme";

export function LoginForm() {
  const { signIn, sendPasswordResetEmail, resendConfirmationEmail } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [needsConfirm, setNeedsConfirm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHelping, setIsHelping] = useState(false);

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
        placeholderTextColor={colors.textMuted}
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
        placeholderTextColor={colors.textMuted}
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
          <ActivityIndicator color={colors.textInverse} />
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

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: spacing.sm + 4,
  },
  errorBox: {
    backgroundColor: colors.errorBg,
    borderWidth: 1,
    borderColor: colors.error,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
  },
  errorText: {
    color: colors.error,
    fontSize: font.size.sm,
  },
  infoBox: {
    backgroundColor: colors.successBg,
    borderWidth: 1,
    borderColor: colors.success,
    borderRadius: radius.md,
    padding: spacing.sm + 4,
  },
  infoText: {
    color: colors.success,
    fontSize: font.size.sm,
  },
  linkText: {
    color: colors.primary,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    textAlign: "center",
  },
  input: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    fontSize: font.size.md,
    backgroundColor: colors.bgSubtle,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.bgInverse,
    borderRadius: radius.md,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: colors.textInverse,
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
  },
  forgotRow: {
    alignItems: "center",
    paddingVertical: 4,
  },
  forgotText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
  },
});
