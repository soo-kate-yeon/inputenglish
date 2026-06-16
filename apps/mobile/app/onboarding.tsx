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
import {
  GENRES,
  SPEAKING_SITUATIONS,
  SPEAKING_SITUATION_LABELS,
} from "@inputenglish/shared";
import type {
  Genre,
  LearningGoalMode,
  LearningLevelBand,
  SpeakingSituation,
} from "@inputenglish/shared";
import { GENRE_LABELS } from "@/lib/professional-labels";
import { useAuth } from "@/contexts/AuthContext";
import { trackEvent } from "@/lib/analytics";
import { inferPremiumPreferredSourceTypes } from "@/lib/premium-interest-clusters";
import { useTheme, createThemedStyles } from "@/components/ui";
import { mediaOverlay } from "@inputenglish/design-tokens";
import { VocabAssessment } from "@/components/onboarding/VocabAssessment";
import { submitVocabAssessment } from "@/lib/premium-api";
import type { VocabAnswer } from "@/lib/premium-api";

type OnboardingStep = "vocab" | "level" | "goal" | "details" | "preparing";
// @MX:NOTE: "vocab" is the primary first step — a Yes/No vocab-size test
//           (SPEC-INPUT-003) that measures the user's band instead of the
//           self-reported 4-choice. "level" is kept as an off-sequence
//           fallback reached by skipping the test (abandonment, I-W1).
// @MX:NOTE: Speaking/pronunciation is feature-gated on main until the
//           Azure + ffmpeg pipeline on feature/speaking-stability is
//           stable. The "goal" step is dropped because "expression" is
//           the only selectable goal_mode right now; re-insert it here
//           when speaking returns.
const STEP_SEQUENCE: OnboardingStep[] = ["vocab", "details", "preparing"];

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
    name: "Conan O'Brien",
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

const getOptionButtonStyles = createThemedStyles((theme) => ({
  optionPressable: {
    width: "100%" as const,
  },
  optionButton: {
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.surface.muted,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[4],
  },
  optionButtonPressed: {
    opacity: 0.92,
  },
  optionLabel: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
}));

function OptionButton({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = getOptionButtonStyles(theme);
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
              outputRange: [
                theme.colors.surface.muted,
                theme.colors.action.primary,
              ],
            }),
            borderColor: selectionAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [
                theme.colors.border.default,
                theme.colors.action.primary,
              ],
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
                outputRange: [
                  theme.colors.text.primary,
                  theme.colors.text.inverse,
                ],
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

const getChoiceChipStyles = createThemedStyles((theme) => ({
  chipPressable: {
    alignSelf: "flex-start" as const,
  },
  chip: {
    borderRadius: theme.radius.full,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.surface.muted,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: 10,
  },
  chipPressed: {
    opacity: 0.92,
  },
  chipText: {
    ...theme.typography.label,
    color: theme.colors.text.primary,
  },
}));

function ChoiceChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = getChoiceChipStyles(theme);
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
        pressed && styles.chipPressed,
      ]}
    >
      <Animated.View
        style={[
          styles.chip,
          {
            backgroundColor: selectionAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [
                theme.colors.surface.muted,
                theme.colors.action.primary,
              ],
            }),
            borderColor: selectionAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [
                theme.colors.border.default,
                theme.colors.action.primary,
              ],
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
                outputRange: [
                  theme.colors.text.primary,
                  theme.colors.text.inverse,
                ],
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

const getPersonCardStyles = createThemedStyles((theme) => ({
  personCardPressable: {
    width: "48.5%" as const,
  },
  personCard: {
    aspectRatio: 1,
    borderRadius: theme.radius.lg,
    overflow: "hidden" as const,
    borderWidth: 2,
    backgroundColor: theme.colors.surface.muted,
  },
  personCardPressed: {
    opacity: 0.92,
  },
  personImage: {
    flex: 1,
  },
  // borderRadius matches card minus border width to avoid inner corner bleed
  personImageInner: {
    borderRadius: theme.radius.lg - 2,
  },
  personGradient: {
    flex: 1,
    justifyContent: "space-between" as const,
    padding: theme.spacing[2],
  },
  personCardBadge: {
    alignSelf: "flex-end" as const,
    width: 24,
    height: 24,
    borderRadius: theme.radius.lg,
    backgroundColor: mediaOverlay.badge,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  personCopy: {
    gap: 2,
  },
  personName: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.inverse,
  },
  personTrait: {
    fontSize: 11,
    lineHeight: 16,
    color: mediaOverlay.onImageText,
  },
}));

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
  const theme = useTheme();
  const styles = getPersonCardStyles(theme);
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
        pressed && styles.personCardPressed,
      ]}
    >
      <Animated.View
        style={[
          styles.personCard,
          {
            borderColor: selectionAnim.interpolate({
              inputRange: [0, 1],
              outputRange: [
                theme.colors.border.default,
                theme.colors.action.primary,
              ],
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
              mediaOverlay.gradientTop,
              mediaOverlay.gradientMid,
              mediaOverlay.gradientBottom,
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
              <Ionicons
                name="checkmark"
                size={14}
                color={theme.colors.text.inverse}
              />
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

const getScreenStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
  },
  screen: {
    flex: 1,
  },
  vocabContainer: {
    flex: 1,
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[6],
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[8],
  },
  contentWithFooter: {
    paddingBottom: 136,
  },
  centeredState: {
    flex: 1,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  headerRow: {
    alignItems: "flex-start" as const,
    marginBottom: theme.spacing[4],
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: theme.radius.full,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    marginLeft: -theme.spacing[1],
  },
  backButtonPressed: {
    opacity: 0.7,
  },
  stepViewport: {
    position: "relative" as const,
    flexGrow: 1,
    overflow: "hidden" as const,
  },
  stepLayerCurrent: {
    width: "100%" as const,
  },
  stepStatic: {
    opacity: 1,
    transform: [{ translateX: 0 }],
  },
  stepAnimatedContainer: {
    width: "100%" as const,
  },
  stepBlock: {
    flex: 1,
    justifyContent: "flex-start" as const,
    paddingTop: theme.spacing[6],
    paddingBottom: theme.spacing[8],
  },
  title: {
    ...theme.typography.title,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[4],
  },
  body: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
    marginBottom: theme.spacing[4],
  },
  optionList: {
    gap: theme.spacing[2],
    marginTop: theme.spacing[2],
    marginBottom: theme.spacing[8],
  },
  modeRow: {
    gap: theme.spacing[2],
    marginBottom: theme.spacing[6],
  },
  focusSection: {
    marginBottom: theme.spacing[8],
  },
  focusTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
    marginBottom: theme.spacing[2],
  },
  secondaryFocusTitle: {
    marginTop: theme.spacing[6],
  },
  chipWrap: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    gap: theme.spacing[2],
  },
  personGrid: {
    flexDirection: "row" as const,
    flexWrap: "wrap" as const,
    justifyContent: "space-between" as const,
    gap: theme.spacing[2],
  },
  primaryButton: {
    backgroundColor: theme.colors.action.primary,
    borderRadius: theme.radius.full,
    paddingVertical: theme.spacing[4],
    alignItems: "center" as const,
  },
  primaryButtonDisabled: {
    opacity: 0.35,
  },
  primaryButtonText: {
    ...theme.typography.button,
    color: theme.colors.text.inverse,
  },
  loader: {
    marginTop: theme.spacing[6],
  },
  footerCta: {
    position: "absolute" as const,
    left: theme.spacing[4],
    right: theme.spacing[4],
    bottom: theme.spacing[6],
    padding: theme.spacing[1],
    backgroundColor: theme.colors.background.canvas,
  },
}));

