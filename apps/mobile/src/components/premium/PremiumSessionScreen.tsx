import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type {
  PremiumExpressionCard,
  PremiumSession,
  PremiumSessionStep,
  PremiumTranscriptLine,
  PremiumDeliveryAnalysis,
  PronunciationAnalysisJob,
  PronunciationFeedback,
} from "@inputenglish/shared";
import YouTubePlayer, {
  type YouTubePlayerHandle,
} from "@/components/player/YouTubePlayer";
import useAudioRecorder from "@/hooks/useAudioRecorder";
import {
  requestPronunciationAnalysis,
  uploadRecording,
  waitForPronunciationAnalysisCompletion,
} from "@/lib/ai-api";
import {
  findPremiumActiveTranscriptLine,
  getPremiumTranscriptScrollIndex,
  PREMIUM_TRANSCRIPT_SYNC_INTERVAL_MS,
} from "@/lib/premium-transcript-sync";
import {
  markPremiumSessionCompleted,
  markPremiumSessionInProgress,
} from "@/lib/premium-session-progress";
import { useAuth } from "@/contexts/AuthContext";
import { colors, font, leading, radius, spacing } from "@/theme";
import RecordingBar from "@/components/shadowing/RecordingBar";
import { persistPremiumCompletionAssets } from "@/lib/premium-completion";

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

function DeliveryAnalysisPanel({
  activeLine,
  transcript,
  deliveryAnalysis,
}: {
  activeLine: PremiumTranscriptLine | null;
  transcript: PremiumTranscriptLine[];
  deliveryAnalysis: PremiumDeliveryAnalysis[];
}) {
  const activeAnalysis =
    activeLine &&
    deliveryAnalysis.find((analysis) => analysis.line_id === activeLine.id);
  const targetAnalysis = activeAnalysis || deliveryAnalysis[0] || null;
  const target =
    (targetAnalysis
      ? transcript.find((line) => line.id === targetAnalysis.line_id)
      : null) ??
    activeLine ??
    transcript[0] ??
    null;
  return (
    <ScrollView
      testID="premium-delivery-analysis"
      contentContainerStyle={styles.panelScroll}
    >
      <Text style={styles.eyebrow}>분석하며 듣기</Text>
      <Text style={styles.sectionTitle}>말의 태도를 잡는 구간</Text>
      {target ? (
        <View style={styles.analysisCard}>
          <Text style={styles.sourceLine}>{target.text}</Text>
          <Text style={styles.analysisBody}>
            {targetAnalysis?.style_note ??
              target.analysis_note ??
              "이 문장은 단어 뜻보다 말하는 태도가 중요해요. 화자가 어디에 힘을 싣고 어디에서 낮추는지 들어보세요."}
          </Text>
          {targetAnalysis?.intonation_note || target.delivery_note ? (
            <Text style={styles.deliveryNote}>
              {targetAnalysis?.intonation_note ?? target.delivery_note}
            </Text>
          ) : null}
          {targetAnalysis?.coaching_note ? (
            <Text style={styles.detailText}>
              {targetAnalysis.coaching_note}
            </Text>
          ) : null}
        </View>
      ) : (
        <Text style={styles.emptyText}>분석할 자막이 아직 없어요.</Text>
      )}
    </ScrollView>
  );
}

