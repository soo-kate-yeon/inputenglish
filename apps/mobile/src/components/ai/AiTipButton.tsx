// @MX:NOTE: [AUTO] Button that triggers AI tip generation, gated by subscription plan.
// FREE users see an upgrade prompt; PREMIUM users trigger the AI API call.
// @MX:SPEC: SPEC-MOBILE-006

import React, { useCallback, useRef, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity } from "react-native";
import { router } from "expo-router";
import { fetchAiTip } from "@/lib/ai-api";

interface AiTipButtonProps {
  sentenceId: string;
  videoId: string;
  sentenceText: string;
  selectedTags: string[];
  onTipGenerated: (tip: string, tags: string[]) => void;
  canUseAI: boolean;
  disabled?: boolean;
}

export default function AiTipButton({
  sentenceId,
  videoId,
  sentenceText,
  selectedTags,
  onTipGenerated,
  canUseAI,
  disabled = false,
}: AiTipButtonProps) {
  const [isFetching, setIsFetching] = useState(false);
  // Guard against duplicate requests in flight
  const pendingRef = useRef(false);

  const handlePress = useCallback(async () => {
    if (!canUseAI) {
      Alert.alert(
        "업그레이드 필요",
        "AI 팁은 Premium 플랜에서 사용 가능합니다.",
        [
          { text: "취소", style: "cancel" },
          {
            text: "업그레이드",
            onPress: () => router.push("/paywall"),
          },
        ],
      );
      return;
    }

    if (pendingRef.current) return;
    pendingRef.current = true;
    setIsFetching(true);

    try {
      const result = await fetchAiTip({
        sentenceId,
        videoId,
        tags: selectedTags,
        sentenceText,
      });
      onTipGenerated(result.tip, result.tags);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "AI 팁을 불러오지 못했습니다.";
      Alert.alert("오류", message, [
        { text: "취소", style: "cancel" },
        { text: "다시 시도", onPress: () => void handlePress() },
      ]);
    } finally {
      setIsFetching(false);
      pendingRef.current = false;
    }
  }, [
    canUseAI,
    sentenceId,
    videoId,
    selectedTags,
    sentenceText,
    onTipGenerated,
  ]);

  const isDisabled = disabled || isFetching;

  return (
    <TouchableOpacity
      style={[styles.button, isDisabled && styles.buttonDisabled]}
      onPress={handlePress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={isFetching ? "AI 팁 로딩 중" : "AI 팁 받기"}
      accessibilityState={{ disabled: isDisabled }}
    >
      <Text
        style={[styles.buttonText, isDisabled && styles.buttonTextDisabled]}
      >
        {isFetching ? "분석 중..." : "AI 팁 받기"}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: "#007AFF",
    paddingHorizontal: 18,
    paddingVertical: 9,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginHorizontal: 12,
    marginVertical: 4,
  },
  buttonDisabled: {
    backgroundColor: "#C7C7CC",
  },
  buttonText: {
    color: "#fff",
    fontWeight: "600",
    fontSize: 14,
  },
  buttonTextDisabled: {
    color: "#8E8E93",
  },
});
