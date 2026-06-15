import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  PremiumSession,
  PremiumSessionStep,
  PremiumTranscriptLine,
} from "@inputenglish/shared";
import YouTubePlayer, {
  type YouTubePlayerHandle,
} from "@/components/player/YouTubePlayer";
import {
  findPremiumActiveTranscriptLine,
  getPremiumTranscriptScrollIndex,
  PREMIUM_TRANSCRIPT_SYNC_INTERVAL_MS,
} from "@/lib/premium-transcript-sync";
import { markPremiumSessionInProgress } from "@/lib/premium-session-progress";
import { colors, font, leading, radius, spacing } from "@/theme";

const STEPS: Array<{ id: PremiumSessionStep; label: string }> = [
  { id: "article", label: "읽기" },
  { id: "content-catch", label: "듣기" },
  { id: "delivery-analysis", label: "분석" },
  { id: "expression-cards", label: "표현" },
  { id: "roleplay", label: "말하기" },
  { id: "completion", label: "완료" },
];

const STEP_TITLES: Record<PremiumSessionStep, string> = {
  article: "오늘 배워갈 것",
  "content-catch": "영상 시청하기",
  "delivery-analysis": "분석하며 듣기",
  "expression-cards": "오늘 핵심표현",
  roleplay: "말하기 연습",
  completion: "학습 마치기",
};

interface PremiumSessionScreenProps {
  session: PremiumSession;
}

function formatSeconds(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = `${rounded % 60}`.padStart(2, "0");
  return `${minutes}:${rest}`;
}

