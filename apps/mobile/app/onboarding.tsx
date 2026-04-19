import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import type { LearningGoalMode, LearningLevelBand } from "@inputenglish/shared";
import { useAuth } from "@/contexts/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { colors, font, radius, spacing } from "@/theme";

type OnboardingStep = "level" | "goal" | "preparing";

const LEVEL_OPTIONS: Array<{ value: LearningLevelBand; label: string }> = [
  { value: "beginner", label: "거의 한마디도 못한다" },
  { value: "basic", label: "간단한 의사표현 가능" },
  { value: "conversation", label: "일상 회화 가능" },
  { value: "professional", label: "영어로 업무 소통 가능" },
];

const PRONUNCIATION_TAGS = [
  "차분한 리더 톤",
  "또렷한 발표 스타일",
  "설득력 있는 데모 말투",
  "좋아하는 인물 따라하기",
];

const EXPRESSION_TAGS = [
  "회의/업데이트",
  "발표/데모",
  "면접/자기소개",
  "설득/제안",
];

function ProgressDots({ step }: { step: OnboardingStep }) {
  const index = ["level", "goal", "preparing"].indexOf(step);

  return (
    <View style={styles.progressRow}>
      {[0, 1, 2].map((dot) => (
        <View
          key={dot}
          style={[styles.progressDot, dot <= index && styles.progressDotActive]}
        />
      ))}
    </View>
  );
}

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionButton,
        selected && styles.optionButtonSelected,
        pressed && styles.optionButtonPressed,
      ]}
    >
      <Text
        style={[styles.optionLabel, selected && styles.optionLabelSelected]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { user, learningProfile, isProfileLoading, updateLearningProfile } =
    useAuth();
  const isEditMode = edit === "1";
  const [step, setStep] = useState<OnboardingStep>("level");
  const [level, setLevel] = useState<LearningLevelBand | null>(null);
  const [goalMode, setGoalMode] = useState<LearningGoalMode | null>(null);
  const [focusTags, setFocusTags] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    trackEvent("onboarding_start", {
      source: isEditMode ? "settings" : "auth",
    });
  }, [isEditMode]);

  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/login");
      return;
    }

    if (!learningProfile) return;

    setLevel(learningProfile.level_band);
    setGoalMode(learningProfile.goal_mode);

    if (learningProfile.goal_mode === "pronunciation") {
      setFocusTags(
        learningProfile.preferred_speakers.length > 0
          ? learningProfile.preferred_speakers
          : learningProfile.focus_tags,
      );
    } else if (learningProfile.goal_mode === "expression") {
      setFocusTags(
        learningProfile.preferred_situations.length > 0
          ? learningProfile.preferred_situations
          : learningProfile.focus_tags,
      );
    }
  }, [learningProfile, user]);

  const availableTags = useMemo(
    () => (goalMode === "pronunciation" ? PRONUNCIATION_TAGS : EXPRESSION_TAGS),
    [goalMode],
  );

  const canSubmit = Boolean(level && goalMode && focusTags.length > 0);

  const toggleFocusTag = (tag: string) => {
    setFocusTags((current) =>
      current.includes(tag)
        ? current.filter((item) => item !== tag)
        : [...current, tag],
    );
  };

  const handleComplete = async () => {
    if (!user || !goalMode || !level || focusTags.length === 0) return;

    setStep("preparing");
    setIsSaving(true);

    try {
      trackEvent("onboarding_level_selected", { levelBand: level });
      trackEvent("onboarding_goal_selected", { goalMode, focusTags });

      await updateLearningProfile({
        level_band: level,
        goal_mode: goalMode,
        focus_tags: focusTags,
        preferred_speakers: goalMode === "pronunciation" ? focusTags : [],
        preferred_situations: goalMode === "expression" ? focusTags : [],
        onboarding_completed_at: new Date().toISOString(),
      });

      trackEvent("onboarding_complete", {
        goalMode,
        levelBand: level,
        source: isEditMode ? "settings" : "auth",
      });

      router.replace("/(tabs)");
    } catch (error) {
      console.error("[Onboarding] Failed to save learning profile:", error);
      setStep("goal");
    } finally {
      setIsSaving(false);
    }
  };

  if (isProfileLoading && !learningProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredState}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ProgressDots step={step} />

        {step === "level" ? (
          <View style={styles.stepBlock}>
            <Text style={styles.eyebrow}>1 / 2</Text>
            <Text style={styles.title}>지금 어느 정도로 말할 수 있나요?</Text>
            <View style={styles.optionList}>
              {LEVEL_OPTIONS.map((option) => (
                <OptionButton
                  key={option.value}
                  label={option.label}
                  selected={level === option.value}
                  onPress={() => setLevel(option.value)}
                />
              ))}
            </View>
            <Pressable
              accessibilityLabel="학습 수준 다음 단계"
              style={[
                styles.primaryButton,
                !level && styles.primaryButtonDisabled,
              ]}
              onPress={() => level && setStep("goal")}
              disabled={!level}
            >
              <Text style={styles.primaryButtonText}>다음</Text>
            </Pressable>
          </View>
        ) : null}

        {step === "goal" ? (
          <View style={styles.stepBlock}>
            <Text style={styles.eyebrow}>2 / 2</Text>
            <Text style={styles.title}>어떤 영어를 먼저 훔치고 싶나요?</Text>
            <View style={styles.modeRow}>
              <OptionButton
                label="발음/억양 훔치기"
                selected={goalMode === "pronunciation"}
                onPress={() => {
                  setGoalMode("pronunciation");
                  setFocusTags([]);
                }}
              />
              <OptionButton
                label="표현 훔치기"
                selected={goalMode === "expression"}
                onPress={() => {
                  setGoalMode("expression");
                  setFocusTags([]);
                }}
              />
            </View>

            {goalMode ? (
              <View style={styles.focusSection}>
                <Text style={styles.focusTitle}>
                  {goalMode === "pronunciation"
                    ? "원하는 말하기 스타일이나 인물을 골라주세요"
                    : "더 많이 쓰고 싶은 상황이나 주제를 골라주세요"}
                </Text>
                <View style={styles.chipWrap}>
                  {availableTags.map((tag) => (
                    <Pressable
                      key={tag}
                      onPress={() => toggleFocusTag(tag)}
                      style={[
                        styles.chip,
                        focusTags.includes(tag) && styles.chipSelected,
                      ]}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          focusTags.includes(tag) && styles.chipTextSelected,
                        ]}
                      >
                        {tag}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}

            <Pressable
              accessibilityLabel="온보딩 완료하기"
              style={[
                styles.primaryButton,
                (!canSubmit || isSaving) && styles.primaryButtonDisabled,
              ]}
              onPress={handleComplete}
              disabled={!canSubmit || isSaving}
            >
              <Text style={styles.primaryButtonText}>
                {isEditMode ? "저장하기" : "완료하기"}
              </Text>
            </Pressable>
          </View>
        ) : null}

        {step === "preparing" ? (
          <View style={styles.stepBlock}>
            <Text style={styles.eyebrow}>3 / 3</Text>
            <Text style={styles.title}>
              학습 목표에 맞게 피드를 재구성하는 중이에요
            </Text>
            <Text style={styles.body}>
              선택한 목표를 바탕으로 오늘부터 바로 따라 말할 수 있는 학습 흐름을
              준비하고 있어요.
            </Text>
            <ActivityIndicator color={colors.primary} style={styles.loader} />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  progressRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  progressDot: {
    flex: 1,
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.border,
  },
  progressDotActive: {
    backgroundColor: colors.primary,
  },
  stepBlock: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  eyebrow: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    marginBottom: spacing.sm,
  },
  title: {
    fontSize: font.size["2xl"],
    fontWeight: font.weight.bold,
    color: colors.text,
    lineHeight: 38,
    marginBottom: spacing.md,
  },
  body: {
    fontSize: font.size.md,
    color: colors.textSecondary,
    lineHeight: 24,
    marginBottom: spacing.md,
  },
  optionList: {
    gap: spacing.sm,
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  modeRow: {
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  optionButton: {
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  optionButtonSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionButtonPressed: {
    opacity: 0.92,
  },
  optionLabel: {
    fontSize: font.size.base,
    color: colors.text,
    fontWeight: font.weight.medium,
  },
  optionLabelSelected: {
    color: colors.textInverse,
  },
  focusSection: {
    marginBottom: spacing.xl,
  },
  focusTitle: {
    fontSize: font.size.md,
    color: colors.text,
    fontWeight: font.weight.semibold,
    marginBottom: spacing.sm,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bgSubtle,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    fontSize: font.size.sm,
    color: colors.text,
  },
  chipTextSelected: {
    color: colors.textInverse,
  },
  primaryButton: {
    marginTop: "auto",
    backgroundColor: colors.primary,
    borderRadius: radius.xl,
    paddingVertical: spacing.md,
    alignItems: "center",
  },
  primaryButtonDisabled: {
    opacity: 0.35,
  },
  primaryButtonText: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
  },
  loader: {
    marginTop: spacing.lg,
  },
});
