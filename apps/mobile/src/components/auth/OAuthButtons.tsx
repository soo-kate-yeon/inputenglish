// @MX:NOTE: [AUTO] OAuth flow uses expo-web-browser + expo-auth-session with PKCE.
// skipBrowserRedirect: true required so we control the redirect via WebBrowser.openAuthSessionAsync.
// Apple Sign-In uses native expo-apple-authentication + Supabase signInWithIdToken.
import React, { useState } from "react";
import {
  Alert,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Image,
  Platform,
} from "react-native";
import * as WebBrowser from "expo-web-browser";
import * as AuthSession from "expo-auth-session";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { mapAuthError } from "@/lib/auth-errors";

const googleGIcon = require("../../../assets/auth/google_g.png");
const kakaoSymbol = require("../../../assets/auth/kakao_symbol.png");

WebBrowser.maybeCompleteAuthSession();

type Provider = "google" | "kakao";

export function OAuthButtons() {
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null);
  const [appleLoading, setAppleLoading] = useState(false);
  const { signInWithApple } = useAuth();

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

      if (result.type === "success") {
        const url = new URL(result.url);
        const code = url.searchParams.get("code");
        if (code) {
          await supabase.auth.exchangeCodeForSession(code);
        }
      }
    } catch (err) {
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
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Text style={styles.appleLogo}>{"\uF8FF"}</Text>
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
          <ActivityIndicator color="#1F1F1F" />
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
          <ActivityIndicator color="#191919" />
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

const styles = StyleSheet.create({
  container: {
    width: "100%",
    gap: 10,
  },
  // Apple branding: black fill, white text, SF Pro
  appleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    borderRadius: 4,
    backgroundColor: "#000000",
    paddingHorizontal: 12,
  },
  appleLogo: {
    fontSize: 16,
    color: "#FFFFFF",
    marginRight: 10,
  },
  appleText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.25,
  },
  // Google branding: white fill, #747775 1px stroke, r=4, h=40
  // Ref: .gsi-material-button CSS spec
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
  },
  googleIcon: {
    width: 20,
    height: 20,
    marginRight: 10,
  },
  googleText: {
    color: "#1F1F1F",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.25,
  },
  // Kakao branding: #FEE500 fill, same layout as Google
  kakaoButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    height: 40,
    borderRadius: 4,
    backgroundColor: "#FEE500",
    paddingHorizontal: 12,
  },
  kakaoIcon: {
    width: 18,
    height: 18,
    marginRight: 10,
  },
  kakaoText: {
    color: "#191919",
    fontSize: 14,
    fontWeight: "500",
    letterSpacing: 0.25,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
