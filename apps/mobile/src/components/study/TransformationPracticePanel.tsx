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
} from "@inputenglish/shared";
import { PRACTICE_MODE_LABELS } from "../../lib/professional-labels";
import { colors, radius, font } from "../../theme";
import { appTokens } from "../../theme/app-tokens";

interface TransformationPracticePanelProps {
  prompts: PracticePrompt[];
  sentences: Sentence[];
  selectedMode: PracticeMode;
  selectedSentenceId: string | null;
  draftText: string;
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
    paddingHorizontal: appTokens.spacing.n16,
    paddingTop: appTokens.spacing.n16,
    paddingBottom: appTokens.spacing.n120,
    gap: appTokens.spacing.n14,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: appTokens.spacing.n12,
  },
  kicker: {
    fontSize: appTokens.typography.n11,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  functionBadge: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: appTokens.spacing.n8,
    paddingVertical: appTokens.spacing.n4,
    borderRadius: radius.pill,
  },
  functionBadgeText: {
    fontSize: appTokens.typography.n9,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  modeRow: {
    gap: appTokens.spacing.n8,
  },
  modeButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: appTokens.spacing.n12,
    paddingVertical: appTokens.spacing.n10,
    borderRadius: radius.pill,
    backgroundColor: colors.bg,
  },
  modeButtonActive: {
    borderColor: colors.text,
    backgroundColor: colors.text,
  },
  modeButtonText: {
    fontSize: appTokens.typography.n11,
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
    padding: appTokens.spacing.n14,
    gap: appTokens.spacing.n8,
  },
  promptTitle: {
    fontSize: appTokens.typography.n15,
    lineHeight: appTokens.typography.n20,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  promptText: {
    fontSize: appTokens.typography.n13,
    lineHeight: appTokens.typography.n20,
    color: colors.text,
  },
  guidanceText: {
    fontSize: appTokens.typography.n12,
    lineHeight: appTokens.typography.n18,
    color: colors.textSecondary,
  },
  section: {
    gap: appTokens.spacing.n8,
  },
  sectionLabel: {
    fontSize: appTokens.typography.n11,
    color: colors.textMuted,
    fontWeight: font.weight.bold,
  },
  sentenceRow: {
    gap: appTokens.spacing.n8,
    paddingRight: appTokens.spacing.n16,
  },
  sentenceChip: {
    width: appTokens.size.n180,
    borderWidth: 1,
    borderColor: colors.border,
    padding: appTokens.spacing.n10,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  sentenceChipActive: {
    borderColor: colors.borderStrong,
    backgroundColor: colors.bgMuted,
  },
  sentenceChipText: {
    fontSize: appTokens.typography.n12,
    lineHeight: appTokens.typography.n18,
    color: colors.textSecondary,
  },
  sentenceChipTextActive: {
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  sourceSentence: {
    fontSize: appTokens.typography.n15,
    lineHeight: appTokens.typography.n22,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  input: {
    minHeight: appTokens.size.n140,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingHorizontal: appTokens.spacing.n12,
    paddingVertical: appTokens.spacing.n12,
    fontSize: appTokens.typography.n14,
    lineHeight: appTokens.typography.n21,
    color: colors.text,
    backgroundColor: colors.bg,
  },
  actionRow: {
    gap: appTokens.spacing.n10,
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.text,
    paddingVertical: appTokens.spacing.n12,
    borderRadius: radius.pill,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: appTokens.typography.n11,
    color: colors.textInverse,
    fontWeight: font.weight.bold,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    paddingVertical: appTokens.spacing.n12,
    borderRadius: radius.pill,
    alignItems: "center",
    backgroundColor: colors.bg,
  },
  secondaryButtonText: {
    fontSize: appTokens.typography.n11,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  voiceButton: {
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: appTokens.spacing.n12,
    borderRadius: radius.pill,
    alignItems: "center",
    backgroundColor: colors.bgMuted,
  },
  voiceButtonText: {
    fontSize: appTokens.typography.n11,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  noticeCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: appTokens.spacing.n12,
    backgroundColor: colors.warningBg,
  },
  noticeText: {
    fontSize: appTokens.typography.n12,
    lineHeight: appTokens.typography.n18,
    color: colors.text,
    fontWeight: font.weight.semibold,
  },
  feedbackCard: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
    padding: appTokens.spacing.n14,
    backgroundColor: colors.bg,
    gap: appTokens.spacing.n6,
  },
  feedbackTitle: {
    fontSize: appTokens.typography.n11,
    color: colors.text,
    fontWeight: font.weight.bold,
  },
  feedbackLabel: {
    marginTop: appTokens.spacing.n6,
    fontSize: appTokens.typography.n10,
    color: colors.textMuted,
    fontWeight: font.weight.bold,
  },
  feedbackBody: {
    fontSize: appTokens.typography.n13,
    lineHeight: appTokens.typography.n20,
    color: colors.text,
  },
});
