import React from "react";
import {
  View,
  Text,
  StyleSheet,
  ImageBackground,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { SignupForm } from "@/components/auth/SignupForm";
import { appTokens } from "../../src/theme/app-tokens";

export default function SignupScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ImageBackground
      source={require("../../assets/images/paywall-bg.png")}
      style={styles.root}
      resizeMode="cover"
    >
      {/* Gradient Dimming Layer */}
      <LinearGradient
        colors={["transparent", "rgba(0,0,0,0.4)", "rgba(0,0,0,0.88)"]}
        locations={[0, 0.4, 1]}
        style={StyleSheet.absoluteFill}
      />

      {/* Slogan - centered */}
      <View style={styles.sloganContainer}>
        <Text style={styles.slogan}>
          가장 좋은 영어 인풋을{"\n"}무제한으로, 매일 받아보세요
        </Text>
        <Text style={styles.body}>
          엄선된 테크 리더, 정재계 인사, 업계 전문가의{"\n"}표현을 따라 말하며
          체화해보세요.{"\n"}좋은 인풋이 통하는 영어 실력을 만듭니다.
        </Text>
      </View>

      {/* Auth CTAs - bottom */}
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardAvoid}
      >
        <ScrollView
          contentContainerStyle={[
            styles.ctaContainer,
            { paddingBottom: insets.bottom + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <OAuthButtons />

          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>또는</Text>
            <View style={styles.dividerLine} />
          </View>

          <SignupForm />

          <View style={styles.footer}>
            <Text style={styles.footerText}>이미 계정이 있으신가요? </Text>
            <Link href="/(auth)/login">
              <Text style={styles.footerLink}>로그인</Text>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  sloganContainer: {
    flex: 1,
    justifyContent: "flex-end",
    alignItems: "center",
    paddingHorizontal: appTokens.spacing.n24,
    paddingBottom: appTokens.spacing.n32,
  },
  slogan: {
    fontSize: appTokens.typography.n36,
    fontWeight: appTokens.typography.n800,
    color: appTokens.color.vd14f9016,
    textAlign: "center",
    lineHeight: appTokens.typography.n46,
    letterSpacing: appTokens.typography.nNeg1,
  },
  body: {
    marginTop: appTokens.spacing.n16,
    fontSize: appTokens.typography.n15,
    fontWeight: appTokens.typography.n400,
    color: appTokens.color.vf0252325,
    textAlign: "center",
    lineHeight: appTokens.typography.n24,
    letterSpacing: appTokens.typography.n0_1,
  },
  keyboardAvoid: {
    maxHeight: "68%",
  },
  ctaContainer: {
    paddingHorizontal: appTokens.spacing.n24,
    gap: appTokens.spacing.n12,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: appTokens.spacing.n12,
    marginVertical: appTokens.spacing.n4,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: appTokens.color.v43bcc076,
  },
  dividerText: {
    color: appTokens.color.v2f59e747,
    fontSize: appTokens.typography.n13,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: appTokens.spacing.n8,
  },
  footerText: {
    color: appTokens.color.v829bbf7d,
    fontSize: appTokens.typography.n14,
  },
  footerLink: {
    color: appTokens.color.v78f2335d,
    fontSize: appTokens.typography.n14,
    fontWeight: appTokens.typography.n600,
  },
});
