// @MX:NOTE: [AUTO] Intro page for transformation carousel; explains the practice goal (SPEC-MOBILE-011).
import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { colors, font, radius, spacing } from "../../../theme";

interface IntroPageProps {
  onSkip: () => void;
  onDismissForever: () => void;
}

export function IntroPage({ onSkip, onDismissForever }: IntroPageProps) {
  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollArea}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
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
          <Text style={styles.step}>4. 상황에서 영어로 말하기</Text>
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.startBtn}
          onPress={onSkip}
          activeOpacity={0.7}
        >
          <Text style={styles.startText}>시작하기</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={styles.dismissBtn}
        onPress={onDismissForever}
        activeOpacity={0.7}
      >
        <Text style={styles.dismissText}>다시 보지 않기</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollArea: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  label: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    letterSpacing: 2.5,
    color: colors.textSecondary,
  },
  title: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: colors.text,
  },
  body: {
    fontSize: font.size.sm,
    lineHeight: font.size.sm * 1.7,
    color: colors.textSecondary,
  },
  steps: {
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.bgMuted,
    borderRadius: radius.lg,
  },
  step: {
    fontSize: font.size.sm,
    color: colors.text,
    fontWeight: font.weight.medium,
    lineHeight: font.size.sm * 1.5,
  },
  footer: {
    paddingHorizontal: spacing.lg,
  },
  dismissBtn: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    paddingBottom: spacing.lg,
  },
  dismissText: {
    fontSize: font.size.sm,
    color: colors.textMuted,
  },
  startBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingVertical: 16,
    alignItems: "center",
  },
  startText: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
    letterSpacing: 0.5,
  },
});
