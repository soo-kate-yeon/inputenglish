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
    color: "#111111",
    fontWeight: "800",
  },
  functionBadge: {
    borderWidth: 1,
    borderColor: "#111111",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  functionBadgeText: {
    fontSize: 9,
    color: "#111111",
    fontWeight: "700",
  },
  modeRow: {
    gap: 8,
  },
  modeButton: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FFFFFF",
  },
  modeButtonActive: {
    borderColor: "#111111",
    backgroundColor: "#111111",
  },
  modeButtonText: {
    fontSize: 11,
    color: "#666666",
    fontWeight: "700",
  },
  modeButtonTextActive: {
    color: "#FFFFFF",
  },
  promptCard: {
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#FAFAFA",
    padding: 14,
    gap: 8,
  },
  promptTitle: {
    fontSize: 15,
    lineHeight: 20,
    color: "#111111",
    fontWeight: "700",
  },
  promptText: {
    fontSize: 13,
    lineHeight: 20,
    color: "#111111",
  },
  guidanceText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666666",
  },
  section: {
    gap: 8,
  },
  sectionLabel: {
    fontSize: 11,
    color: "#888888",
    fontWeight: "700",
  },
  sentenceRow: {
    gap: 8,
    paddingRight: 16,
  },
  sentenceChip: {
    width: 180,
    borderWidth: 1,
    borderColor: "#E0E0E0",
    padding: 10,
    backgroundColor: "#FFFFFF",
  },
  sentenceChipActive: {
    borderColor: "#111111",
    backgroundColor: "#F7F7F7",
  },
  sentenceChipText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#666666",
  },
  sentenceChipTextActive: {
    color: "#111111",
    fontWeight: "600",
  },
  sourceSentence: {
    fontSize: 15,
    lineHeight: 22,
    color: "#111111",
    fontWeight: "600",
  },
  input: {
    minHeight: 140,
    borderWidth: 1,
    borderColor: "#111111",
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 14,
    lineHeight: 21,
    color: "#111111",
    backgroundColor: "#FFFFFF",
  },
  actionRow: {
    gap: 10,
  },
  primaryButton: {
    borderWidth: 1,
    borderColor: "#111111",
    backgroundColor: "#111111",
    paddingVertical: 12,
    alignItems: "center",
  },
  primaryButtonText: {
    fontSize: 11,
    color: "#FFFFFF",
    fontWeight: "700",
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: "#111111",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  secondaryButtonText: {
    fontSize: 11,
    color: "#111111",
    fontWeight: "700",
  },
  voiceButton: {
    borderWidth: 1,
    borderColor: "#E0E0E0",
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: "#F7F7F7",
  },
  voiceButtonText: {
    fontSize: 11,
    color: "#111111",
    fontWeight: "700",
  },
  noticeCard: {
    borderWidth: 1,
    borderColor: "#111111",
    padding: 12,
    backgroundColor: "#FFFCEB",
  },
  noticeText: {
    fontSize: 12,
    lineHeight: 18,
    color: "#111111",
    fontWeight: "600",
  },
  feedbackCard: {
    borderWidth: 1,
    borderColor: "#111111",
    padding: 14,
    backgroundColor: "#FFFFFF",
    gap: 6,
  },
  feedbackTitle: {
    fontSize: 11,
    color: "#111111",
    fontWeight: "800",
  },
  feedbackLabel: {
    marginTop: 6,
    fontSize: 10,
    color: "#888888",
    fontWeight: "700",
  },
  feedbackBody: {
    fontSize: 13,
    lineHeight: 20,
    color: "#111111",
  },
});
