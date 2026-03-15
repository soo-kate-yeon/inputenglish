import React from "react";
import { fireEvent, render } from "@testing-library/react-native";
import ContextBriefCard from "../ContextBriefCard";

describe("ContextBriefCard", () => {
  it("renders unlocked brief content and fires start", () => {
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
        locked={false}
        ctaLabel="학습 시작"
        onUnlock={jest.fn()}
        onStartLearning={onStartLearning}
      />,
    );

    expect(getByText("학습 전 브리프")).toBeTruthy();
    expect(
      getByText("이 발화는 수치를 자신감 있게 설명하는 톤을 보여준다."),
    ).toBeTruthy();
    expect(getByText("inflection point, momentum")).toBeTruthy();
    expect(getByText("• 주간 지표 업데이트를 설명할 때")).toBeTruthy();

    fireEvent.press(getByText("학습 시작"));
    expect(onStartLearning).toHaveBeenCalledTimes(1);
  });

  it("renders gradient lock overlay for free users", () => {
    const onUnlock = jest.fn();
    const onStartLearning = jest.fn();
    const { getByText } = render(
      <ContextBriefCard
        context={{
          strategic_intent: "잠금 상태에서도 브리프 내용은 보인다.",
          speaking_function: "summarize",
          reusable_scenarios: [],
          key_vocabulary: [],
          grammar_rhetoric_note: "",
          expected_takeaway: "핵심 내용을 먼저 파악한다.",
        }}
        locked={true}
        ctaLabel="학습 시작"
        onUnlock={onUnlock}
        onStartLearning={onStartLearning}
      />,
    );

    expect(
      getByText("전체 브리프는 프리미엄에서 확인할 수 있어요"),
    ).toBeTruthy();

    fireEvent.press(getByText("프리미엄 시작"));
    expect(onUnlock).toHaveBeenCalledTimes(1);

    fireEvent.press(getByText("학습 시작"));
    expect(onStartLearning).toHaveBeenCalledTimes(1);
  });

  it("shows continue label when ctaLabel is set", () => {
    const { getByText } = render(
      <ContextBriefCard
        context={{
          strategic_intent: "테스트",
          speaking_function: "summarize",
          reusable_scenarios: [],
          key_vocabulary: [],
          grammar_rhetoric_note: "",
          expected_takeaway: "",
        }}
        locked={false}
        ctaLabel="학습 계속하기"
        onUnlock={jest.fn()}
        onStartLearning={jest.fn()}
      />,
    );

    expect(getByText("학습 계속하기")).toBeTruthy();
  });
});
