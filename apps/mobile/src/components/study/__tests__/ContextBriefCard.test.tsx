import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import ContextBriefCard from "../ContextBriefCard";

describe("ContextBriefCard", () => {
  it("renders unlocked professional context content", () => {
    const onStartLearning = jest.fn();
    const { getByText } = render(
      <ContextBriefCard
        context={{
          strategic_intent:
            "이 발화는 수치를 자신감 있게 설명하는 톤을 보여준다.",
          speaking_function: "explain-metric",
          reusable_scenarios: [
            "주간 지표 업데이트를 설명할 때",
            "성과 리뷰에서 수치 변화를 요약할 때",
          ],
          key_vocabulary: ["inflection point", "momentum"],
          grammar_rhetoric_note: "강한 단정 대신 관찰 기반 어조를 유지한다.",
          expected_takeaway:
            "사용자는 프로젝트 지표 변화를 더 설득력 있게 설명할 수 있다.",
        }}
        sourceType="earnings-call"
        speakingFunction="explain-metric"
        premiumRequired={true}
        locked={false}
        onUnlock={jest.fn()}
        onStartLearning={onStartLearning}
      />,
    );

    expect(getByText("학습 전 브리프")).toBeTruthy();
    expect(getByText("실적 발표")).toBeTruthy();
    expect(getByText("지표 설명")).toBeTruthy();
    expect(
      getByText("이 발화는 수치를 자신감 있게 설명하는 톤을 보여준다."),
    ).toBeTruthy();
    expect(getByText("inflection point, momentum")).toBeTruthy();
    expect(getByText("• 주간 지표 업데이트를 설명할 때")).toBeTruthy();

    fireEvent.press(getByText("학습 시작"));
    expect(onStartLearning).toHaveBeenCalledTimes(1);
  });

  it("renders locked premium state and calls unlock and continue handlers", () => {
    const onUnlock = jest.fn();
    const onStartLearning = jest.fn();
    const { getByText } = render(
      <ContextBriefCard
        context={{
          strategic_intent: "잠금 상태에서는 상세 브리프를 숨긴다.",
          speaking_function: "summarize",
          reusable_scenarios: [],
          key_vocabulary: [],
          grammar_rhetoric_note: "",
          expected_takeaway: "핵심 내용을 먼저 파악한다.",
        }}
        sourceType="podcast"
        speakingFunction="summarize"
        premiumRequired={true}
        locked={true}
        onUnlock={onUnlock}
        onStartLearning={onStartLearning}
      />,
    );

    expect(
      getByText("이 세션의 프리러닝 브리프는 프리미엄에서 열립니다."),
    ).toBeTruthy();

    fireEvent.press(getByText("브리프 열기"));
    expect(onUnlock).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText("바로 학습 시작"));
    expect(onStartLearning).toHaveBeenCalledTimes(1);
  });
});
