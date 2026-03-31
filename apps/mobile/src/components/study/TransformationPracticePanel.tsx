import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type {
  PracticeCoachingSummary,
  PracticeMode,
  PracticePrompt,
  Sentence,
  SessionSpeakingFunction,
} from "@inputenglish/shared";
import {
  PRACTICE_MODE_LABELS,
  SPEAKING_FUNCTION_LABELS,
} from "../../lib/professional-labels";
import { colors, radius, font } from "../../theme";

interface TransformationPracticePanelProps {
  prompts: PracticePrompt[];
  sentences: Sentence[];
  selectedMode: PracticeMode;
  selectedSentenceId: string | null;
  draftText: string;
  speakingFunction?: SessionSpeakingFunction;
  coachingSummary: PracticeCoachingSummary | null;
  coachingLoading: boolean;
  voiceCoachingLoading: boolean;
  saveMessage: string | null;
  canRunVoiceCoaching: boolean;
  onModeChange: (mode: PracticeMode) => void;
  onSentenceChange: (sentenceId: string) => void;
  onDraftChange: (text: string) => void;
  onCoach: () => void;
  onVoiceCoach: () => void;
  onSave: () => void;
}

export default function TransformationPracticePanel({
  prompts,
  sentences,
  selectedMode,
  selectedSentenceId,
  draftText,
  speakingFunction,
  coachingSummary,
  coachingLoading,
  voiceCoachingLoading,
  saveMessage,
  canRunVoiceCoaching,
  onModeChange,
  onSentenceChange,
  onDraftChange,
  onCoach,
  onVoiceCoach,
  onSave,
}: TransformationPracticePanelProps) {
  const activePrompt = prompts.find((prompt) => prompt.mode === selectedMode);
  const selectedSentence =
    sentences.find((sentence) => sentence.id === selectedSentenceId) ??
    sentences[0] ??
    null;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.kicker}>변형 연습</Text>
        {speakingFunction ? (
          <View style={styles.functionBadge}>
            <Text style={styles.functionBadgeText}>
              {SPEAKING_FUNCTION_LABELS[speakingFunction]}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.modeRow}>
        {(Object.keys(PRACTICE_MODE_LABELS) as PracticeMode[]).map((mode) => (
          <TouchableOpacity
            key={mode}
            style={[
              styles.modeButton,
              selectedMode === mode && styles.modeButtonActive,
            ]}
            onPress={() => onModeChange(mode)}
            activeOpacity={0.8}
          >
            <Text
              style={[
                styles.modeButtonText,
                selectedMode === mode && styles.modeButtonTextActive,
              ]}
            >
              {PRACTICE_MODE_LABELS[mode]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.promptCard}>
        <Text style={styles.promptTitle}>
          {activePrompt?.title ?? "연습 안내"}
        </Text>
        <Text style={styles.promptText}>
          {activePrompt?.prompt_text ?? "아직 준비된 프롬프트가 없어요."}
        </Text>
        {(activePrompt?.guidance ?? []).map((item) => (
          <Text key={item} style={styles.guidanceText}>
            • {item}
          </Text>
        ))}
      </View>

      {selectedSentence ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>원문 문장</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.sentenceRow}
          >
            {sentences.slice(0, 8).map((sentence) => {
              const selected = sentence.id === selectedSentence.id;
              return (
                <TouchableOpacity
                  key={sentence.id}
                  testID={`practice-sentence-${sentence.id}`}
                  style={[
                    styles.sentenceChip,
                    selected && styles.sentenceChipActive,
                  ]}
                  onPress={() => onSentenceChange(sentence.id)}
                  activeOpacity={0.8}
                >
                  <Text
                    numberOfLines={2}
                    style={[
                      styles.sentenceChipText,
                      selected && styles.sentenceChipTextActive,
                    ]}
                  >
                    {sentence.text}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
          <Text style={styles.sourceSentence}>{selectedSentence.text}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>
          {selectedMode === "slot-in" ? "바꿔 쓸 부분" : "내 답변"}
        </Text>
        <TextInput
          testID="practice-draft-input"
          multiline
          value={draftText}
          onChangeText={onDraftChange}
          style={styles.input}
          placeholder="여기에 직접 써보세요"
          placeholderTextColor="#999999"
          textAlignVertical="top"
        />
      </View>

      <View style={styles.actionRow}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onCoach}
          activeOpacity={0.85}
        >
          <Text style={styles.primaryButtonText}>
            {coachingLoading ? "코칭 불러오는 중..." : "코칭 받기"}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={onSave}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryButtonText}>플레이북에 저장</Text>
        </TouchableOpacity>
      </View>

      {canRunVoiceCoaching ? (
        <TouchableOpacity
          style={styles.voiceButton}
          onPress={onVoiceCoach}
          activeOpacity={0.85}
        >
          <Text style={styles.voiceButtonText}>
            {voiceCoachingLoading
              ? "음성 피드백 생성 중..."
              : "음성 코칭 요약 받기"}
          </Text>
        </TouchableOpacity>
      ) : null}

      {saveMessage ? (
        <View style={styles.noticeCard}>
          <Text style={styles.noticeText}>{saveMessage}</Text>
        </View>
      ) : null}

      {coachingSummary ? (
        <View style={styles.feedbackCard}>
          <Text style={styles.feedbackTitle}>코칭 요약</Text>
          <Text style={styles.feedbackBody}>{coachingSummary.summary}</Text>
          <Text style={styles.feedbackLabel}>명확성</Text>
          <Text style={styles.feedbackBody}>
            {coachingSummary.clarity_feedback}
          </Text>
          <Text style={styles.feedbackLabel}>실무 활용도</Text>
          <Text style={styles.feedbackBody}>
            {coachingSummary.usefulness_feedback}
          </Text>
          {coachingSummary.pronunciation_feedback ? (
            <>
              <Text style={styles.feedbackLabel}>음성</Text>
              <Text style={styles.feedbackBody}>
                {coachingSummary.pronunciation_feedback}
              </Text>
            </>
          ) : null}
          <Text style={styles.feedbackLabel}>다음 연습</Text>
          <Text style={styles.feedbackBody}>{coachingSummary.next_step}</Text>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 120,
    gap: 14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  kicker: {
    fontSize: 11,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  functionBadge: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  functionBadgeText: {
    fontSize: 9,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  modeRow: {
    gap: 8,
  },
  modeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  modeButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  modeButtonText: {
    fontSize: 11,
    color: colors.textSecondary,
    fontWeight: font.weight.bold,
  },
  modeButtonTextActive: {
    color: colors.textInverse,
  },
  promptCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgSubtle,
    padding: 14,
    gap: 8,
  },
  promptTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  promptText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
  guidanceText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: font.weight.bold,
  },
  sentenceRow: {
    gap: 8,
    paddingRight: 16,
  },
  sentenceChip: {
    width: 180,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  sentenceChipActive: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgMuted,
  },
  sentenceChipText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  sentenceChipTextActive: {
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  sourceSentence: {
    fontSize: 15,
    lineHeight: 22,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 21,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  actionRow: {
    gap: 10,
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.text,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 11,
    color: colors.textInverse,
    fontWeight: font.weight.bold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  secondaryButtonText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  voiceButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 12,
    borderRadius: radius.pill,
    alignItems: "center",
    backgroundColor: colors.bgMuted,
  },
  voiceButtonText: {
    fontSize: 11,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  noticeCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 12,
    backgroundColor: colors.warningBg,
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  feedbackCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: 14,
    backgroundColor: colors.bg,
    gap: 6,
  },
  feedbackTitle: {
    fontSize: 11,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  feedbackLabel: {
    marginTop: 6,
    fontSize: 10,
    color: colors.textMuted,
    fontWeight: font.weight.bold,
  },
  feedbackBody: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.text,
  },
});