function StepRail({
  activeStep,
  onSelect,
}: {
  activeStep: PremiumSessionStep;
  onSelect: (step: PremiumSessionStep) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.stepRail}
    >
      {STEPS.map((step) => {
        const active = step.id === activeStep;
        return (
          <Pressable
            key={step.id}
            style={[styles.stepPill, active && styles.stepPillActive]}
            onPress={() => onSelect(step.id)}
          >
            <Text style={[styles.stepText, active && styles.stepTextActive]}>
              {step.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function VideoPanel({
  session,
  playerRef,
  playing,
  activeLine,
  activeStep,
  showTranslation,
  onTogglePlaying,
  onToggleTranslation,
  onPreviousStep,
  onNextStep,
}: {
  session: PremiumSession;
  playerRef: React.RefObject<YouTubePlayerHandle>;
  playing: boolean;
  activeLine: PremiumTranscriptLine | null;
  activeStep: PremiumSessionStep;
  showTranslation: boolean;
  onTogglePlaying: () => void;
  onToggleTranslation: () => void;
  onPreviousStep: () => void;
  onNextStep: () => void;
}) {
  return (
    <View style={styles.videoHero}>
      <YouTubePlayer
        ref={playerRef}
        videoId={session.source_video_id}
        playing={playing}
        startSeconds={session.segment_start_time}
      />
      <View pointerEvents="none" style={styles.videoTopFade} />
      <View pointerEvents="none" style={styles.videoBottomFade} />

      <View style={styles.videoTopBar}>
        <View style={styles.heroIconButton}>
          <Ionicons name="close" size={22} color={colors.textPremium} />
        </View>
        <View style={styles.videoTitlePill}>
          <Text numberOfLines={1} style={styles.videoTitleText}>
            {STEP_TITLES[activeStep]}
          </Text>
          <Ionicons name="chevron-down" size={18} color={colors.textPremium} />
        </View>
      </View>

      <View style={styles.videoBottomBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="자막 표시 전환"
          style={styles.heroControlButton}
          onPress={onToggleTranslation}
        >
          <Ionicons
            name={showTranslation ? "reader" : "reader-outline"}
            size={22}
            color={colors.textPremium}
          />
        </Pressable>
        <View style={styles.heroTransport}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="이전 단계"
            style={styles.transportButton}
            onPress={onPreviousStep}
          >
            <Ionicons
              name="play-skip-back"
              size={24}
              color={colors.textPremiumSecondary}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={playing ? "영상 일시정지" : "영상 재생"}
            style={styles.heroPlayButton}
            onPress={onTogglePlaying}
          >
            <Ionicons
              name={playing ? "pause" : "play"}
              size={42}
              color={colors.textPremium}
            />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="다음 단계"
            style={styles.transportButton}
            onPress={onNextStep}
          >
            <Ionicons
              name="play-skip-forward"
              size={24}
              color={colors.textPremiumSecondary}
            />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="해석 표시 전환"
          style={styles.heroControlButton}
          onPress={onToggleTranslation}
        >
          <Ionicons
            name="language"
            size={24}
            color={
              showTranslation ? colors.textPremium : colors.textPremiumMuted
            }
          />
        </Pressable>
      </View>

      <Text style={styles.videoTimestamp}>
        {formatSeconds(activeLine?.startTime ?? session.segment_start_time)}
      </Text>
    </View>
  );
}

function ArticleReader({ session }: { session: PremiumSession }) {
  return (
    <ScrollView
      testID="premium-article-reader"
      contentContainerStyle={styles.panelScroll}
    >
      <Text style={styles.eyebrow}>오늘 배워갈 것</Text>
      <Text style={styles.articleTitle}>{session.article.title}</Text>
      {session.article.subtitle ? (
        <Text style={styles.articleSubtitle}>{session.article.subtitle}</Text>
      ) : null}
      <Text style={styles.articleBody}>{session.article.body}</Text>
      {session.article.summary_bullets?.length ? (
        <View style={styles.summaryBox}>
          {session.article.summary_bullets.map((item) => (
            <Text key={item} style={styles.summaryText}>
              {item}
            </Text>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

function TranscriptPanel({
  session,
  activeLine,
  showTranslation,
  onToggleTranslation,
  onSeek,
}: {
  session: PremiumSession;
  activeLine: PremiumTranscriptLine | null;
  showTranslation: boolean;
  onToggleTranslation: () => void;
  onSeek: (line: PremiumTranscriptLine) => void;
}) {
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    const index = getPremiumTranscriptScrollIndex(
      session.transcript,
      activeLine?.id,
    );
    scrollRef.current?.scrollTo({
      y: index * 88,
      animated: true,
    });
  }, [activeLine?.id, session.transcript]);

  return (
    <ScrollView ref={scrollRef} contentContainerStyle={styles.panelScroll}>
      <View style={styles.sectionHeaderRow}>
        <View>
          <Text style={styles.eyebrow}>내용 캐치</Text>
          <Text style={styles.sectionTitle}>영상 시청하기</Text>
        </View>
        <Pressable style={styles.smallToggle} onPress={onToggleTranslation}>
          <Text style={styles.smallToggleText}>
            {showTranslation ? "해석 켬" : "해석 끔"}
          </Text>
        </Pressable>
      </View>
      {session.transcript.map((line) => {
        const active = activeLine?.id === line.id;
        const hasTranslation = showTranslation && Boolean(line.translation);
        return (
          <Pressable
            key={line.id}
            testID={active ? "premium-active-transcript-line" : undefined}
            style={[
              styles.transcriptLine,
              !active && styles.transcriptLineInactive,
              active && styles.transcriptLineActive,
            ]}
            onPress={() => onSeek(line)}
          >
            {hasTranslation ? (
              <Text
                style={[
                  styles.transcriptText,
                  active && styles.transcriptTextActive,
                ]}
              >
                {line.translation}
              </Text>
            ) : null}
            <Text
              style={[
                hasTranslation ? styles.translationText : styles.transcriptText,
                active &&
                  (hasTranslation
                    ? styles.translationTextActive
                    : styles.transcriptTextActive),
              ]}
            >
              {line.text}
            </Text>
            {!showTranslation && line.translation ? (
              <Text style={styles.translationHiddenHint}>해석 숨김</Text>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function PremiumSessionScreen({
  session,
}: PremiumSessionScreenProps) {
  const playerRef = useRef<YouTubePlayerHandle>(null);
  const [activeStep, setActiveStep] = useState<PremiumSessionStep>("article");
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(session.segment_start_time);
  const [showTranslation, setShowTranslation] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      if (!playing) return;
      playerRef.current
        ?.getCurrentTime()
        .then((nextTime) => setCurrentTime(nextTime))
        .catch(() => undefined);
    }, PREMIUM_TRANSCRIPT_SYNC_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [playing]);

  const activeLine = useMemo(
    () => findPremiumActiveTranscriptLine(session.transcript, currentTime),
    [currentTime, session.transcript],
  );

  useEffect(() => {
    if (activeStep !== "completion") {
      markPremiumSessionInProgress(session.id, activeStep);
    }
  }, [activeStep, session.id]);

  function seekToLine(line: PremiumTranscriptLine) {
    playerRef.current?.seekTo(line.startTime, true);
    setCurrentTime(line.startTime);
    setPlaying(true);
  }

  function moveStep(direction: -1 | 1) {
    const index = STEPS.findIndex((step) => step.id === activeStep);
    const nextStep = STEPS[index + direction];
    if (nextStep) {
      setActiveStep(nextStep.id);
    }
  }

  return (
    <View style={styles.root}>
      <VideoPanel
        session={session}
        playerRef={playerRef}
        playing={playing}
        activeLine={activeLine}
        activeStep={activeStep}
        showTranslation={showTranslation}
        onTogglePlaying={() => setPlaying((prev) => !prev)}
        onToggleTranslation={() => setShowTranslation((prev) => !prev)}
        onPreviousStep={() => moveStep(-1)}
        onNextStep={() => moveStep(1)}
      />

      <StepRail activeStep={activeStep} onSelect={setActiveStep} />

      <View style={styles.content}>
        {activeStep === "article" ? <ArticleReader session={session} /> : null}
        {activeStep === "content-catch" ? (
          <TranscriptPanel
            session={session}
            activeLine={activeLine}
            showTranslation={showTranslation}
            onToggleTranslation={() => setShowTranslation((prev) => !prev)}
            onSeek={seekToLine}
          />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bgDark,
  },
  header: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.sm,
  },
  headerKicker: {
    color: colors.textPremiumMuted,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
    letterSpacing: font.tracking.normal,
  },
  headerTitle: {
    color: colors.textPremium,
    fontSize: font.size["2xl"],
    lineHeight: leading(font.size["2xl"], font.lineHeight.tight),
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.normal,
  },
  headerSubtitle: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.relaxed),
    fontWeight: font.weight.regular,
  },
  videoHero: {
    height: 396,
    width: "100%",
    overflow: "hidden",
    backgroundColor: colors.bgDark,
  },
  videoTopFade: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 160,
    backgroundColor: colors.bgPremiumOverlay,
    opacity: 0.46,
  },
  videoBottomFade: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    height: 196,
    backgroundColor: colors.bgPremiumOverlay,
  },
  videoTopBar: {
    position: "absolute",
    top: spacing["2xl"] + spacing.xs,
    left: spacing.xl,
    right: spacing.xl,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroIconButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderOnDarkStrong,
    backgroundColor: colors.bgPremiumControl,
  },
  videoTitlePill: {
    maxWidth: 212,
    minHeight: 48,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderOnDarkStrong,
    backgroundColor: colors.bgPremiumControl,
    paddingHorizontal: spacing.lg,
  },
  videoTitleText: {
    color: colors.textPremium,
    fontSize: font.size.lg,
    lineHeight: leading(font.size.lg, font.lineHeight.tight),
    fontWeight: font.weight.semibold,
  },
  videoBottomBar: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing.lg,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  heroControlButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  heroTransport: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  transportButton: {
    width: 48,
    height: 48,
    alignItems: "center",
    justifyContent: "center",
  },
  heroPlayButton: {
    width: 80,
    height: 80,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
  },
  videoTimestamp: {
    position: "absolute",
    left: spacing.xl,
    bottom: 112,
    color: colors.textPremiumMuted,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
  },
  stepRail: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.sm,
  },
  stepPill: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderPremium,
    backgroundColor: colors.bgPremiumCard,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  stepPillActive: {
    backgroundColor: colors.textPremium,
    borderColor: colors.textPremium,
  },
  stepText: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.sm,
    fontWeight: font.weight.semibold,
  },
  stepTextActive: {
    color: colors.bgDark,
  },
  content: {
    flex: 1,
  },
  panelScroll: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing["2xl"],
    gap: spacing.md,
  },
  eyebrow: {
    color: colors.textPremiumMuted,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.normal,
  },
  articleTitle: {
    color: colors.textPremium,
    fontSize: font.size["3xl"],
    lineHeight: leading(font.size["3xl"], font.lineHeight.tight),
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.normal,
  },
  articleSubtitle: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
    fontWeight: font.weight.medium,
  },
  articleBody: {
    color: colors.textPremium,
    fontSize: font.size.base,
    lineHeight: leading(font.size.base, font.lineHeight.loose),
    fontWeight: font.weight.regular,
  },
  summaryBox: {
    gap: spacing.sm,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.borderPremium,
    backgroundColor: colors.bgPremiumCard,
    padding: spacing.lg,
  },
  summaryText: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: spacing.md,
  },
  sectionTitle: {
    color: colors.textPremium,
    fontSize: font.size.xl,
    lineHeight: leading(font.size.xl, font.lineHeight.tight),
    fontWeight: font.weight.bold,
    letterSpacing: font.tracking.normal,
  },
  smallToggle: {
    borderRadius: radius.pill,
    backgroundColor: colors.bgPremiumControl,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  smallToggleText: {
    color: colors.textPremium,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  transcriptLine: {
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  transcriptLineInactive: {
    opacity: 0.46,
  },
  transcriptLineActive: {
    opacity: 1,
  },
  transcriptText: {
    color: colors.textPremium,
    fontSize: font.size.xl,
    lineHeight: leading(font.size.xl, font.lineHeight.tight),
    fontWeight: font.weight.semibold,
  },
  transcriptTextActive: {
    color: colors.textPremium,
    fontSize: font.size["2xl"],
    lineHeight: leading(font.size["2xl"], font.lineHeight.tight),
  },
  translationText: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.tight),
    fontWeight: font.weight.semibold,
  },
  translationTextActive: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.lg,
    lineHeight: leading(font.size.lg, font.lineHeight.tight),
  },
  translationHiddenHint: {
    color: colors.textPremiumMuted,
    fontSize: font.size.xs,
    fontWeight: font.weight.semibold,
  },
  analysisCard: {
    gap: spacing.md,
    borderRadius: radius["2xl"],
    backgroundColor: colors.bgPremiumCardStrong,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.borderPremium,
  },
  sourceLine: {
    color: colors.textPremium,
    fontSize: font.size.xl,
    lineHeight: leading(font.size.xl, font.lineHeight.relaxed),
    fontWeight: font.weight.bold,
  },
  analysisBody: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
  },
  deliveryNote: {
    color: colors.textPremium,
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.relaxed),
    fontWeight: font.weight.semibold,
  },
  emptyText: {
    color: colors.textPremiumMuted,
    fontSize: font.size.md,
  },
  expressionCard: {
    minHeight: 560,
    gap: spacing.lg,
    borderRadius: radius["2xl"],
    backgroundColor: colors.bgPremiumCardStrong,
    padding: spacing.lg,
  },
  expressionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  expressionDepth: {
    color: colors.textPremiumMuted,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  expressionTimestamp: {
    color: colors.textPremiumMuted,
    fontSize: font.size.sm,
    fontWeight: font.weight.medium,
  },
  expressionTitle: {
    color: colors.textPremium,
    fontSize: font.size["2xl"],
    lineHeight: leading(font.size["2xl"], font.lineHeight.tight),
    fontWeight: font.weight.bold,
  },
  expressionMeaning: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
    fontWeight: font.weight.semibold,
  },
  expressionSource: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
    fontStyle: "italic",
  },
  expressionSourceBox: {
    gap: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.bgPremiumCard,
    padding: spacing.md,
  },
  sourcePlayIcon: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.bgPremiumControl,
  },
  sourceCopy: {
    gap: spacing.sm,
  },
  expressionSourceMeaning: {
    color: colors.textPremiumMuted,
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.relaxed),
    fontWeight: font.weight.medium,
  },
  storyText: {
    color: colors.textPremium,
    fontSize: font.size.base,
    lineHeight: leading(font.size.md, font.lineHeight.loose),
  },
  expressionTabs: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  expressionTab: {
    flex: 1,
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.bgPremiumCard,
    paddingVertical: spacing.sm,
  },
  expressionTabActive: {
    backgroundColor: colors.textPremium,
  },
  expressionTabText: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  expressionTabTextActive: {
    color: colors.bgDark,
  },
  detailBox: {
    gap: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.bgPremiumCard,
    padding: spacing.md,
  },
  roleplayCueBox: {
    gap: spacing.md,
    borderRadius: radius.xl,
    backgroundColor: colors.bgPremiumCard,
    borderWidth: 1,
    borderColor: colors.borderPremium,
    padding: spacing.md,
  },
  roleplayCueItem: {
    gap: spacing.xs,
  },
  pronunciationCoachBox: {
    gap: spacing.sm,
    borderRadius: radius.xl,
    backgroundColor: colors.bgPremiumCard,
    borderWidth: 1,
    borderColor: colors.borderPremium,
    padding: spacing.md,
  },
  pronunciationCoachItem: {
    gap: spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderPremium,
    paddingBottom: spacing.sm,
  },
  pronunciationCoachLabel: {
    color: colors.textPremium,
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.tight),
    fontWeight: font.weight.bold,
  },
  wordIssueList: {
    gap: spacing.xs,
  },
  detailText: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.relaxed),
  },
  drillText: {
    color: colors.textPremium,
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
    fontWeight: font.weight.semibold,
  },
  variationItem: {
    gap: spacing.xs,
  },
  variationEn: {
    color: colors.textPremium,
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
    fontWeight: font.weight.bold,
  },
  roleplayList: {
    gap: spacing.sm,
  },
  roleplayStageRail: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  roleplayStagePill: {
    flex: 1,
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.bgPremiumCard,
    paddingVertical: spacing.sm,
  },
  roleplayStagePillActive: {
    backgroundColor: colors.textPremium,
  },
  roleplayStageText: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
  },
  roleplayStageTextActive: {
    color: colors.bgDark,
  },
  roleplayToggleRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  roleplayToggle: {
    flex: 1,
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderPremium,
    paddingVertical: spacing.sm,
  },
  roleplayToggleActive: {
    borderColor: colors.textPremium,
    backgroundColor: colors.bgPremiumCardStrong,
  },
  roleplayToggleText: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.sm,
    fontWeight: font.weight.bold,
  },
  roleplayToggleTextActive: {
    color: colors.textPremium,
  },
  roleplayTurn: {
    alignSelf: "flex-start",
    maxWidth: "88%",
    gap: spacing.xs,
    borderRadius: radius.xl,
    backgroundColor: colors.bgPremiumCard,
    padding: spacing.md,
  },
  roleplayTurnUser: {
    alignSelf: "flex-end",
    backgroundColor: colors.bgPremiumCardStrong,
  },
  roleplaySpeaker: {
    color: colors.textPremiumMuted,
    fontSize: font.size.xs,
    fontWeight: font.weight.bold,
  },
  roleplayText: {
    color: colors.textPremium,
    fontSize: font.size.md,
    lineHeight: leading(font.size.md, font.lineHeight.relaxed),
  },
  roleplayTranslationText: {
    color: colors.textPremiumSecondary,
    fontSize: font.size.sm,
    lineHeight: leading(font.size.sm, font.lineHeight.relaxed),
  },
  recordButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.textPremium,
    paddingVertical: spacing.md,
  },
  recordButtonText: {
    color: colors.bgDark,
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
  },
  secondaryButton: {
    alignItems: "center",
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderPremium,
    paddingVertical: spacing.md,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  secondaryButtonText: {
    color: colors.textPremium,
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
  },
  scoreText: {
    color: colors.textPremium,
    fontSize: font.size["3xl"],
    fontWeight: font.weight.bold,
  },
  completion: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing["3xl"],
  },
  completionTitle: {
    color: colors.textPremium,
    textAlign: "center",
    fontSize: font.size["3xl"],
    lineHeight: leading(font.size["3xl"], font.lineHeight.tight),
    fontWeight: font.weight.bold,
  },
  completionBody: {
    color: colors.textPremiumSecondary,
    textAlign: "center",
    fontSize: font.size.lg,
    lineHeight: leading(font.size.lg, font.lineHeight.tight),
    fontWeight: font.weight.semibold,
  },
  completionButton: {
    position: "absolute",
    left: spacing.xl,
    right: spacing.xl,
    bottom: spacing["2xl"],
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius.pill,
    backgroundColor: colors.bgPremiumControl,
    paddingVertical: spacing.md,
  },
  completionButtonText: {
    color: colors.textPremium,
    fontSize: font.size.base,
    fontWeight: font.weight.bold,
  },
});
