import React, { useState } from "react";
import { View, Text, StyleSheet, ImageBackground } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { OAuthButtons } from "@/components/auth/OAuthButtons";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ImageBackground
      source={require("../../assets/images/login-bg.png")}
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
        <Text style={styles.slogan}>리더들의 영어를,{"\n"}당신의 영어로</Text>
        <Text style={styles.body}>
          엄선된 테크 리더, 정재계 인사, 업계 전문가의{"\n"}표현을 따라 말하며
          체화해보세요.{"\n"}좋은 인풋이 통하는 영어 실력을 만듭니다.
        </Text>
      </View>

      {/* Auth CTAs - bottom */}
      <View
        style={[styles.ctaContainer, { paddingBottom: insets.bottom + 24 }]}
      >
        <OAuthButtons />

        <View style={styles.footer}>
          <Text style={styles.footerText}>계정이 없으신가요? </Text>
          <Link href="/(auth)/signup">
            <Text style={styles.footerLink}>회원가입</Text>
          </Link>
        </View>
      </View>
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
    paddingHorizontal: 24,
    paddingBottom: 48,
  },
  slogan: {
    fontSize: 40,
    fontWeight: "800",
    color: "#fff",
    textAlign: "center",
    lineHeight: 52,
    letterSpacing: -1.2,
  },
  body: {
    marginTop: 16,
    fontSize: 15,
    fontWeight: "400",
    color: "rgba(255,255,255,0.65)",
    textAlign: "center",
    lineHeight: 24,
    letterSpacing: 0.1,
  },
  ctaContainer: {
    paddingHorizontal: 24,
    gap: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 8,
  },
  footerText: {
    color: "rgba(255,255,255,0.5)",
    fontSize: 14,
  },
  footerLink: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "600",
  },
});