function ExpressionCardView({ card }: { card: PremiumExpressionCard }) {
  const [tab, setTab] = useState<"sound" | "variation" | "save">("sound");
  const canShowVariations =
    card.depth === "anchor" && card.variations.length > 0;
  const tabItems: Array<{
    id: "sound" | "variation" | "save";
    label: string;
  }> = [
    { id: "sound", label: "소리" },
    ...(canShowVariations ? [{ id: "variation" as const, label: "응용" }] : []),
    { id: "save", label: "복습 저장" },
  ];

  return (
    <View
      style={styles.expressionCard}
      testID={`premium-expression-card-${card.depth}`}
    >
      <View style={styles.expressionTopRow}>
        <Text style={styles.expressionDepth}>
          {card.depth === "anchor" ? "핵심 표현" : "보조 표현"}
        </Text>
        <Text style={styles.expressionTimestamp}>{card.timestamp}</Text>
      </View>
      <Text style={styles.expressionTitle}>{card.expression}</Text>
      <Text style={styles.expressionMeaning}>{card.natural_meaning_ko}</Text>
      <View style={styles.expressionSourceBox}>
        <View style={styles.sourcePlayIcon}>
          <Ionicons name="play" size={24} color={colors.textPremium} />
        </View>
        <View style={styles.sourceCopy}>
          <Text style={styles.expressionSource}>{card.source_line}</Text>
          <Text style={styles.expressionSourceMeaning}>
            {card.natural_meaning_ko}
          </Text>
        </View>
      </View>
      <Text
        style={styles.storyText}
        testID={`premium-expression-story-${card.depth}`}
      >
        {card.story}
      </Text>

      <View
        style={styles.expressionTabs}
        testID={`premium-expression-tabs-${card.depth}`}
      >
        {tabItems.map((item) => {
          return (
            <Pressable
              key={item.id}
              accessibilityRole="button"
              accessibilityLabel={`${card.expression} ${item.label}`}
              accessibilityState={{ selected: tab === item.id }}
              testID={`premium-expression-tab-${card.depth}-${item.id}`}
              style={[
                styles.expressionTab,
                tab === item.id && styles.expressionTabActive,
              ]}
              onPress={() => setTab(item.id)}
            >
              <Text
                style={[
                  styles.expressionTabText,
                  tab === item.id && styles.expressionTabTextActive,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {tab === "sound" ? (
        <View
          style={styles.detailBox}
          testID={`premium-expression-panel-${card.depth}-sound`}
        >
          <Text style={styles.detailText}>
            강세: {card.pronunciation.stress}
          </Text>
          <Text style={styles.detailText}>
            연음: {card.pronunciation.linking}
          </Text>
          <Text style={styles.detailText}>
            주의: {card.pronunciation.trap_ko}
          </Text>
          <Text style={styles.detailText}>IPA: {card.pronunciation.ipa}</Text>
          <Text style={styles.detailText}>{card.pronunciation.say_it_ko}</Text>
          <Text style={styles.drillText}>{card.pronunciation.drill}</Text>
        </View>
      ) : null}

      {tab === "variation" && canShowVariations ? (
        <View
          style={styles.detailBox}
          testID={`premium-expression-panel-${card.depth}-variation`}
        >
          {card.variations.map((variation) => (
            <View key={variation.en} style={styles.variationItem}>
              <Text style={styles.variationEn}>{variation.en}</Text>
              <Text style={styles.detailText}>{variation.when_ko}</Text>
            </View>
          ))}
        </View>
      ) : null}

      {tab === "save" ? (
        <View
          style={styles.detailBox}
          testID={`premium-expression-panel-${card.depth}-save`}
        >
          <Text style={styles.variationEn}>{card.saved_atoms.headword}</Text>
          <Text style={styles.detailText}>
            {card.saved_atoms.one_line_nuance_ko}
          </Text>
          <Text style={styles.detailText}>{card.saved_atoms.register_ko}</Text>
          {card.saved_atoms.examples.map((example) => (
            <Text key={example} style={styles.drillText}>
              {example}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function ExpressionCardsPanel({ session }: { session: PremiumSession }) {
  return (
    <ScrollView contentContainerStyle={styles.panelScroll}>
      <Text style={styles.eyebrow}>오늘 핵심표현</Text>
      <Text style={styles.sectionTitle}>읽고, 소리 내고, 저장하기</Text>
      {session.expression_cards.map((card) => (
        <ExpressionCardView key={card.id} card={card} />
      ))}
    </ScrollView>
  );
}

function getRoleplayTargetExpressionCards(session: PremiumSession) {
  const turnExpressionIds = session.roleplay.turns.flatMap(
    (turn) => turn.expression_ids ?? [],
  );
  const targetIds = new Set([
    ...session.roleplay.target_expression_ids,
    ...turnExpressionIds,
  ]);

  return session.expression_cards.filter(
    (card) => targetIds.has(card.id) || targetIds.has(card.expression),
  );
}

function RoleplayExpressionCues({
  cards,
  mode,
}: {
  cards: PremiumExpressionCard[];
  mode: "speak" | "analysis";
}) {
  if (cards.length === 0) return null;

  return (
    <View
      style={styles.roleplayCueBox}
      testID={`premium-roleplay-${mode}-expression-cues`}
    >
      <Text style={styles.expressionDepth}>
        {mode === "speak" ? "발화 큐" : "분석 큐"}
      </Text>
      {cards.map((card) => (
        <View key={card.id} style={styles.roleplayCueItem}>
          <Text style={styles.variationEn}>{card.expression}</Text>
          <Text style={styles.detailText}>{card.pronunciation.say_it_ko}</Text>
          <Text style={styles.drillText}>{card.pronunciation.drill}</Text>
        </View>
      ))}
    </View>
  );
}

function PronunciationCoachingNotes({
  result,
}: {
  result: PronunciationFeedback;
}) {
  const notes = [
    ["속도", result.pacing_note],
    ["끊어 읽기", result.chunking_note],
    ["강세", result.stress_note],
    ["끝맺음", result.ending_tone_note],
    ["명료도", result.clarity_note],
  ].filter((note): note is [string, string] => Boolean(note[1]));

  if (notes.length === 0 && !result.word_issues?.length) return null;

  return (
    <View
      style={styles.pronunciationCoachBox}
      testID="premium-roleplay-pronunciation-coaching"
    >
      <Text style={styles.expressionDepth}>코칭 노트</Text>
      {notes.map(([label, note]) => (
        <View key={label} style={styles.pronunciationCoachItem}>
          <Text style={styles.pronunciationCoachLabel}>{label}</Text>
          <Text style={styles.detailText}>{note}</Text>
        </View>
      ))}
      {result.word_issues?.length ? (
        <View style={styles.wordIssueList}>
          {result.word_issues.map((issue) => (
            <Text
              key={`${issue.word}-${issue.error_type}`}
              style={styles.detailText}
            >
              {issue.word}
              {typeof issue.accuracy_score === "number"
                ? ` ${Math.round(issue.accuracy_score)}점`
                : ""}
              {issue.error_type ? ` · ${issue.error_type}` : ""}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function RoleplayPanel({ session }: { session: PremiumSession }) {
  const { user } = useAuth();
  const recorder = useAudioRecorder();
  const [roleplayStage, setRoleplayStage] = useState<
    "start" | "listen" | "speak" | "analysis"
  >("start");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [analysis, setAnalysis] = useState<PronunciationAnalysisJob | null>(
    null,
  );
  const [showRoleplayScript, setShowRoleplayScript] = useState(false);
  const [showRoleplayTranslation, setShowRoleplayTranslation] = useState(false);
  const referenceText =
    session.roleplay.analysis_reference_text ??
    session.roleplay.turns.find((turn) => turn.speaker === "user")
      ?.reference_text ??
    "";
  const roleplayExpressionCards = useMemo(
    () => getRoleplayTargetExpressionCards(session),
    [session],
  );

  async function handleRecordPress() {
    if (recorder.recordingState === "recording") {
      await recorder.stopRecording();
      return;
    }
    await recorder.startRecording();
  }

  async function submitRecording() {
    if (!recorder.audioUri) {
      Alert.alert("녹음이 필요해요", "먼저 답변을 녹음해 주세요.");
      return;
    }
    if (!referenceText) {
      Alert.alert("분석 문장이 없어요", "roleplay reference_text가 필요해요.");
      return;
    }

    setIsSubmitting(true);
    setAnalysis(null);
    try {
      const webApiConfigured = Boolean(
        process.env.EXPO_PUBLIC_WEB_API_URL?.trim(),
      );
      const recordingUrl =
        user?.id && webApiConfigured
          ? await uploadRecording(
              recorder.audioUri,
              user.id,
              session.source_video_id,
              `${session.id}-roleplay`,
              recorder.duration,
            )
          : "https://example.com/simulator-premium-roleplay.m4a";

      const job = await requestPronunciationAnalysis({
        recordingUrl,
        referenceText,
        sentenceId: `${session.id}-roleplay`,
        videoId: session.source_video_id,
        sessionId: null,
        premiumSessionId: session.id,
        source: "premium-roleplay",
      });
      const completed = await waitForPronunciationAnalysisCompletion(
        job.analysis_id,
      );
      setAnalysis(completed);
      setRoleplayStage("analysis");
    } catch (error) {
      Alert.alert(
        "분석 실패",
        error instanceof Error ? error.message : "발음 분석에 실패했어요.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <ScrollView contentContainerStyle={styles.panelScroll}>
      <Text style={styles.eyebrow}>말하기 연습</Text>
      <Text style={styles.sectionTitle}>{session.roleplay.title}</Text>
      <Text style={styles.articleSubtitle}>{session.roleplay.situation}</Text>

      <View
        style={styles.roleplayStageRail}
        testID="premium-roleplay-stage-rail"
      >
        {[
          ["start", "시작"],
          ["listen", "듣기"],
          ["speak", "발화"],
          ["analysis", "분석"],
        ].map(([stage, label]) => {
          const active = roleplayStage === stage;
          return (
            <View
              key={stage}
              style={[
                styles.roleplayStagePill,
                active && styles.roleplayStagePillActive,
              ]}
            >
              <Text
                style={[
                  styles.roleplayStageText,
                  active && styles.roleplayStageTextActive,
                ]}
              >
                {label}
              </Text>
            </View>
          );
        })}
      </View>

      {roleplayStage === "start" ? (
        <View style={styles.analysisCard} testID="premium-roleplay-start">
          <Text style={styles.analysisBody}>
            이제 짧은 롤플레잉을 통해 배운 표현을 직접 응용해 말해보세요.
          </Text>
          <Pressable
            style={styles.recordButton}
            onPress={() => setRoleplayStage("listen")}
          >
            <Text style={styles.recordButtonText}>시작하기</Text>
          </Pressable>
        </View>
      ) : null}

      {roleplayStage === "listen" ? (
        <>
          <View
            style={styles.roleplayToggleRow}
            testID="premium-roleplay-listen-toggles"
          >
            <Pressable
              accessibilityLabel="롤플레잉 스크립트 표시 전환"
              style={[
                styles.roleplayToggle,
                showRoleplayScript && styles.roleplayToggleActive,
              ]}
              onPress={() => setShowRoleplayScript((prev) => !prev)}
            >
              <Text
                style={[
                  styles.roleplayToggleText,
                  showRoleplayScript && styles.roleplayToggleTextActive,
                ]}
              >
                {showRoleplayScript ? "스크립트 끔" : "스크립트 보기"}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="롤플레잉 해석 표시 전환"
              style={[
                styles.roleplayToggle,
                showRoleplayTranslation && styles.roleplayToggleActive,
              ]}
              onPress={() => setShowRoleplayTranslation((prev) => !prev)}
            >
              <Text
                style={[
                  styles.roleplayToggleText,
                  showRoleplayTranslation && styles.roleplayToggleTextActive,
                ]}
              >
                {showRoleplayTranslation ? "해석 끔" : "해석 보기"}
              </Text>
            </Pressable>
          </View>
          <View style={styles.roleplayList} testID="premium-roleplay-listen">
            {session.roleplay.turns.map((turn) => {
              const hiddenScript = turn.hidden && !showRoleplayScript;
              const turnLine = hiddenScript
                ? "Hidden Script"
                : (turn.line ?? turn.reference_text ?? "Hidden Script");
              return (
                <View
                  key={turn.id}
                  style={[
                    styles.roleplayTurn,
                    turn.speaker === "user" && styles.roleplayTurnUser,
                  ]}
                >
                  <Text style={styles.roleplaySpeaker}>
                    {turn.avatar_label ??
                      (turn.speaker === "user" ? "You" : "Coach")}
                  </Text>
                  <Text style={styles.roleplayText}>{turnLine}</Text>
                  {showRoleplayTranslation && turn.translation ? (
                    <Text style={styles.roleplayTranslationText}>
                      {turn.translation}
                    </Text>
                  ) : null}
                </View>
              );
            })}
          </View>
          <Pressable
            style={styles.secondaryButton}
            onPress={() => setRoleplayStage("speak")}
          >
            <Text style={styles.secondaryButtonText}>내 차례로 이동</Text>
          </Pressable>
        </>
      ) : null}

      {roleplayStage === "speak" && referenceText ? (
        <>
          <View style={styles.detailBox}>
            <Text style={styles.detailText}>목표 문장</Text>
            <Text style={styles.drillText}>{referenceText}</Text>
          </View>
          <RoleplayExpressionCues
            cards={roleplayExpressionCards}
            mode="speak"
          />
        </>
      ) : null}

      {roleplayStage === "speak" ? (
        <>
          <Pressable style={styles.recordButton} onPress={handleRecordPress}>
            <Text style={styles.recordButtonText}>
              {recorder.recordingState === "recording"
                ? "녹음 종료"
                : "답변 녹음"}
            </Text>
          </Pressable>
          <RecordingBar
            recordingState={recorder.recordingState}
            duration={recorder.duration}
            isPlaying={recorder.isPlaying}
            playbackProgress={recorder.playbackProgress}
            onStop={() => void recorder.stopRecording()}
            onPlay={() => void recorder.playRecording()}
            onPause={recorder.pauseRecording}
            onReRecord={() => void recorder.resetRecording()}
            onConfirm={submitRecording}
          />
          {recorder.audioUri ? (
            <Pressable
              style={[
                styles.secondaryButton,
                isSubmitting && styles.buttonDisabled,
              ]}
              onPress={submitRecording}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator color={colors.textPremium} />
              ) : (
                <Text style={styles.secondaryButtonText}>Azure 분석 요청</Text>
              )}
            </Pressable>
          ) : null}
        </>
      ) : null}

      {roleplayStage === "analysis" && analysis?.result ? (
        <>
          <View style={styles.analysisCard}>
            <Text style={styles.expressionDepth}>Azure 발음 분석 결과</Text>
            <Text style={styles.scoreText}>
              {Math.round(analysis.result.overall_score ?? 0)}점
            </Text>
            <Text style={styles.analysisBody}>
              {analysis.result.summary ?? analysis.result.next_focus}
            </Text>
            {analysis.result.next_focus ? (
              <Text style={styles.deliveryNote}>
                {analysis.result.next_focus}
              </Text>
            ) : null}
          </View>
          <PronunciationCoachingNotes result={analysis.result} />
          <RoleplayExpressionCues
            cards={roleplayExpressionCards}
            mode="analysis"
          />
        </>
      ) : null}
    </ScrollView>
  );
}

function CompletionPanel({ session }: { session: PremiumSession }) {
  const { user } = useAuth();
  const [savedCount, setSavedCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    const finishCompletion = (count: number) => {
      markPremiumSessionCompleted(session.id, count);
      if (!cancelled) setSavedCount(count);
    };

    if (!user?.id) {
      finishCompletion(0);
      return;
    }

    persistPremiumCompletionAssets(user.id, session)
      .then((count) => {
        finishCompletion(count);
      })
      .catch(() => {
        finishCompletion(0);
      });

    return () => {
      cancelled = true;
    };
  }, [session, user?.id]);

  return (
    <View style={styles.completion} testID="premium-completion">
      <Text style={styles.completionTitle}>
        지금까지{"\n"}
        {session.expression_cards.length}개의 표현을{"\n"}
        습득하셨어요!
      </Text>
      <Text style={styles.completionBody}>
        이대로 쭉 이어나가면 영어 말하기도 단단해질 거예요.
      </Text>
      {savedCount !== null ? (
        <Text style={styles.detailText}>
          {savedCount}개의 표현이 복습 자산으로 저장됐어요.
        </Text>
      ) : null}
      <View style={styles.completionButton}>
        <Text style={styles.completionButtonText}>복습 페이지로 이동</Text>
      </View>
    </View>
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

  if (activeStep === "completion") {
    return (
      <View style={styles.root}>
        <CompletionPanel session={session} />
      </View>
    );
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
        {activeStep === "delivery-analysis" ? (
          <DeliveryAnalysisPanel
            activeLine={activeLine}
            transcript={session.transcript}
            deliveryAnalysis={session.delivery_analysis}
          />
        ) : null}
        {activeStep === "expression-cards" ? (
          <ExpressionCardsPanel session={session} />
        ) : null}
        {activeStep === "roleplay" ? <RoleplayPanel session={session} /> : null}
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
