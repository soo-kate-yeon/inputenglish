// @MX:NOTE: [AUTO] v1.3 CI session player — reading + video segments + highlight question agent.
// @MX:SPEC: SPEC-INPUT-001 - REQ-INPUT-002/003/004/005 (session assembly + return-to-flow)
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type {
  AskedItemSourceRef,
  ReadingPiece,
  VideoSegment,
} from "@inputenglish/shared";
import { Button, createThemedStyles, useTheme } from "@/components/ui";
import {
  askHighlightQuestion,
  type QuestionResponse,
  type TodayCiSessionShape,
} from "@/lib/premium-api";
import ArticleReader from "./ArticleReader";
import SegmentPlayer from "./SegmentPlayer";

interface CiSessionScreenProps {
  session: TodayCiSessionShape;
  remainingQuestionCap: number;
  onClose: () => void;
}

type Step =
  | { kind: "reading"; label: string; piece: ReadingPiece }
  | { kind: "segment"; label: string; segment: VideoSegment };

function buildSteps(session: TodayCiSessionShape): Step[] {
  const steps: Step[] = [];
  if (session.readingPiece) {
    steps.push({ kind: "reading", label: "읽기", piece: session.readingPiece });
  }
  session.segments.forEach((segment, index) => {
    steps.push({ kind: "segment", label: `영상 ${index + 1}`, segment });
  });
  return steps;
}

interface PendingQuestion {
  highlightText: string;
  sourceType: "reading" | "segment";
  sourceRef: AskedItemSourceRef;
}

