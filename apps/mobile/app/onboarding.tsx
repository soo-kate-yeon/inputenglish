import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Animated,
  Easing,
  ImageSourcePropType,
  ImageBackground,
  LayoutAnimation,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  useWindowDimensions,
  View,
} from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SPEAKING_SITUATIONS, VIDEO_CATEGORIES } from "@inputenglish/shared";
import type {
  LearningGoalMode,
  LearningLevelBand,
  SpeakingSituation,
  VideoCategory,
} from "@inputenglish/shared";
import { useAuth } from "@/contexts/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { colors, font, radius, spacing } from "@/theme";

type OnboardingStep = "level" | "goal" | "details" | "preparing";
// @MX:NOTE: Speaking/pronunciation is feature-gated on main until the
//           Azure + ffmpeg pipeline on feature/speaking-stability is
//           stable. The "goal" step is dropped because "expression" is
//           the only selectable goal_mode right now; re-insert it here
//           when speaking returns.
const STEP_SEQUENCE: OnboardingStep[] = ["level", "details", "preparing"];

const LEVEL_OPTIONS: Array<{ value: LearningLevelBand; label: string }> = [
  { value: "beginner", label: "거의 한 마디도 못해요" },
  { value: "basic", label: "간단한 의사표현 정도만 가능해요" },
  { value: "conversation", label: "일상 회화는 가능해요" },
  { value: "professional", label: "영어로 업무 소통이나 논의까지 가능해요" },
];

const PRONUNCIATION_PEOPLE = [
  {
    name: "Michelle Obama",
    trait: "차분하고 또렷한 리더형 리듬",
    imageSource: require("../assets/images/speakers/person_1.png"),
  },
  {
    name: "Oprah",
    trait: "따뜻하고 밀도 있는 저음 톤",
    imageSource: require("../assets/images/speakers/person_2.png"),
  },
  {
    name: "Taylor Swift",
    trait: "부드럽고 선명한 미국식 딕션",
    imageSource: require("../assets/images/speakers/person_3.png"),
  },
  {
    name: "Zendaya",
    trait: "가볍고 세련된 대화체 억양",
    imageSource: require("../assets/images/speakers/person_4.png"),
  },
  {
    name: "Emma Watson",
    trait: "정갈한 영국식 발음과 호흡",
    imageSource: require("../assets/images/speakers/person_5.png"),
  },
  {
    name: "Jennie",
    trait: "짧고 감각적인 글로벌 톤",
    imageSource: require("../assets/images/speakers/person_6.png"),
  },
  {
    name: "Ryan Reynolds",
    trait: "위트 있게 튀는 북미식 리듬",
    imageSource: require("../assets/images/speakers/person_7.png"),
  },
  {
    name: "Matt Damon",
    trait: "담백하고 안정적인 표준 억양",
    imageSource: require("../assets/images/speakers/person_8.png"),
  },
  {
    name: "Jensen Huang",
    trait: "명확하고 에너지 있는 발표 톤",
    imageSource: require("../assets/images/speakers/person_9.png"),
  },
  {
    name: "Simon Sinek",
    trait: "단단하고 설득력 있는 강연 호흡",
    imageSource: require("../assets/images/speakers/person_10.png"),
  },
  {
    name: "Conan O’Brien",
    trait: "리듬감 있고 장난기 있는 억양",
    imageSource: require("../assets/images/speakers/person_11.png"),
  },
  {
    name: "Barack Obama",
    trait: "여유롭고 묵직한 연설형 억양",
    imageSource: require("../assets/images/speakers/person_12.png"),
  },
] as const;

const IS_TEST_ENV = process.env.NODE_ENV === "test";

function dedupe(values: string[]) {
  return [...new Set(values)];
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
  const selectionAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    if (IS_TEST_ENV) {
      selectionAnim.setValue(selected ? 1 : 0);
      return;
    }

    Animated.timing(selectionAnim, {
      toValue: selected ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [selected, selectionAnim]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.optionPressable,
        pressed && styles.optionButtonPressed,
      ]}
    >
      <Animated.View
        style={[
          styles.optionButton,
          {
            backgroundColor: selectionAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.bgSubtle, colors.primary],
            }),
            borderColor: selectionAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.border, colors.primary],
            }),
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.optionLabel,
            {
              color: selectionAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.text, colors.textInverse],
              }),
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const selectionAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    if (IS_TEST_ENV) {
      selectionAnim.setValue(selected ? 1 : 0);
      return;
    }

    Animated.timing(selectionAnim, {
      toValue: selected ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [selected, selectionAnim]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.chipPressable,
        pressed && styles.optionButtonPressed,
      ]}
    >
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: selectionAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.bgSubtle, colors.primary],
            }),
            borderColor: selectionAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.border, colors.primary],
            }),
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.chipText,
            {
              color: selectionAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [colors.text, colors.textInverse],
              }),
            },
          ]}
        >
          {label}
        </Animated.Text>
      </Animated.View>
    </Pressable>
  );
}

