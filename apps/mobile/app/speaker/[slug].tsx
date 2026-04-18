import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Stack, router, useLocalSearchParams } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { SessionListItem } from "@/lib/api";
import { useSubscription } from "@/hooks/useSubscription";
import {
  fetchSpeakerDetail,
  fetchSpeakerSessions,
  type SpeakerDetail,
} from "@/lib/api";
import { getSessionPressDestination } from "@/lib/session-access";
import { getSpeakerImageSource } from "@/lib/speaker-assets";
import { colors, font, radius, shadow, spacing } from "@/theme";

const SCREEN_WIDTH = Dimensions.get("window").width;
const HERO_SIZE = SCREEN_WIDTH - spacing.md * 2;

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainder = Math.floor(seconds % 60);

  if (minutes === 0) return `${remainder}초`;
  if (remainder === 0) return `${minutes}분`;
  return `${minutes}분 ${remainder}초`;
}

function SpeakerSessionCard({
  item,
  onPress,
}: {
  item: SessionListItem;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.sessionCard} onPress={onPress}>
      {item.thumbnail_url ? (
        <Image
          source={{ uri: item.thumbnail_url }}
          style={styles.sessionThumb}
          resizeMode="cover"
        />
      ) : (
        <View style={[styles.sessionThumb, styles.thumbPlaceholder]} />
      )}

      <View style={styles.sessionMeta}>
        <Text style={styles.sessionTitle} numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={styles.sessionSubtitle} numberOfLines={2}>
            {item.subtitle}
          </Text>
        ) : null}
        <Text style={styles.sessionInfo}>
          {[item.channel_name, formatDuration(item.duration)]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
    </Pressable>
  );
}

