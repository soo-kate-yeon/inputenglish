// @MX:NOTE: [AUTO] OAuth flow uses expo-web-browser + expo-auth-session with PKCE.
// skipBrowserRedirect: true required so we control the redirect via WebBrowser.openAuthSessionAsync.
// Apple Sign-In uses native expo-apple-authentication + Supabase signInWithIdToken.
import React, { useState } from "react";
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { mapAuthError } from "@/lib/auth-errors";
import { useTheme, createThemedStyles } from "@/components/ui";

const googleGIcon = require("../../../assets/auth/google_g.png");
const kakaoSymbol = require("../../../assets/auth/kakao_symbol.png");

// Kakao brand colors: required by Kakao developer branding guidelines
const KAKAO_YELLOW = "#FEE500";
const KAKAO_TEXT = "#191919";

WebBrowser.maybeCompleteAuthSession();

type Provider = "google" | "kakao";

const getStyles = createThemedStyles((theme) => ({
  container: {
    width: "100%",
    gap: theme.spacing[2],
  },
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.action.primary,
    paddingHorizontal: theme.spacing[4],
  },
  appleLogo: {
    ...theme.typography.body,
    color: theme.colors.text.inverse,
    marginRight: 10,
  },
  appleText: {
    ...theme.typography.button,
    color: theme.colors.text.inverse,
    letterSpacing: 0.25,
  },
  // Google only: outline style on light surface
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.background.canvas,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    paddingHorizontal: theme.spacing[4],
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleText: {
    ...theme.typography.button,
    color: theme.colors.text.primary,
    letterSpacing: 0.25,
  },
  kakaoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
    borderRadius: theme.radius.md,
    backgroundColor: KAKAO_YELLOW,
    paddingHorizontal: theme.spacing[4],
  },
  kakaoIcon: {
    width: 18,
    height: 18,
    marginRight: 10,
  },
  kakaoText: {
    ...theme.typography.button,
    color: KAKAO_TEXT,
    letterSpacing: 0.25,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  activityInverse: {
    color: theme.colors.text.inverse,
  },
}));

export function OAuthButtons() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [appleLoading, setAppleLoading] = useState(false);
  const { completeOAuthCodeExchange, signInWithApple } = useAuth();
  const styles = getStyles(useTheme());

  const handleOAuthSignIn = async (provider: Provider) => {
    try {
      setLoadingProvider(provider);

      const redirectTo = AuthSession.makeRedirectUri({
        scheme: "inputenglish",
        path: "auth/callback",
      });

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo,
          skipBrowserRedirect: true,
        },
      });

      if (error) throw error;
      if (!data.url) throw new Error("No OAuth URL returned from Supabase");

      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo,
      );

      if (result.type === "success" && result.url) {
        const url = new URL(result.url);
        const errParam =
          url.searchParams.get("error_description") ??
          url.searchParams.get("error");
        if (errParam) {
          throw new Error(`OAuth provider returned an error: ${errParam}`);
        }
        const code = url.searchParams.get("code");
        if (code) {
          await completeOAuthCodeExchange(code);
          return;
        }
        // Returned to the app scheme but without a code — usually means the
        // Supabase Redirect URL allowlist is missing `inputenglish://auth/callback`,
        // so the OAuth callback fell back to the Site URL.
        console.warn(
          `[OAuthButtons] ${provider} callback had no code: ${result.url}`,
        );
      } else if (result.type !== "success") {
        // dismiss / cancel — the auth browser closed before returning to the app
        // scheme (the "bounce"). Most often a redirect-URL misconfiguration.
        console.warn(
          `[OAuthButtons] ${provider} auth session did not complete: ${result.type}`,
        );
      }
    } catch (err: unknown) {
      // The code exchange is de-duped in AuthContext, so a thrown error here is
      // real — but the deep-link listener may have completed sign-in on another
      // path. Treat an existing session as success; otherwise surface the error
      // (previously a "Code verifier" error was silently swallowed, leaving the
      // user stuck on the login screen with no feedback).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) return;

      console.error(`[OAuthButtons] ${provider} sign in failed:`, err);
      Alert.alert("로그인 오류", mapAuthError(err));
    } finally {
      setLoadingProvider(null);
    }
  };

  const handleAppleSignIn = async () => {
    try {
      setAppleLoading(true);
      await signInWithApple();
    } catch (err) {
      console.error("[OAuthButtons] Apple sign in failed:", err);
      Alert.alert("로그인 오류", mapAuthError(err));
    } finally {
      setAppleLoading(false);
    }
  };

  const isDisabled = loadingProvider !== null || appleLoading;

  return (
    <View style={styles.container}>
      {/* Apple: Native Sign in with Apple button (iOS only) */}
      {Platform.OS === "ios" && (
        <TouchableOpacity
          style={[styles.appleButton, isDisabled && styles.buttonDisabled]}
          onPress={handleAppleSignIn}
          disabled={isDisabled}
          accessibilityLabel="Apple로 로그인"
        >
          {appleLoading ? (
            <ActivityIndicator color={styles.activityInverse.color} />
          ) : (
            <>
              <Text style={styles.appleLogo}>{""}</Text>
              <Text style={styles.appleText}>Apple로 계속하기</Text>
            </>
          )}
        </TouchableOpacity>
      )}

      {/* Google: Custom button following branding guidelines */}
      {/* https://developers.google.com/identity/branding-guidelines */}
      {/* iOS spec: 16px left, 12px after logo, 16px right, Roboto Medium 14/20, #FFFFFF fill, #747775 stroke */}
      <TouchableOpacity
        style={[styles.googleButton, isDisabled && styles.buttonDisabled]}
        onPress={() => handleOAuthSignIn("google")}
        disabled={isDisabled}
        accessibilityLabel="Google로 로그인"
      >
        {loadingProvider === "google" ? (
          <ActivityIndicator color={styles.googleText.color} />
        ) : (
          <>
            <Image source={googleGIcon} style={styles.googleIcon} />
            <Text style={styles.googleText}>Google로 계속하기</Text>
          </>
        )}
      </TouchableOpacity>

      {/* Kakao: icon + text, matching Google layout */}
      <TouchableOpacity
        style={[styles.kakaoButton, isDisabled && styles.buttonDisabled]}
        onPress={() => handleOAuthSignIn("kakao")}
        disabled={isDisabled}
        accessibilityLabel="카카오 로그인"
      >
        {loadingProvider === "kakao" ? (
          <ActivityIndicator color={KAKAO_TEXT} />
        ) : (
          <>
            <Image source={kakaoSymbol} style={styles.kakaoIcon} />
            <Text style={styles.kakaoText}>카카오 로그인</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}