function PronunciationPersonCard({
  name,
  trait,
  imageSource,
  selected,
  onPress,
}: {
  name: string;
  trait: string;
  imageSource: ImageSourcePropType;
  selected: boolean;
  onPress: () => void;
}) {
  const selectionAnim = useRef(new Animated.Value(selected ? 1 : 0)).current;

  useEffect(() => {
    if (IS_TEST_ENV) {
      selectionAnim.setValue(selected ? 1 : 0);
      return;
    }

    Animated.timing(selectionAnim, {
      toValue: selected ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.quad),
      useNativeDriver: false,
    }).start();
  }, [selected, selectionAnim]);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.personCardPressable,
        pressed && styles.optionButtonPressed,
      ]}
    >
      <Animated.View
        style={[
          styles.personCard,
          {
            borderColor: selectionAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [colors.border, colors.primary],
            }),
          },
        ]}
      >
        <ImageBackground
          source={imageSource}
          style={styles.personImage}
          imageStyle={styles.personImageInner}
        >
          <LinearGradient
            colors={[
              "rgba(0,0,0,0.04)",
              "rgba(0,0,0,0.18)",
              "rgba(0,0,0,0.82)",
            ]}
            locations={[0, 0.45, 1]}
            style={styles.personGradient}
          >
            <Animated.View
              style={[
                styles.personCardBadge,
                {
                  opacity: selectionAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, 1],
                  }),
                },
              ]}
            >
              <Ionicons name="checkmark" size={14} color={colors.textInverse} />
            </Animated.View>
            <View style={styles.personCopy}>
              <Text style={styles.personName}>{name}</Text>
              <Text style={styles.personTrait} numberOfLines={1}>
                {trait}
              </Text>
            </View>
          </LinearGradient>
        </ImageBackground>
      </Animated.View>
    </Pressable>
  );
}