export default function SpeakerDetailScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const insets = useSafeAreaInsets();
  const { plan } = useSubscription();
  const [speaker, setSpeaker] = useState<SpeakerDetail | null>(null);
  const [sessions, setSessions] = useState<SessionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDescriptionExpanded, setIsDescriptionExpanded] = useState(false);
  const descriptionMotion = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!slug) return;

    setLoading(true);
    setError(null);

    Promise.all([fetchSpeakerDetail(slug), fetchSpeakerSessions(slug)])
      .then(([speakerDetail, speakerSessions]) => {
        setSpeaker(speakerDetail);
        setSessions(speakerSessions);
      })
      .catch((nextError: unknown) => {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "인물 정보를 불러오지 못했습니다.",
        );
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    Animated.timing(descriptionMotion, {
      toValue: isDescriptionExpanded ? 1 : 0,
      duration: 180,
      useNativeDriver: true,
    }).start();
  }, [descriptionMotion, isDescriptionExpanded]);

  const title = useMemo(() => speaker?.name ?? "Key Speaker", [speaker?.name]);
  const heroImageSource = getSpeakerImageSource(
    slug,
    speaker?.image_url,
    speaker?.name,
  );
  const speakerDescription =
    speaker?.description_long ||
    speaker?.bio_short ||
    "이 인물의 커뮤니케이션 맥락과 말하기 습관을 정리해둘 공간입니다.";
  const descriptionPanelAnimatedStyle = {
    opacity: descriptionMotion.interpolate({
      inputRange: [0, 1],
      outputRange: [0.94, 1],
    }),
    transform: [
      {
        translateY: descriptionMotion.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
  };
  const dimmingBoostAnimatedStyle = {
    opacity: descriptionMotion.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
  };

  function toggleDescription() {
    setIsDescriptionExpanded((current) => !current);
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={colors.bg} />
      <Stack.Screen
        options={{
          title,
          headerTitleAlign: "center",
          headerShadowVisible: false,
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerBackVisible: true,
          headerBackButtonDisplayMode: "minimal",
          headerTitleStyle: {
            fontSize: font.size.base,
            fontWeight: font.weight.semibold,
            color: colors.text,
          },
        }}
      />

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator size="small" color={colors.textSecondary} />
        </View>
      ) : error || !speaker ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateText}>
            {error ?? "인물 정보를 찾을 수 없어요"}
          </Text>
        </View>
      ) : (
        <>
          <FlatList
            data={sessions}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <SpeakerSessionCard
                item={item}
                onPress={() =>
                  router.push(getSessionPressDestination(item, plan))
                }
              />
            )}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{
              paddingBottom: 48 + insets.bottom,
            }}
            ListHeaderComponent={
              <View>
                <View style={styles.headerBlock}>
                  <View style={styles.heroCard}>
                    <View style={styles.heroMedia}>
                      {heroImageSource ? (
                        <Image
                          source={heroImageSource}
                          style={styles.heroImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={[styles.heroImage, styles.heroPlaceholder]}
                        >
                          <Text style={styles.heroPlaceholderEyebrow}>
                            Image Placeholder
                          </Text>
                          <Text style={styles.heroPlaceholderCopy}>
                            speaker visual area
                          </Text>
                        </View>
                      )}

                      <View style={styles.heroDimmingLayer} />
                      <Animated.View
                        pointerEvents="none"
                        style={[
                          styles.heroDimmingLayer,
                          styles.heroDimmingLayerExpanded,
                          dimmingBoostAnimatedStyle,
                        ]}
                      />

                      <View style={styles.heroOverlay}>
                        <Text style={styles.heroName}>{speaker.name}</Text>
                        {speaker.role_title || speaker.organization ? (
                          <Text style={styles.heroRole} numberOfLines={1}>
                            {[speaker.role_title, speaker.organization]
                              .filter(Boolean)
                              .join(" · ")}
                          </Text>
                        ) : null}
                        <Animated.View style={descriptionPanelAnimatedStyle}>
                          <Pressable
                            onPress={toggleDescription}
                            style={styles.descriptionPreview}
                          >
                            <Text
                              style={[
                                styles.bodyText,
                                isDescriptionExpanded &&
                                  styles.bodyTextExpanded,
                              ]}
                              numberOfLines={
                                isDescriptionExpanded ? undefined : 2
                              }
                            >
                              {speakerDescription}
                            </Text>
                            <Text style={styles.descriptionAction}>
                              {isDescriptionExpanded ? "접기" : "전체 읽기"}
                            </Text>
                          </Pressable>
                        </Animated.View>
                      </View>
                    </View>
                  </View>
                </View>

                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>이 인물의 영상</Text>
                  <Text style={styles.sectionCaption}>
                    {sessions.length}개 세션
                  </Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View style={styles.stateContainer}>
                <Text style={styles.stateText}>연결된 세션이 아직 없어요</Text>
              </View>
            }
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  heroCard: {
    width: HERO_SIZE,
    alignSelf: "center",
    borderRadius: radius["2xl"],
    overflow: "hidden",
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    shadowColor: shadow.lg.shadowColor,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5,
  },
  heroMedia: {
    width: "100%",
    aspectRatio: 1,
    backgroundColor: colors.bgSubtle,
  },
  heroImage: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.bgSubtle,
  },
  heroPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
  },
  heroDimmingLayer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.34)",
  },
  heroDimmingLayerExpanded: {
    backgroundColor: "rgba(0,0,0,0.56)",
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  heroPlaceholderEyebrow: {
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  heroPlaceholderCopy: {
    fontSize: font.size.base,
    color: colors.textInverse,
  },
  headerBlock: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.md,
  },
  heroName: {
    fontSize: font.size["2xl"],
    fontWeight: font.weight.bold,
    color: colors.textInverse,
  },
  heroRole: {
    fontSize: font.size.sm,
    color: "rgba(255,255,255,0.86)",
  },
  bodyText: {
    fontSize: font.size.md,
    color: "rgba(255,255,255,0.92)",
    lineHeight: 22,
  },
  bodyTextExpanded: {
    lineHeight: 24,
  },
  descriptionPreview: {
    gap: spacing.xs,
    marginTop: spacing.xs,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.22)",
    backgroundColor: "rgba(0,0,0,0.18)",
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  descriptionAction: {
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    color: colors.textInverse,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: font.size.lg,
    fontWeight: font.weight.bold,
    color: colors.text,
  },
  sectionCaption: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
  },
  sessionCard: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
  },
  sessionThumb: {
    width: SCREEN_WIDTH - spacing.md * 2,
    height: (SCREEN_WIDTH - spacing.md * 2) * (9 / 16),
    borderRadius: radius.lg,
    backgroundColor: colors.bgMuted,
  },
  sessionMeta: {
    paddingTop: spacing.sm,
    gap: 4,
  },
  sessionTitle: {
    fontSize: font.size.md,
    fontWeight: font.weight.semibold,
    color: colors.text,
    lineHeight: 21,
  },
  sessionSubtitle: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
    lineHeight: 18,
  },
  sessionInfo: {
    fontSize: font.size.sm,
    color: colors.textSecondary,
  },
  thumbPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  stateContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: spacing.lg,
  },
  stateText: {
    fontSize: font.size.md,
    color: colors.textSecondary,
    textAlign: "center",
  },
});
