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
import { safeSelectionAsync, safeImpactLight } from "@/lib/safeHaptic";

type OnboardingStep =
  | "vocab"
  | "level"
  | "goal"
  | "topics"
  | "formats"
  | "preparing";

// @MX:NOTE: Interest questions are aligned to the v1.3 CI content model
//   (reading pool = band × format × topic). TOPIC values match the reading
//   matrix + channel topics; FORMAT values match reading-generation formats.
//   Selections persist into the learning profile's focus_tags (prefixed) for
//   the v1.3 assembly wiring (follow-up).
const TOPIC_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "science", label: "과학" },
  { value: "technology", label: "테크 / IT" },
  { value: "economics", label: "경제" },
  { value: "health", label: "건강 / 웰빙" },
  { value: "education", label: "교육 / 학습" },
  { value: "culture", label: "문화 / 예술" },
  { value: "history", label: "역사" },
  { value: "climate", label: "환경 / 기후" },
];

const FORMAT_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "nonfiction", label: "정보 / 설명형" },
  { value: "editorial", label: "시사 / 오피니언" },
  { value: "dialogue", label: "대화 / 회화체" },
  { value: "noir", label: "이야기 / 소설" },
  { value: "business", label: "비즈니스 / 실무" },
  { value: "economic", label: "경제 분석" },
];

const TOPIC_TAG_PREFIX = "topic:";
const FORMAT_TAG_PREFIX = "format:";
// @MX:NOTE: "vocab" is the primary first step — a Yes/No vocab-size test
//           (SPEC-INPUT-003) that measures the user's band instead of the
//           self-reported 4-choice. "level" is kept as an off-sequence
//           fallback reached by skipping the test (abandonment, I-W1).
// @MX:NOTE: Speaking/pronunciation is feature-gated on main until the
//           Azure + ffmpeg pipeline on feature/speaking-stability is
//           stable. The "goal" step is dropped because "expression" is
//           the only selectable goal_mode right now; re-insert it here
//           when speaking returns.
const STEP_SEQUENCE: OnboardingStep[] = [
  "vocab",
  "topics",
  "formats",
  "preparing",
];

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
      onPress={() => {
        safeSelectionAsync();
        onPress();
      }}
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

const getMultiSelectRowStyles = createThemedStyles((theme) => ({
  pressable: {
    width: "100%" as const,
  },
  row: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    borderRadius: theme.radius.lg,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    backgroundColor: theme.colors.surface.muted,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[4],
  },
  rowSelected: {
    borderColor: theme.colors.action.primary,
    backgroundColor: theme.colors.action.primary,
  },
  rowPressed: {
    opacity: 0.92,
  },
  label: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
  },
  labelSelected: {
    color: theme.colors.text.inverse,
  },
}));

