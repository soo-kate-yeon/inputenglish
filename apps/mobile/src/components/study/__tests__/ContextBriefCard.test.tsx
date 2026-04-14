import React from "react";
import { render } from "@testing-library/react-native";
import ContextBriefCard from "../ContextBriefCard";

describe("ContextBriefCard", () => {
  it("renders unlocked brief content", () => {
    const { getByText } = render(
      <ContextBriefCard
        context={{
          strategic_intent:
            "이 발화는 수치를 자신감 있게 설명하는 톤을 보여준다.",
          reusable_scenarios: [
            "주간 지표 업데이트를 설명할 때",
            "성과 리뷰에서 수치 변화를 요약할 때",
          ],
          key_vocabulary: ["inflection point", "momentum"],
          grammar_rhetoric_note: "강한 단정 대신 관찰 기반 어조를 유지한다.",
          expected_takeaway:
            "사용자는 프로젝트 지표 변화를 더 설득력 있게 설명할 수 있다.",
        }}
      />,
    );

    expect(
      getByText("사용자는 프로젝트 지표 변화를 더 설득력 있게 설명할 수 있다."),
    ).toBeTruthy();
    expect(getByText("inflection point")).toBeTruthy();
    expect(getByText("momentum")).toBeTruthy();
  });

  it("renders key_vocabulary with expression+example entries", () => {
    const { getByText } = render(
      <ContextBriefCard
        context={{
          strategic_intent: "테스트",
          reusable_scenarios: [],
          key_vocabulary: [
            {
              expression: "We're seeing",
              example: "We're seeing strong momentum across all segments.",
              translation: "전 부문에서 강한 성장세가 보이고 있습니다.",
            },
            { expression: "net-net", example: "" },
            "legacy-string-item",
          ],
          grammar_rhetoric_note: "",
          expected_takeaway: "테스트",
        }}
      />,
    );

    expect(getByText("We're seeing")).toBeTruthy();
    expect(
      getByText("We're seeing strong momentum across all segments."),
    ).toBeTruthy();
    expect(
      getByText("전 부문에서 강한 성장세가 보이고 있습니다."),
    ).toBeTruthy();
    expect(getByText("net-net")).toBeTruthy();
    expect(getByText("legacy-string-item")).toBeTruthy();
  });

  it("does not render premium lock CTA", () => {
    const { queryByText } = render(
      <ContextBriefCard
        context={{
          strategic_intent: "잠금 상태에서도 브리프 내용은 보인다.",
          reusable_scenarios: [],
          key_vocabulary: [],
          grammar_rhetoric_note: "",
          expected_takeaway: "핵심 내용을 먼저 파악한다.",
        }}
      />,
    );

    expect(
      queryByText("전체 브리프는 프리미엄에서 확인할 수 있어요"),
    ).toBeNull();
    expect(queryByText("프리미엄 시작")).toBeNull();
  });
});
