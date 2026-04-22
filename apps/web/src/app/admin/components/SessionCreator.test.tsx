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
        shortformSelectedIds={new Set()}
        onShortformSelectedIdsChange={() => {}}
        longformSelectedIds={new Set()}
        onLongformSelectedIdsChange={() => {}}
        onSessionsChange={() => {}}
      />,
    );

    expect(html).toContain("세션 만들기");
    expect(html).toContain("0개 생성됨");
  });

  it("renders a parent longform summary when a longform pack is provided", () => {
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
        longformPack={{
          id: "pack-1",
          source_video_id: "video-1",
          title: "창업자 철학 대담",
          subtitle: "제품 철학이 길게 이어지는 구간이에요.",
          description:
            "긴 호흡으로 제품 철학과 팀 운영 얘기를 풀어가는 구간이에요.",
          duration: 1500,
          sentence_ids: ["sentence-1"],
          start_time: 0,
          end_time: 1500,
          topic_tags: ["제품 철학", "팀 운영"],
          content_tags: ["podcast"],
          created_at: new Date().toISOString(),
        }}
        shortformSelectedIds={new Set()}
        onShortformSelectedIdsChange={() => {}}
        longformSelectedIds={new Set(["sentence-1"])}
        onLongformSelectedIdsChange={() => {}}
        onSessionsChange={() => {}}
      />,
    );

    expect(html).toContain("포인트 쇼츠 만들기");
    expect(html).toContain("Parent Longform");
    expect(html).toContain("창업자 철학 대담");
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
        longformPack={{
          id: "pack-1",
          source_video_id: "video-1",
          title: "창업자 철학 대담",
          subtitle: "제품 철학이 길게 이어지는 구간이에요.",
          description:
            "긴 호흡으로 제품 철학과 팀 운영 얘기를 풀어가는 구간이에요.",
          duration: 1500,
          sentence_ids: ["sentence-1", "sentence-2"],
          start_time: 0,
          end_time: 1500,
          topic_tags: ["제품 철학"],
          content_tags: ["podcast"],
          created_at: new Date().toISOString(),
        }}
        shortformSelectedIds={new Set()}
        onShortformSelectedIdsChange={() => {}}
        longformSelectedIds={new Set()}
        onLongformSelectedIdsChange={() => {}}
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

    expect(html).toContain("AI 추천 포인트 쇼츠 보기 (1)");
  });
});
