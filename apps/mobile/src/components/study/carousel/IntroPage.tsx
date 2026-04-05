// @MX:NOTE: [AUTO] Intro page for transformation carousel; explains the practice goal (SPEC-MOBILE-011).
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, font, radius, spacing } from "../../../theme";

interface IntroPageProps {
  onSkip: () => void;
  onDismissForever: () => void;
}

export function IntroPage({ onSkip, onDismissForever }: IntroPageProps) {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>TRANSFORMATION PRACTICE</Text>
        <Text style={styles.title}>변형 연습이란?</Text>
        <Text style={styles.body}>
          단어나 구조를 바꿔 가며 같은 패턴을 여러 상황에 적용해 보는
          연습이에요.
          {"\n\n"}
          녹음으로 직접 말해보고, 실제 업무 상황에서 자연스럽게 쓸 수 있도록
          만들어진 훈련입니다.
        </Text>
        <View style={styles.steps}>
          <Text style={styles.step}>1. 한국어 문장을 영어로 말해보기</Text>
          <Text style={styles.step}>2. 질문에 영어로 답변하기</Text>
          <Text style={styles.step}>3. 대화 완성하기</Text>
        </View>
      </View>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.dismissBtn}
          onPress={onDismissForever}
          activeOpacity={0.7}
        >
          <Text style={styles.dismissText}>다시 보지 않기</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={onSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.startText}>시작하기</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  label: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    letterSpacing: 2,
    color: colors.textMuted,
  },
  title: {
    fontSize: font.size["2xl"],
    fontWeight: font.weight.bold,
    color: colors.text,
  },
  body: {
    fontSize: font.size.md,
    lineHeight: font.size.md * 1.6,
    color: colors.textSecondary,
  },
  steps: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  step: {
    fontSize: font.size.md,
    color: colors.text,
    fontWeight: font.weight.medium,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  dismissBtn: {
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  dismissText: {
    fontSize: font.size.sm,
    color: colors.textMuted,
  },
  startBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 14,
    alignItems: "center",
  },
  startText: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
  },
});