export default function OnboardingScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { user, learningProfile, isProfileLoading, updateLearningProfile } =
    useAuth();
  const { width: viewportWidth } = useWindowDimensions();
  const isEditMode = edit === "1";
  const [step, setStep] = useState<OnboardingStep>("level");
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [level, setLevel] = useState<LearningLevelBand | null>(null);
  // @MX:NOTE: Pronunciation mode is feature-gated — default to expression
  //           on main while speaking stability work continues on the
  //           feature/speaking-stability branch.
  const [goalMode, setGoalMode] = useState<LearningGoalMode | null>(
    "expression",
  );
  const [focusTags, setFocusTags] = useState<string[]>([]);
  const [expressionSituations, setExpressionSituations] = useState<string[]>(
    [],
  );
  const [expressionTopics, setExpressionTopics] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const hydratedProfileKeyRef = useRef<string | null>(null);
  const stepTransition = useRef(new Animated.Value(1)).current;
  const transitionSwapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (
      Platform.OS === "android" &&
      UIManager.setLayoutAnimationEnabledExperimental
    ) {
      UIManager.setLayoutAnimationEnabledExperimental(true);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (transitionSwapTimeoutRef.current) {
        clearTimeout(transitionSwapTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    trackEvent("onboarding_start", {
      source: isEditMode ? "settings" : "auth",
    });
  }, [isEditMode]);

  useEffect(() => {
    if (!user) {
      router.replace("/intro?scene=9" as never);
      return;
    }

    if (!learningProfile) return;

    const profileHydrationKey = JSON.stringify({
      level_band: learningProfile.level_band,
      goal_mode: learningProfile.goal_mode,
      focus_tags: learningProfile.focus_tags,
      preferred_speakers: learningProfile.preferred_speakers,
      preferred_situations: learningProfile.preferred_situations,
      preferred_video_categories: learningProfile.preferred_video_categories,
    });

    if (hydratedProfileKeyRef.current === profileHydrationKey) {
      return;
    }
    hydratedProfileKeyRef.current = profileHydrationKey;

    setLevel(learningProfile.level_band);
    // @MX:NOTE: Coerce any legacy "pronunciation" profile into "expression"
    //           while the speaking feature is gated off on main. The
    //           pronunciation-specific focus tags (preferred_speakers)
    //           do not map onto expression's situation/topic data model,
    //           so we reset them and let the user re-pick on the details
    //           step. When speaking comes back, drop this coercion.
    const effectiveGoalMode: LearningGoalMode =
      learningProfile.goal_mode === "pronunciation" ||
      !learningProfile.goal_mode
        ? "expression"
        : learningProfile.goal_mode;
    setGoalMode(effectiveGoalMode);

    if (learningProfile.goal_mode === "expression") {
      const situations =
        learningProfile.preferred_situations.length > 0
          ? learningProfile.preferred_situations.filter((item) =>
              SPEAKING_SITUATIONS.includes(item as SpeakingSituation),
            )
          : learningProfile.focus_tags.filter((item) =>
              SPEAKING_SITUATIONS.includes(item as SpeakingSituation),
            );
      const topics =
        learningProfile.preferred_video_categories.length > 0
          ? learningProfile.preferred_video_categories.filter((item) =>
              VIDEO_CATEGORIES.includes(item as VideoCategory),
            )
          : learningProfile.focus_tags.filter((item) =>
              VIDEO_CATEGORIES.includes(item as VideoCategory),
            );
      setExpressionSituations(situations);
      setExpressionTopics(topics);
      setFocusTags(dedupe([...situations, ...topics]));
    } else {
      setFocusTags([]);
      setExpressionSituations([]);
      setExpressionTopics([]);
    }
  }, [learningProfile, user]);

  useEffect(() => {
    if (goalMode !== "expression") return;
    setFocusTags(dedupe([...expressionSituations, ...expressionTopics]));
  }, [expressionSituations, expressionTopics, goalMode]);

  useEffect(() => {
    if (step !== "details") return;

    if (!goalMode) {
      // goalMode is always defaulted to "expression" while speaking is
      // gated, so this path is effectively unreachable. Kept as a safety
      // net — route back to level instead of the removed goal step.
      setStep("level");
    }
  }, [goalMode, step]);

  const canSubmit = useMemo(() => {
    if (!level || !goalMode) return false;
    if (goalMode === "pronunciation") return focusTags.length > 0;
    return expressionSituations.length > 0 && expressionTopics.length > 0;
  }, [
    expressionSituations.length,
    expressionTopics.length,
    focusTags.length,
    goalMode,
    level,
  ]);

  const toggleSelection = (
    value: string,
    setter: React.Dispatch<React.SetStateAction<string[]>>,
  ) => {
    if (!IS_TEST_ENV) {
      LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    }
    setter((items) =>
      items.includes(value)
        ? items.filter((item) => item !== value)
        : [...items, value],
    );
  };

  const transitionToStep = (nextStep: OnboardingStep) => {
    if (nextStep === step || isTransitioning) return;

    if (IS_TEST_ENV) {
      setStep(nextStep);
      setIsTransitioning(false);
      stepTransition.setValue(1);
      return;
    }

    const currentIndex = STEP_SEQUENCE.indexOf(step);
    const nextIndex = STEP_SEQUENCE.indexOf(nextStep);
    const direction: 1 | -1 = nextIndex > currentIndex ? 1 : -1;

    setTransitionDirection(direction);
    setIsTransitioning(true);
    stepTransition.setValue(0);

    if (transitionSwapTimeoutRef.current) {
      clearTimeout(transitionSwapTimeoutRef.current);
    }
    transitionSwapTimeoutRef.current = setTimeout(() => {
      setStep(nextStep);
      transitionSwapTimeoutRef.current = null;
    }, 120);

    Animated.timing(stepTransition, {
      toValue: 1,
      duration: 240,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(() => {
      setIsTransitioning(false);
      stepTransition.setValue(1);
    });
  };

  const cancelPendingStepTransition = useCallback(() => {
    if (transitionSwapTimeoutRef.current) {
      clearTimeout(transitionSwapTimeoutRef.current);
      transitionSwapTimeoutRef.current = null;
    }
    setIsTransitioning(false);
    stepTransition.stopAnimation();
    stepTransition.setValue(1);
  }, [stepTransition]);

  const handleBack = () => {
    if (isSaving || step === "preparing") return;

    if (step === "details") {
      // Goal step is skipped while speaking is gated — go straight back
      // to level.
      transitionToStep("level");
      return;
    }

    if (step === "goal") {
      // Dead fallback: goal step is removed from STEP_SEQUENCE. Kept in
      // case some future code path lands here, route back to level.
      transitionToStep("level");
      return;
    }

    router.back();
  };

  const handleComplete = async () => {
    if (!user || !goalMode || !level || focusTags.length === 0) return;

    cancelPendingStepTransition();
    setStep("preparing");
    setIsSaving(true);

    try {
      trackEvent("onboarding_level_selected", { levelBand: level });
      trackEvent("onboarding_goal_selected", { goalMode, focusTags });

      await updateLearningProfile({
        level_band: level,
        goal_mode: goalMode,
        focus_tags:
          goalMode === "expression"
            ? dedupe([...expressionSituations, ...expressionTopics])
            : [],
        preferred_speakers: goalMode === "pronunciation" ? focusTags : [],
        preferred_situations:
          goalMode === "expression" ? expressionSituations : [],
        preferred_video_categories:
          goalMode === "expression" ? expressionTopics : [],
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
      cancelPendingStepTransition();
      setStep("details");
    } finally {
      setIsSaving(false);
    }
  };

  const slideDistance = Math.min(Math.max(viewportWidth * 0.22, 72), 140);

  const buildStepAnimatedStyle = () => {
    if (!isTransitioning) {
      return styles.stepStatic;
    }

    return {
      opacity: stepTransition.interpolate({
        inputRange: [0, 0.46, 0.54, 1],
        outputRange: [1, 0, 0, 1],
      }),
      transform: [
        {
          translateX: stepTransition.interpolate({
            inputRange: [0, 0.46, 0.54, 1],
            outputRange: [0, 0, transitionDirection * slideDistance, 0],
          }),
        },
      ],
    };
  };

  const renderStepContent = (targetStep: OnboardingStep) => {
    if (targetStep === "level") {
      return (
        <View style={styles.stepBlock}>
          <Text style={styles.title}>
            영어 말하기 수준이 어느 정도이신가요?
          </Text>
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
        </View>
      );
    }

    if (targetStep === "goal") {
      return (
        <View style={styles.stepBlock}>
          <Text style={styles.title}>
            지금 집중하고 싶은 영역은 어느 쪽인가요?
          </Text>
          <Text style={styles.body}>
            선택에 따라 제공해드릴 학습 컨텐츠가 달라져요. 언제든지 바꿀 수
            있어요.
          </Text>
          <View style={styles.modeRow}>
            <OptionButton
              label="발음이나 억양을 개선하고 싶어요"
              selected={goalMode === "pronunciation"}
              onPress={() => {
                setGoalMode("pronunciation");
                setFocusTags([]);
                setExpressionSituations([]);
                setExpressionTopics([]);
              }}
            />
            <OptionButton
              label="말할 때 쓸 수 있는 표현이 다양해지면 좋겠어요"
              selected={goalMode === "expression"}
              onPress={() => {
                setGoalMode("expression");
                setFocusTags([]);
                setExpressionSituations([]);
                setExpressionTopics([]);
              }}
            />
          </View>
        </View>
      );
    }

    if (targetStep === "details") {
      return (
        <View style={styles.stepBlock}>
          {goalMode === "pronunciation" ? (
            <View style={styles.focusSection}>
              <Text style={styles.title}>
                발음이나 억양 연습을 할 때 선호하는 인물이 있나요?
              </Text>
              <Text style={styles.body}>
                선호도에 맞춰 영상을 추천해드릴게요.
              </Text>
              <View style={styles.personGrid}>
                {PRONUNCIATION_PEOPLE.map((person) => (
                  <PronunciationPersonCard
                    key={person.name}
                    name={person.name}
                    trait={person.trait}
                    imageSource={person.imageSource}
                    selected={focusTags.includes(person.name)}
                    onPress={() => toggleSelection(person.name, setFocusTags)}
                  />
                ))}
              </View>
            </View>
          ) : null}

          {goalMode === "expression" ? (
            <View style={styles.focusSection}>
              <Text style={styles.title}>
                주로 어떤 상황에서 영어를 많이 쓰게 될까요?
              </Text>
              <View style={styles.chipWrap}>
                {SPEAKING_SITUATIONS.map((tag) => (
                  <ChoiceChip
                    key={tag}
                    label={tag}
                    selected={expressionSituations.includes(tag)}
                    onPress={() =>
                      toggleSelection(tag, setExpressionSituations)
                    }
                  />
                ))}
              </View>

              <Text style={[styles.focusTitle, styles.secondaryFocusTitle]}>
                어떤 주제의 영상들이 있으면 하루라도 더 들어오고 싶어질까요?
              </Text>
              <View style={styles.chipWrap}>
                {VIDEO_CATEGORIES.map((tag) => (
                  <ChoiceChip
                    key={tag}
                    label={tag}
                    selected={expressionTopics.includes(tag)}
                    onPress={() => toggleSelection(tag, setExpressionTopics)}
                  />
                ))}
              </View>
            </View>
          ) : null}
        </View>
      );
    }

    return (
      <View style={styles.stepBlock}>
        <Text style={styles.title}>
          학습 목표에 맞게 피드를 재구성하는 중이에요
        </Text>
        <Text style={styles.body}>
          선택한 목표를 바탕으로 오늘부터 바로 따라 말할 수 있는 학습 흐름을
          준비하고 있어요.
        </Text>
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      </View>
    );
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
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            step !== "preparing" && styles.contentWithFooter,
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable
              accessibilityLabel="이전"
              onPress={handleBack}
              style={({ pressed }) => [
                styles.backButton,
                pressed && styles.backButtonPressed,
              ]}
            >
              <Ionicons name="arrow-back" size={22} color={colors.text} />
            </Pressable>
          </View>
          <View style={styles.stepViewport}>
            <Animated.View
              style={[
                styles.stepAnimatedContainer,
                styles.stepLayerCurrent,
                buildStepAnimatedStyle(),
              ]}
            >
              {renderStepContent(step)}
            </Animated.View>
          </View>
        </ScrollView>

        {step !== "preparing" ? (
          <View style={styles.footerCta}>
            {step === "level" ? (
              <Pressable
                accessibilityLabel="학습 수준 다음 단계"
                style={[
                  styles.primaryButton,
                  !level && styles.primaryButtonDisabled,
                ]}
                onPress={() => {
                  if (!level) return;
                  // Skip the goal step (gated off with speaking).
                  transitionToStep("details");
                }}
                disabled={!level}
              >
                <Text style={styles.primaryButtonText}>다음</Text>
              </Pressable>
            ) : null}

            {step === "goal" ? (
              <Pressable
                accessibilityLabel="학습 목표 다음 단계"
                style={[
                  styles.primaryButton,
                  !goalMode && styles.primaryButtonDisabled,
                ]}
                onPress={() => {
                  if (!goalMode) return;
                  transitionToStep("details");
                }}
                disabled={!goalMode}
              >
                <Text style={styles.primaryButtonText}>다음</Text>
              </Pressable>
            ) : null}

            {step === "details" ? (
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
                  {isEditMode ? "저장하기" : "저장하기"}
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  screen: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  contentWithFooter: {
    paddingBottom: 136,
  },
  centeredState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  headerRow: {
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -spacing.xs,
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  stepViewport: {
    position: "relative",
    flexGrow: 1,
    overflow: "hidden",
  },
  stepLayerCurrent: {
    width: "100%",
  },
  stepStatic: {
    opacity: 1,
    transform: [{ translateX: 0 }],
  },
  stepAnimatedContainer: {
    width: "100%",
  },
  stepBlock: {
    flex: 1,
    justifyContent: "flex-start",
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
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
  optionPressable: {
    width: "100%",
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
  focusSection: {
    marginBottom: spacing.xl,
  },
  focusTitle: {
    fontSize: font.size.md,
    color: colors.text,
    fontWeight: font.weight.semibold,
    marginBottom: spacing.sm,
  },
  secondaryFocusTitle: {
    marginTop: spacing.lg,
  },
  chipWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  personGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  personCardPressable: {
    width: "48.5%",
  },
  personCard: {
    aspectRatio: 1,
    borderRadius: radius.xl,
    overflow: "hidden",
    borderWidth: 2,
    backgroundColor: colors.bgSubtle,
  },
  personImage: {
    flex: 1,
  },
  personImageInner: {
    borderRadius: radius.xl - 2,
  },
  personGradient: {
    flex: 1,
    justifyContent: "space-between",
    padding: spacing.sm,
  },
  personCardBadge: {
    alignSelf: "flex-end",
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(0,0,0,0.42)",
    alignItems: "center",
    justifyContent: "center",
  },
  personCopy: {
    gap: 2,
  },
  personName: {
    fontSize: font.size.base,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
  },
  personTrait: {
    fontSize: font.size.xs,
    lineHeight: 16,
    color: "rgba(255,255,255,0.86)",
  },
  chipPressable: {
    alignSelf: "flex-start",
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
  primaryButton: {
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
  footerCta: {
    position: "absolute",
    left: spacing.md,
    right: spacing.md,
    bottom: spacing.lg,
    padding: spacing.xs,
    backgroundColor: colors.bg,
  },
});