export default function CiSessionScreen({
  session,
  remainingQuestionCap,
  onClose,
}: CiSessionScreenProps) {
  const theme = useTheme();
  const styles = getStyles(theme);
  const insets = useSafeAreaInsets();

  const steps = useMemo(() => buildSteps(session), [session]);
  const [stepIndex, setStepIndex] = useState(0);
  const [cap, setCap] = useState(remainingQuestionCap);

  const [pending, setPending] = useState<PendingQuestion | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<QuestionResponse | null>(null);
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState<string | null>(null);

  const step = steps[stepIndex];

  const openQuestion = useCallback((next: PendingQuestion) => {
    setPending(next);
    setQuestion("");
    setAnswer(null);
    setAskError(null);
  }, []);

  const closeSheet = useCallback(() => setPending(null), []);

  const handleReadingWordTap = useCallback(
    (lemma: string, piece: ReadingPiece) => {
      openQuestion({
        highlightText: lemma,
        sourceType: "reading",
        sourceRef: { type: "reading", pieceId: piece.id },
      });
    },
    [openQuestion],
  );

  const handleSegmentWordTap = useCallback(
    (lemma: string, segment: VideoSegment) => {
      openQuestion({
        highlightText: lemma,
        sourceType: "segment",
        sourceRef: { type: "segment", pieceId: segment.id },
      });
    },
    [openQuestion],
  );

  const submitQuestion = useCallback(async () => {
    if (!pending) return;
    setAsking(true);
    setAskError(null);
    try {
      const res = await askHighlightQuestion({
        highlightText: pending.highlightText,
        question: question.trim() || "이게 무슨 뜻이야?",
        sourceType: pending.sourceType,
        sourceRef: pending.sourceRef,
      });
      setAnswer(res);
      setCap(res.remainingCap);
    } catch (error) {
      setAskError(
        error instanceof Error ? error.message : "질문에 실패했어요.",
      );
    } finally {
      setAsking(false);
    }
  }, [pending, question]);

  const goNext = useCallback(
    () => setStepIndex((i) => Math.min(i + 1, steps.length - 1)),
    [steps.length],
  );
  const goPrev = useCallback(() => setStepIndex((i) => Math.max(i - 1, 0)), []);

  const isLast = stepIndex === steps.length - 1;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="닫기"
          testID="ci-session-close"
          hitSlop={12}
          onPress={onClose}
          style={styles.closeButton}
        >
          <Text style={styles.closeIcon}>✕</Text>
        </Pressable>
        <Text style={styles.headerTitle}>오늘의 세션</Text>
        <View style={styles.capPill}>
          <Text style={styles.capText}>질문 {cap}개</Text>
        </View>
      </View>

      {steps.length > 1 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.stepBar}
        >
          {steps.map((s, index) => {
            const active = index === stepIndex;
            return (
              <Pressable
                key={`${s.kind}-${index}`}
                onPress={() => setStepIndex(index)}
                style={[styles.stepChip, active && styles.stepChipActive]}
              >
                <Text
                  style={[
                    styles.stepChipText,
                    active && styles.stepChipTextActive,
                  ]}
                >
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      <View style={styles.body}>
        {step?.kind === "reading" ? (
          <ArticleReader
            piece={step.piece}
            onWordTap={(lemma) => handleReadingWordTap(lemma, step.piece)}
          />
        ) : step?.kind === "segment" ? (
          <SegmentPlayer
            segment={step.segment}
            onWordTap={(lemma) => handleSegmentWordTap(lemma, step.segment)}
            onEnd={goNext}
          />
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>오늘 학습할 콘텐츠가 없어요</Text>
          </View>
        )}
      </View>

      <View
        style={[
          styles.footer,
          { paddingBottom: insets.bottom + theme.spacing[3] },
        ]}
      >
        <Pressable
          onPress={goPrev}
          disabled={stepIndex === 0}
          style={[
            styles.navButton,
            stepIndex === 0 && styles.navButtonDisabled,
          ]}
        >
          <Text style={styles.navButtonText}>이전</Text>
        </Pressable>
        <View style={styles.dots}>
          {steps.map((_, index) => (
            <View
              key={index}
              style={[styles.dot, index === stepIndex && styles.dotActive]}
            />
          ))}
        </View>
        <Pressable
          onPress={isLast ? onClose : goNext}
          style={styles.navButtonPrimary}
        >
          <Text style={styles.navButtonPrimaryText}>
            {isLast ? "완료" : "다음"}
          </Text>
        </Pressable>
      </View>

      <Modal
        visible={pending !== null}
        transparent
        animationType="fade"
        onRequestClose={closeSheet}
      >
        <View style={styles.modalRoot}>
          <Pressable
            style={styles.scrim}
            accessibilityLabel="질문 닫기"
            onPress={closeSheet}
          />
          <View
            style={[
              styles.sheet,
              { paddingBottom: insets.bottom + theme.spacing[4] },
            ]}
          >
            <Text style={styles.sheetEyebrow}>하이라이트 질문</Text>
            <Text style={styles.sheetHighlight}>
              "{pending?.highlightText}"
            </Text>
            {answer ? (
              <View style={styles.answerBlock}>
                <Text style={styles.answerText}>{answer.answer}</Text>
                {answer.capNotice ? (
                  <Text style={styles.capNotice}>{answer.capNotice}</Text>
                ) : null}
                <Button label="닫고 계속" onPress={closeSheet} />
              </View>
            ) : (
              <>
                <TextInput
                  style={styles.input}
                  placeholder="무엇이 궁금한가요? (비우면 뜻 풀이)"
                  placeholderTextColor={theme.colors.text.tertiary}
                  value={question}
                  onChangeText={setQuestion}
                  editable={!asking}
                  multiline
                />
                {askError ? (
                  <Text style={styles.errorText}>{askError}</Text>
                ) : null}
                <Button
                  label={asking ? "질문 중…" : "질문하기"}
                  onPress={submitQuestion}
                  disabled={asking}
                />
                {asking ? (
                  <ActivityIndicator color={theme.colors.text.primary} />
                ) : null}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const getStyles = createThemedStyles((theme) => ({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background.canvas,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    gap: theme.spacing[3],
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: theme.radius.full,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: theme.colors.surface.muted,
  },
  closeIcon: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
  },
  headerTitle: {
    ...theme.typography.bodyStrong,
    color: theme.colors.text.primary,
    flex: 1,
    textAlign: "center",
  },
  capPill: {
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.surface.muted,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[1],
  },
  capText: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  stepBar: {
    flexDirection: "row",
    gap: theme.spacing[2],
    paddingHorizontal: theme.spacing[4],
    paddingBottom: theme.spacing[2],
  },
  stepChip: {
    borderRadius: theme.radius.full,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    backgroundColor: theme.colors.surface.muted,
  },
  stepChipActive: {
    backgroundColor: theme.colors.action.primary,
  },
  stepChipText: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
  },
  stepChipTextActive: {
    color: theme.colors.text.inverse,
  },
  body: {
    flex: 1,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: theme.spacing[6],
  },
  emptyText: {
    ...theme.typography.body,
    color: theme.colors.text.secondary,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.spacing[4],
    paddingTop: theme.spacing[3],
    gap: theme.spacing[3],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border.default,
  },
  navButton: {
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.full,
  },
  navButtonDisabled: {
    opacity: 0.4,
  },
  navButtonText: {
    ...theme.typography.button,
    color: theme.colors.text.secondary,
  },
  navButtonPrimary: {
    paddingHorizontal: theme.spacing[6],
    paddingVertical: theme.spacing[2],
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.action.primary,
  },
  navButtonPrimaryText: {
    ...theme.typography.button,
    color: theme.colors.text.inverse,
  },
  dots: {
    flexDirection: "row",
    gap: theme.spacing[2],
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.border.default,
  },
  dotActive: {
    backgroundColor: theme.colors.text.primary,
  },
  modalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: theme.colors.background.canvas,
    opacity: 0.7,
  },
  sheet: {
    backgroundColor: theme.colors.surface.base,
    borderTopLeftRadius: theme.radius.lg,
    borderTopRightRadius: theme.radius.lg,
    padding: theme.spacing[6],
    gap: theme.spacing[3],
  },
  sheetEyebrow: {
    ...theme.typography.label,
    color: theme.colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  sheetHighlight: {
    ...theme.typography.title,
    color: theme.colors.text.primary,
  },
  input: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
    borderWidth: 1,
    borderColor: theme.colors.border.default,
    borderRadius: theme.radius.lg,
    paddingHorizontal: theme.spacing[4],
    paddingVertical: theme.spacing[3],
    minHeight: 56,
  },
  answerBlock: {
    gap: theme.spacing[3],
  },
  answerText: {
    ...theme.typography.body,
    color: theme.colors.text.primary,
  },
  capNotice: {
    ...theme.typography.caption,
    color: theme.colors.text.secondary,
  },
  errorText: {
    ...theme.typography.caption,
    color: theme.colors.text.primary,
  },
}));