export default function OnboardingScreen() {
  const { edit } = useLocalSearchParams<{ edit?: string }>();
  const { user, learningProfile, isProfileLoading, updateLearningProfile } =
    useAuth();
  const { width: viewportWidth } = useWindowDimensions();
  const isEditMode = edit === "1";
  // Fresh onboarding starts with the vocab test; edit mode jumps straight to
  // the manual level picker (no need to re-measure on a profile edit).
  const [step, setStep] = useState<OnboardingStep>(
    isEditMode ? "level" : "vocab",
  );
  const [transitionDirection, setTransitionDirection] = useState<1 | -1>(1);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [level, setLevel] = useState<LearningLevelBand | null>(null);
  const [vocabSubmitting, setVocabSubmitting] = useState(false);
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

  const theme = useTheme();
  const styles = getScreenStyles(theme);

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
    trackEvent("onboarding_step_viewed", { step });
  }, [step]);

  useEffect(() => {
    if (!user) {
      router.replace("/(auth)/login" as never);
      return;
    }

    if (!learningProfile) return;

    const profileHydrationKey = JSON.stringify({
      level_band: learningProfile.level_band,
      goal_mode: learningProfile.goal_mode,
      focus_tags: learningProfile.focus_tags,
      preferred_speakers: learningProfile.preferred_speakers,
      preferred_situations: learningProfile.preferred_situations,
      preferred_genres: learningProfile.preferred_genres,
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
        learningProfile.preferred_genres.length > 0
          ? learningProfile.preferred_genres.filter((item) =>
              GENRES.includes(item as Genre),
            )
          : learningProfile.focus_tags.filter((item) =>
              GENRES.includes(item as Genre),
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

  // @MX:NOTE: Vocab test completion (SPEC-INPUT-003 I-E1). The server scores +
  //           persists user_vocab_profiles + seed known_words and returns the
  //           estimated band, which seeds the manual `level` state so the
  //           profile save stays consistent. On failure, fall back to the
  //           manual level picker (abandonment-safe, I-W1).
  const handleVocabComplete = async (answers: VocabAnswer[]) => {
    if (vocabSubmitting) return;
    setVocabSubmitting(true);
    try {
      const result = await submitVocabAssessment(answers);
      // VocabBand and LearningLevelBand share the same 4 values.
      setLevel(result.estimatedBand as LearningLevelBand);
      trackEvent("onboarding_vocab_assessed", {
        band: result.estimatedBand,
        level: result.estimatedLevel,
        seedCount: result.seedCount,
      });
      transitionToStep("details");
    } catch (error) {
      console.error("[Onboarding] vocab assessment failed:", error);
      // Abandonment / failure → manual level fallback (no garbage persisted).
      transitionToStep("level");
    } finally {
      setVocabSubmitting(false);
    }
  };

  const handleVocabSkip = () => {
    if (vocabSubmitting) return;
    trackEvent("onboarding_vocab_skipped", {});
    transitionToStep("level");
  };

  const handleBack = () => {
    if (isSaving || step === "preparing" || vocabSubmitting) return;

    if (step === "details") {
      transitionToStep(isEditMode ? "level" : "vocab");
      return;
    }

    if (step === "level") {
      // Manual picker is the skip fallback from the vocab test. In edit mode
      // it is the first step, so back exits the flow.
      if (isEditMode) {
        router.back();
      } else {
        transitionToStep("vocab");
      }
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
          goalMode === "expression"
            ? (expressionSituations as SpeakingSituation[])
            : [],
        preferred_source_types:
          goalMode === "expression"
            ? inferPremiumPreferredSourceTypes({
                situations: expressionSituations as SpeakingSituation[],
                genres: expressionTopics as Genre[],
              })
            : [],
        preferred_genres:
          goalMode === "expression" ? (expressionTopics as Genre[]) : [],
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
              <Text style={styles.body}>
                처음 관심사 클러스터를 잡아두면 매일 도착하는 큐레이션이 더
                빠르게 맞아져요.
              </Text>
              <View style={styles.chipWrap}>
                {SPEAKING_SITUATIONS.map((tag) => (
                  <ChoiceChip
                    key={tag}
                    label={SPEAKING_SITUATION_LABELS[tag]}
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
                {GENRES.map((tag) => (
                  <ChoiceChip
                    key={tag}
                    label={GENRE_LABELS[tag]}
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
        <ActivityIndicator
          color={theme.colors.action.primary}
          style={styles.loader}
        />
      </View>
    );
  };

  if (isProfileLoading && !learningProfile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centeredState}>
          <ActivityIndicator color={theme.colors.action.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.screen}>
        {step === "vocab" ? (
          <View style={styles.vocabContainer}>
            <View style={styles.headerRow}>
              <Pressable
                accessibilityLabel="이전"
                onPress={handleBack}
                style={({ pressed }) => [
                  styles.backButton,
                  pressed && styles.backButtonPressed,
                ]}
              >
                <Ionicons
                  name="arrow-back"
                  size={22}
                  color={theme.colors.text.primary}
                />
              </Pressable>
            </View>
            <VocabAssessment
              onComplete={handleVocabComplete}
              onSkip={handleVocabSkip}
              submitting={vocabSubmitting}
            />
          </View>
        ) : (
          <>
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
                  <Ionicons
                    name="arrow-back"
                    size={22}
                    color={theme.colors.text.primary}
                  />
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
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