// Full-width, one-per-row multi-select button (replaces the wrap-chip layout).
function MultiSelectRow({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const styles = getMultiSelectRowStyles(theme);
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={() => {
        safeSelectionAsync();
        onPress();
      }}
      style={({ pressed }) => [styles.pressable, pressed && styles.rowPressed]}
    >
      <View style={[styles.row, selected && styles.rowSelected]}>
        <Text style={[styles.label, selected && styles.labelSelected]}>
          {label}
        </Text>
        <Ionicons
          name={selected ? "checkmark-circle" : "ellipse-outline"}
          size={22}
          color={
            selected ? theme.colors.text.inverse : theme.colors.text.secondary
          }
        />
      </View>
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
      onPress={() => {
        safeSelectionAsync();
        onPress();
      }}
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
      onPress={() => {
        safeSelectionAsync();
        onPress();
      }}
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
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [selectedFormats, setSelectedFormats] = useState<string[]>([]);
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
    setGoalMode("expression");

    // Hydrate v1.3 topic/format selections from focus_tags (prefixed).
    const tags = learningProfile.focus_tags ?? [];
    setSelectedTopics(
      tags
        .filter((t) => t.startsWith(TOPIC_TAG_PREFIX))
        .map((t) => t.slice(TOPIC_TAG_PREFIX.length)),
    );
    setSelectedFormats(
      tags
        .filter((t) => t.startsWith(FORMAT_TAG_PREFIX))
        .map((t) => t.slice(FORMAT_TAG_PREFIX.length)),
    );
  }, [learningProfile, user]);

  // Each interest step needs at least one selection before advancing.
  const canLeaveTopics = selectedTopics.length > 0;
  const canSubmit = useMemo(
    () =>
      Boolean(level) && selectedTopics.length > 0 && selectedFormats.length > 0,
    [level, selectedTopics.length, selectedFormats.length],
  );

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
      transitionToStep("topics");
    } catch (error) {
      console.error("[Onboarding] vocab assessment failed:", error);
      // Abandonment / failure → manual level fallback (no garbage persisted).
      transitionToStep("level");
    } finally {
      setVocabSubmitting(false);
    }
  };

  const handleBack = () => {
    if (isSaving || step === "preparing" || vocabSubmitting) return;
    safeImpactLight();

    if (step === "formats") {
      transitionToStep("topics");
      return;
    }

    if (step === "topics") {
      transitionToStep(isEditMode ? "level" : "vocab");
      return;
    }

    if (step === "level") {
      // Manual picker is the vocab-failure fallback / edit-mode entry.
      if (isEditMode) {
        router.back();
      } else {
        transitionToStep("vocab");
      }
      return;
    }

    if (step === "goal") {
      transitionToStep("level");
      return;
    }

    router.back();
  };

  const handleComplete = async () => {
    if (!user || !level || !canSubmit) return;
    safeImpactLight();

    cancelPendingStepTransition();
    setStep("preparing");
    setIsSaving(true);

    try {
      trackEvent("onboarding_level_selected", { levelBand: level });

      // Persist v1.3 interest selections in focus_tags (prefixed) for the
      // assembly wiring (follow-up). Legacy curation fields are left empty.
      await updateLearningProfile({
        level_band: level,
        goal_mode: "expression",
        focus_tags: [
          ...selectedTopics.map((t) => `${TOPIC_TAG_PREFIX}${t}`),
          ...selectedFormats.map((f) => `${FORMAT_TAG_PREFIX}${f}`),
        ],
        preferred_speakers: [],
        preferred_situations: [],
        preferred_source_types: [],
        preferred_genres: [],
        onboarding_completed_at: new Date().toISOString(),
      });

      trackEvent("onboarding_complete", {
        levelBand: level,
        source: isEditMode ? "settings" : "auth",
      });

      router.replace("/(tabs)");
    } catch (error) {
      console.error("[Onboarding] Failed to save learning profile:", error);
      cancelPendingStepTransition();
      setStep("formats");
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

    if (targetStep === "topics") {
      return (
        <View style={styles.stepBlock}>
          <Text style={styles.title}>어떤 주제에 관심 있으세요?</Text>
          <Text style={styles.body}>
            고른 주제로 매일 도착하는 콘텐츠가 맞춰져요. 여러 개 골라도 돼요.
          </Text>
          <View style={styles.optionList}>
            {TOPIC_OPTIONS.map((option) => (
              <MultiSelectRow
                key={option.value}
                label={option.label}
                selected={selectedTopics.includes(option.value)}
                onPress={() => toggleSelection(option.value, setSelectedTopics)}
              />
            ))}
          </View>
        </View>
      );
    }

    if (targetStep === "formats") {
      return (
        <View style={styles.stepBlock}>
          <Text style={styles.title}>어떤 스타일을 좋아하세요?</Text>
          <Text style={styles.body}>
            같은 주제도 풀어내는 방식이 달라요. 끌리는 형식을 골라주세요.
          </Text>
          <View style={styles.optionList}>
            {FORMAT_OPTIONS.map((option) => (
              <MultiSelectRow
                key={option.value}
                label={option.label}
                selected={selectedFormats.includes(option.value)}
                onPress={() =>
                  toggleSelection(option.value, setSelectedFormats)
                }
              />
            ))}
          </View>
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
            <VocabAssessment
              onComplete={handleVocabComplete}
              onBack={handleBack}
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
                      safeImpactLight();
                      transitionToStep("topics");
                    }}
                    disabled={!level}
                  >
                    <Text style={styles.primaryButtonText}>다음</Text>
                  </Pressable>
                ) : null}

                {step === "topics" ? (
                  <Pressable
                    accessibilityLabel="관심 주제 다음 단계"
                    style={[
                      styles.primaryButton,
                      !canLeaveTopics && styles.primaryButtonDisabled,
                    ]}
                    onPress={() => {
                      if (!canLeaveTopics) return;
                      safeImpactLight();
                      transitionToStep("formats");
                    }}
                    disabled={!canLeaveTopics}
                  >
                    <Text style={styles.primaryButtonText}>다음</Text>
                  </Pressable>
                ) : null}

                {step === "formats" ? (
                  <Pressable
                    accessibilityLabel="온보딩 완료하기"
                    style={[
                      styles.primaryButton,
                      (!canSubmit || isSaving) && styles.primaryButtonDisabled,
                    ]}
                    onPress={handleComplete}
                    disabled={!canSubmit || isSaving}
                  >
                    <Text style={styles.primaryButtonText}>저장하기</Text>
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
