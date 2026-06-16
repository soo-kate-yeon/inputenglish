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
import { useTheme, createThemedStyles } from "@/components/ui";

const SCREEN_WIDTH = Dimensions.get("window").width;
const TITLE_REVEAL_INTERVAL_MS = 18;
const CTA_REVEAL_DELAY_MS = 500;
const TYPING_HAPTIC_INTERVAL_MS = 90;
const TITLE_BLOCK_HEIGHT = 176;

const getStyles = createThemedStyles((theme) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
  },
  scenePage: {
    width: SCREEN_WIDTH,
  },
  sceneFrame: {
    flex: 1,
    paddingTop: theme.spacing[8],
  },
  sceneHeader: {
    minHeight: TITLE_BLOCK_HEIGHT,
    justifyContent: "flex-start",
    paddingHorizontal: theme.spacing[6],
  },
  loginSceneHeader: {
    minHeight: 112,
  },
  sceneTitle: {
    ...theme.typography.title,
    color: theme.colors.text.primary,
    letterSpacing: -0.2,
  },
  mediaWrap: {
    marginTop: theme.spacing[6],
    alignItems: "center",
  },
  mediaPlaceholder: {
    width: SCREEN_WIDTH - theme.spacing[6] * 2,
    aspectRatio: 1,
    borderRadius: theme.radius.full,
    overflow: "hidden",
    backgroundColor: theme.colors.surface.muted,
    borderWidth: 1,
    borderColor: theme.colors.border.subtle,
    alignItems: "center",
    justifyContent: "center",
    ...theme.shadows.card,
  },
  mediaImage: {
    width: "100%",
    height: "100%",
  },
  mediaFallbackContent: {
    paddingHorizontal: theme.spacing[6],
    alignItems: "center",
    justifyContent: "center",
  },
  mediaBadge: {
    ...theme.typography.caption,
    color: theme.colors.text.tertiary,
    fontWeight: "600",
    letterSpacing: 1,
  },
  mediaLabel: {
    marginTop: theme.spacing[4],
    color: theme.colors.text.primary,
    ...theme.typography.sectionTitle,
    textAlign: "center",
  },
  sceneBody: {
    marginTop: theme.spacing[6],
    minHeight: 28,
    paddingHorizontal: theme.spacing[6],
  },
  sceneCitation: {
    marginTop: theme.spacing[1],
    color: theme.colors.text.secondary,
    ...theme.typography.body,
  },
  sceneCitationCompact: {
    ...theme.typography.caption,
  },
  swipeHintWrap: {
    marginTop: "auto",
    paddingTop: theme.spacing[4],
    paddingBottom: theme.spacing[2],
    paddingHorizontal: theme.spacing[6],
    alignItems: "center",
  },
  swipeHintText: {
    color: theme.colors.text.tertiary,
    ...theme.typography.body,
    textAlign: "center",
  },
  authStackWrap: {
    marginTop: theme.spacing[6],
  },
  loginSceneScroll: {
    flex: 1,
  },
  loginSceneContent: {
    flexGrow: 1,
    paddingTop: theme.spacing[8],
  },
  authStackContent: {
    gap: theme.spacing[4],
    paddingHorizontal: theme.spacing[6],
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    gap: theme.spacing[4],
    marginVertical: theme.spacing[1],
  },
  dividerLine: {
    flex: 1,
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border.subtle,
  },
  dividerText: {
    color: theme.colors.text.tertiary,
    ...theme.typography.caption,
    textAlign: "center",
  },
  dividerTextWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.spacing[1],
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: theme.spacing[2],
  },
  footerText: {
    color: theme.colors.text.secondary,
    ...theme.typography.label,
  },
  footerLink: {
    color: theme.colors.text.primary,
    ...theme.typography.label,
    fontWeight: "600",
  },
  signupSheetContent: {
    paddingHorizontal: theme.spacing[6],
    paddingBottom: theme.spacing[6],
    gap: theme.spacing[4],
  },
  signupSheetTitle: {
    color: theme.colors.text.primary,
    ...theme.typography.title,
  },
  signupSheetBody: {
    color: theme.colors.text.secondary,
    ...theme.typography.body,
  },
}));

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
  const theme = useTheme();
  const styles = getStyles(theme);
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
              paddingBottom: theme.spacing[8] * 2 + bottomInset,
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
          paddingBottom: theme.spacing[8] * 2 + bottomInset,
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
  const styles = getStyles(useTheme());

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
    const currentScene = INTRO_SCENES[activeIndex];
    if (!currentScene) return;

    trackEvent("intro_page_view", {
      sceneId: currentScene.id,
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
