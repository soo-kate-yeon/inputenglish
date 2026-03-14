import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SessionCreator } from "./SessionCreator";

describe("SessionCreator", () => {
  it("renders the new session form with its own internal scroll area", () => {
    const html = renderToStaticMarkup(
      <SessionCreator
        sentences={[
          {
            id: "sentence-1",
            text: "We saw stronger momentum this quarter.",
            startTime: 0,
            endTime: 3,
            highlights: [],
          },
        ]}
        videoId="video-1"
        onSessionsChange={() => {}}
      />,
    );

    expect(html).toContain('placeholder="세션 제목"');
    expect(html).toContain('placeholder="세션 설명"');
    expect(html.match(/class="flex-1 overflow-y-auto"/g)?.length ?? 0).toBe(2);
  });

  it("shows an AI suggestion modal trigger when recommended scenes exist", () => {
    const html = renderToStaticMarkup(
      <SessionCreator
        sentences={[
          {
            id: "sentence-1",
            text: "We saw stronger momentum this quarter.",
            startTime: 0,
            endTime: 3,
            highlights: [],
          },
          {
            id: "sentence-2",
            text: "The update was well received by stakeholders.",
            startTime: 3,
            endTime: 8,
            highlights: [],
          },
        ]}
        videoId="video-1"
        onSessionsChange={() => {}}
        suggestedScenes={[
          {
            startIndex: 0,
            endIndex: 1,
            title: "지표 설명 장면",
            reason: "숫자 의미를 설명하는 흐름이 분명합니다.",
            learningPoints: ["지표 설명", "업데이트 말하기"],
            estimatedDuration: 8,
          },
        ]}
      />,
    );

    expect(html).toContain("AI 추천 장면 보기 (1)");
  });
});
