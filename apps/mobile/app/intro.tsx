import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Animated,
  Dimensions,
  FlatList,
  Image,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  Vibration,
  View,
} from "react-native";
import { Asset } from "expo-asset";
import { router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import BottomSheet from "@/components/common/BottomSheet";
import { OAuthButtons } from "@/components/auth/OAuthButtons";
import { LoginForm } from "@/components/auth/LoginForm";
import { SignupForm } from "@/components/auth/SignupForm";
import { useAuth } from "@/contexts/AuthContext";
import { trackEvent } from "@/lib/analytics";
import {
  INTRO_MEDIA_SOURCES,
  INTRO_SCENES,
  type IntroScene,
} from "@/lib/onboarding-intro";
import { colors, font, radius, shadow, spacing } from "@/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const TITLE_REVEAL_INTERVAL_MS = 18;
const CTA_REVEAL_DELAY_MS = 500;
const TYPING_HAPTIC_INTERVAL_MS = 90;
const TITLE_BLOCK_HEIGHT = 176;
const TITLE_TO_MEDIA_GAP = spacing.lg;

function IntroSceneCard({
  scene,
  isActive,
  isFinalScene,
  onOpenSignupPress,
  onTypingTick,
  bottomInset,
  mediaReady,
}: {
  scene: IntroScene;
  isActive: boolean;
  isFinalScene: boolean;
  onOpenSignupPress: () => void;
  onTypingTick: () => void;
  bottomInset: number;
  mediaReady: boolean;
}) {
  const [visibleTitle, setVisibleTitle] = useState(isActive ? "" : scene.title);
  const [signupSheetVisible, setSignupSheetVisible] = useState(false);
  const bodyOpacity = useRef(new Animated.Value(1)).current;
  const ctaOpacity = useRef(new Animated.Value(isActive ? 0 : 1)).current;
  const lastTypingTickRef = useRef(0);
  const resolvedMediaSource = useMemo(() => {
    if (!scene.mediaSource) return undefined;
    if (!mediaReady) return scene.mediaSource;

    const asset = Asset.fromModule(scene.mediaSource);
    const assetUri = asset.localUri ?? asset.uri;

    return assetUri ? { uri: assetUri } : scene.mediaSource;
  }, [mediaReady, scene.mediaSource]);
  const isLoginScene = isFinalScene && scene.showLoginCta;

  useEffect(() => {
    if (!isActive) {
      setVisibleTitle(scene.title);
      bodyOpacity.setValue(1);
      ctaOpacity.setValue(0);
      lastTypingTickRef.current = 0;
      return;
    }

    setVisibleTitle("");
    bodyOpacity.setValue(1);
    ctaOpacity.setValue(0);
    lastTypingTickRef.current = 0;

    let currentIndex = 0;
    const interval = setInterval(() => {
      currentIndex += 1;
      setVisibleTitle(scene.title.slice(0, currentIndex));

      const now = Date.now();
      if (
        currentIndex < scene.title.length &&
        now - lastTypingTickRef.current >= TYPING_HAPTIC_INTERVAL_MS
      ) {
        lastTypingTickRef.current = now;
        onTypingTick();
      }

      if (currentIndex >= scene.title.length) {
        clearInterval(interval);
        if (isFinalScene) {
          setTimeout(() => {
            Animated.timing(ctaOpacity, {
              toValue: 1,
              duration: 220,
              useNativeDriver: true,
            }).start();
          }, CTA_REVEAL_DELAY_MS);
        }
      }
    }, TITLE_REVEAL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [
    bodyOpacity,
    ctaOpacity,
    isActive,
    isFinalScene,
    onTypingTick,
    scene.title,
  ]);

  if (isLoginScene) {
    return (
      <KeyboardAvoidingView
        style={styles.sceneFrame}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          style={styles.loginSceneScroll}
          contentContainerStyle={[
            styles.loginSceneContent,
            {
              paddingBottom: spacing["3xl"] + bottomInset,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.sceneHeader, styles.loginSceneHeader]}>
            <Text style={styles.sceneTitle}>{visibleTitle}</Text>
          </View>

          <Animated.View style={[styles.sceneBody, { opacity: bodyOpacity }]}>
            {scene.citation ? (
              <Text
                style={[
                  styles.sceneCitation,
                  scene.id === "scene-2" && styles.sceneCitationCompact,
                ]}
              >
                출처: {scene.citation}
              </Text>
            ) : null}
          </Animated.View>

          {isActive ? (
            <Animated.View
              style={[styles.authStackWrap, { opacity: ctaOpacity }]}
            >
              <View style={styles.authStackContent}>
                <OAuthButtons />

                <View style={styles.divider}>
                  <View style={styles.dividerLine} />
                  <View style={styles.dividerTextWrap}>
                    <Text style={styles.dividerText}>또는</Text>
                  </View>
                  <View style={styles.dividerLine} />
                </View>

                <LoginForm />

                <View style={styles.footer}>
                  <Text style={styles.footerText}>
                    아직 계정이 없으신가요?{" "}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setSignupSheetVisible(true);
                      onOpenSignupPress();
                    }}
                  >
                    <Text style={styles.footerLink}>회원가입</Text>
                  </Pressable>
                </View>
              </View>
            </Animated.View>
          ) : null}

          <BottomSheet
            visible={signupSheetVisible}
            onClose={() => setSignupSheetVisible(false)}
          >
            <View style={styles.signupSheetContent}>
              <Text style={styles.signupSheetTitle}>이메일로 회원가입</Text>
              <Text style={styles.signupSheetBody}>
                몇 가지 정보만 입력하면 바로 시작할 수 있어요.
              </Text>
              <SignupForm />
            </View>
          </BottomSheet>
        </ScrollView>
      </KeyboardAvoidingView>
    );
  }

  return (
    <View
      style={[
        styles.sceneFrame,
        {
          paddingBottom: spacing["3xl"] + bottomInset,
        },
      ]}
    >
      <View style={styles.sceneHeader}>
        <Text style={styles.sceneTitle}>{visibleTitle}</Text>
      </View>

      <View style={styles.mediaWrap}>
        <View style={styles.mediaPlaceholder}>
          {scene.mediaSource ? (
            <Image
              source={resolvedMediaSource}
              style={styles.mediaImage}
              resizeMode="cover"
              testID={`intro-media-${scene.id}`}
            />
          ) : (
            <View style={styles.mediaFallbackContent}>
              <Text style={styles.mediaBadge}>IMAGE / VIDEO</Text>
              <Text style={styles.mediaLabel}>{scene.mediaLabel}</Text>
            </View>
          )}
        </View>
      </View>

      <Animated.View style={[styles.sceneBody, { opacity: bodyOpacity }]}>
        {scene.citation ? (
          <Text
            style={[
              styles.sceneCitation,
              scene.id === "scene-2" && styles.sceneCitationCompact,
            ]}
          >
            출처: {scene.citation}
          </Text>
        ) : null}
      </Animated.View>

      {scene.id === "scene-1" ? (
        <View style={styles.swipeHintWrap}>
          <Text style={styles.swipeHintText}>
            옆으로 밀어서 다음 페이지 보기
          </Text>
        </View>
      ) : null}

      <BottomSheet
        visible={signupSheetVisible}
        onClose={() => setSignupSheetVisible(false)}
      >
        <View style={styles.signupSheetContent}>
          <Text style={styles.signupSheetTitle}>이메일로 회원가입</Text>
          <Text style={styles.signupSheetBody}>
            몇 가지 정보만 입력하면 바로 시작할 수 있어요.
          </Text>
          <SignupForm />
        </View>
      </BottomSheet>
    </View>
  );
}

export default function IntroScreen() {
  const { preview, scene } = useLocalSearchParams<{
    preview?: string;
    scene?: string;
  }>();
  const insets = useSafeAreaInsets();
  const { user, learningProfile, isInitialized, isProfileLoading } = useAuth();
  const lastHapticAtRef = useRef(0);
  const [mediaReady, setMediaReady] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() => {
    const parsedIndex = Number(scene ?? "1") - 1;
    if (!Number.isFinite(parsedIndex)) return 0;
    return Math.max(0, Math.min(INTRO_SCENES.length - 1, parsedIndex));
  });
  const isPreviewMode = preview === "1";

  useEffect(() => {
    if (isPreviewMode) return;
    if (!isInitialized) return;
    if (user && isProfileLoading) return;

    if (user && !learningProfile?.onboarding_completed_at) {
      router.replace("/onboarding" as never);
      return;
    }

    if (user && learningProfile?.onboarding_completed_at) {
      router.replace("/(tabs)" as never);
    }
  }, [
    isPreviewMode,
    isInitialized,
    isProfileLoading,
    learningProfile?.onboarding_completed_at,
    user,
  ]);

  useEffect(() => {
    let mounted = true;

    Asset.loadAsync(INTRO_MEDIA_SOURCES)
      .then(() => {
        if (mounted) {
          setMediaReady(true);
        }
      })
      .catch((error) => {
        console.warn("[Intro] Failed to preload intro artwork:", error);
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    trackEvent("intro_impression", {
      totalScenes: INTRO_SCENES.length,
    });
  }, []);

  useEffect(() => {
    const scene = INTRO_SCENES[activeIndex];
    if (!scene) return;

    trackEvent("intro_page_view", {
      sceneId: scene.id,
      index: activeIndex,
    });
  }, [activeIndex]);

  const handleOpenSignupPress = () => {
    trackEvent("intro_signup_open_click", {
      sceneId: INTRO_SCENES[activeIndex]?.id ?? null,
    });
  };

  const playTypingTick = useCallback(() => {
    const now = Date.now();
    if (now - lastHapticAtRef.current < TYPING_HAPTIC_INTERVAL_MS) return;

    lastHapticAtRef.current = now;
    Vibration.vibrate(Platform.OS === "android" ? 8 : 6);
  }, []);

  const handleMomentumScrollEnd = (
    event: NativeSyntheticEvent<NativeScrollEvent>,
  ) => {
    const nextIndex = Math.round(
      event.nativeEvent.contentOffset.x / SCREEN_WIDTH,
    );
    if (nextIndex !== activeIndex) {
      setActiveIndex(nextIndex);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        testID="intro-pager"
        data={INTRO_SCENES}
        horizontal
        pagingEnabled
        keyExtractor={(item) => item.id}
        onMomentumScrollEnd={handleMomentumScrollEnd}
        renderItem={({ item, index }) => (
          <View style={styles.scenePage}>
            <IntroSceneCard
              scene={item}
              isActive={index === activeIndex}
              isFinalScene={index === INTRO_SCENES.length - 1}
              onOpenSignupPress={handleOpenSignupPress}
              onTypingTick={playTypingTick}
              bottomInset={insets.bottom}
              mediaReady={mediaReady}
            />
          </View>
        )}
        showsHorizontalScrollIndicator={false}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scenePage: {
    width: SCREEN_WIDTH,
  },
  sceneFrame: {
    flex: 1,
    paddingTop: spacing.xl,
  },
  sceneHeader: {
    minHeight: TITLE_BLOCK_HEIGHT,
    justifyContent: "flex-start",
    paddingHorizontal: spacing.lg,
  },
  loginSceneHeader: {
    minHeight: 112,
  },
  sceneTitle: {
    color: colors.text,
    fontSize: font.size.xl,
    lineHeight: 34,
    fontWeight: font.weight.semibold,
    letterSpacing: -0.2,
  },
  mediaWrap: {
    marginTop: TITLE_TO_MEDIA_GAP,
    alignItems: "center",
  },
  mediaPlaceholder: {
    width: SCREEN_WIDTH - spacing.lg * 2,
    aspectRatio: 1,
    borderRadius: radius["2xl"],
    overflow: "hidden",
    backgroundColor: colors.bgMuted,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadow.md,
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  mediaFallbackContent: {
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  mediaBadge: {
    fontSize: font.size.sm,
    lineHeight: 18,
    color: colors.textMuted,
    fontWeight: font.weight.semibold,
    letterSpacing: 1,
  },
  mediaLabel: {
    marginTop: spacing.md,
    color: colors.text,
    fontSize: font.size.lg,
    lineHeight: 28,
    fontWeight: font.weight.semibold,
    textAlign: "center",
  },
  sceneBody: {
    marginTop: spacing.lg,
    minHeight: 28,
    paddingHorizontal: spacing.lg,
  },
  sceneCitation: {
    marginTop: spacing.xs,
    color: colors.textSecondary,
    fontSize: font.size.md,
    lineHeight: 24,
    fontWeight: font.weight.regular,
  },
  sceneCitationCompact: {
    fontSize: font.size.sm,
    lineHeight: 20,
  },
  swipeHintWrap: {
    marginTop: "auto",
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
  },
  swipeHintText: {
    color: colors.textMuted,
    fontSize: font.size.md,
    lineHeight: 22,
    textAlign: "center",
  },
  authStackWrap: {
    marginTop: spacing.lg,
  },
  loginSceneScroll: {
    flex: 1,
  },
  loginSceneContent: {
    flexGrow: 1,
    paddingTop: spacing.xl,
  },
  authStackContent: {
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginVertical: spacing.xs,
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: "rgba(255,255,255,0.22)",
  },
  dividerText: {
    color: colors.textMuted,
    fontSize: font.size.sm,
    lineHeight: 18,
    textAlign: "center",
  },
  dividerTextWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.xs,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: spacing.sm,
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: font.size.sm,
    lineHeight: 20,
  },
  footerLink: {
    color: colors.text,
    fontSize: font.size.sm,
    lineHeight: 20,
    fontWeight: font.weight.semibold,
  },
  signupSheetContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  signupSheetTitle: {
    color: colors.text,
    fontSize: font.size.xl,
    lineHeight: 30,
    fontWeight: font.weight.semibold,
  },
  signupSheetBody: {
    color: colors.textSecondary,
    fontSize: font.size.md,
    lineHeight: 22,
  },
});
