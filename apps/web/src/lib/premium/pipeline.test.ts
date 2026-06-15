import { describe, expect, it } from "vitest";
import type { PremiumExpressionCard } from "@inputenglish/shared";
import {
  buildPremiumPipelineDraft,
  calculatePremiumCrop,
  resolveSinglePremiumKeySegment,
} from "@/lib/premium/pipeline";
import { getPremiumPublishIssues } from "@/lib/premium/session-schema";

const transcript = [
  {
    id: "t1",
    text: "Thank you for having me here today.",
    startTime: 10,
    endTime: 14,
  },
  {
    id: "t2",
    text: "I had the privilege of serving with people who carried more than their share.",
    startTime: 130,
    endTime: 136,
  },
  {
    id: "t3",
    text: "That changed how I think about duty.",
    startTime: 250,
    endTime: 254,
  },
];

const anchorExpressionCard = {
  id: "expr-privilege",
  source_sentence_id: "t2",
  order_index: 0,
  depth: "anchor" as const,
  expression: "had the privilege of",
  source_line:
    "I had the privilege of serving with people who carried more than their share.",
  timestamp: "02:10",
  natural_meaning_ko: "무언가를 할 수 있어 영광이었다는 말",
  story:
    "화자는 자기 성취보다 함께 일한 사람들을 먼저 세웁니다. 이 표현은 자랑보다 감사에 가까운 톤으로 들립니다.",
  pronunciation: {
    stress: "privilege와 serving에 힘을 둔다.",
    linking: "had the를 한 덩어리로 짧게 잇는다.",
    trap_ko: "privilege를 길게 끌지 않는다.",
    ipa: "/ˈprɪvəlɪdʒ/",
    say_it_ko: "해드 더 프리-v리j 오브",
    drill: "I had the privilege of / serving with them.",
  },
  variations: [
    {
      en: "I had the chance to work with them.",
      when_ko: "조금 더 담백하게 말할 때",
    },
  ],
  saved_atoms: {
    headword: "privilege",
    one_line_nuance_ko: "받은 기회에 감사와 존중을 담는 단어",
    register_ko: "격식 있는 발표나 인터뷰에 잘 맞음",
    examples: ["It was a privilege to learn from her."],
  },
  reviewed: false,
};

const supportExpressionCard = {
  id: "expr-serving",
  source_sentence_id: "t2",
  order_index: 1,
  depth: "support" as const,
  expression: "serving with people",
  source_line:
    "I had the privilege of serving with people who carried more than their share.",
  timestamp: "02:10",
  natural_meaning_ko: "사람들과 함께 책임을 맡아 일했다는 말",
  story:
    "이 표현은 일의 중심을 한 사람에게만 두지 않고 같이 움직인 사람들에게 나눠 줍니다.",
  pronunciation: {
    stress: "serving과 people에 힘을 둔다.",
    linking: "serving with를 자연스럽게 잇는다.",
    trap_ko: "serving을 너무 길게 끌지 않는다.",
    ipa: "/ˈsɝːvɪŋ wɪð ˈpiːpəl/",
    say_it_ko: "서빙 위드 피플",
    drill: "I learned a lot serving with people like them.",
  },
  variations: [],
  saved_atoms: {
    headword: "serve with",
    one_line_nuance_ko: "같은 책임 안에서 함께 움직였다는 뉘앙스",
    register_ko: "격식 있는 회고나 인터뷰",
    examples: ["I was proud to serve with this group."],
  },
  reviewed: false,
};

describe("premium pipeline contract", () => {
  it("requires exactly one key segment", () => {
    expect(() =>
      resolveSinglePremiumKeySegment(transcript, [
        {
          id: "a",
          title: "A",
          startTime: 10,
          endTime: 14,
          reason: "first",
        },
        {
          id: "b",
          title: "B",
          startTime: 20,
          endTime: 24,
          reason: "second",
        },
      ]),
    ).toThrow("exactly one key segment");
  });

  it("creates an editable crop capped at three minutes around the segment", () => {
    expect(
      calculatePremiumCrop(
        {
          id: "segment-t2",
          title: "Privilege",
          startTime: 130,
          endTime: 136,
          reason: "anchor",
        },
        400,
      ),
    ).toEqual({
      startTime: 43,
      endTime: 223,
      paddingBeforeSeconds: 87,
      paddingAfterSeconds: 87,
    });
  });

  it("builds an unreviewed single-session draft from transcript input", () => {
    const result = buildPremiumPipelineDraft({
      sourceUrl: "https://www.youtube.com/watch?v=video-1",
      title: "Jonny Kim commencement",
      durationSeconds: 400,
      transcript,
    });

    expect(result.pipeline.keySegments).toHaveLength(1);
    expect(result.pipeline.generatedModules).toEqual([
      "article",
      "expression_cards",
      "roleplay",
    ]);
    expect(result.session.source_video_id).toBe("video-1");
    expect(result.session.segment_start_time).toBe(43);
    expect(result.session.segment_end_time).toBe(223);
    expect(result.session.article.body).toContain(
      "I had the privilege of serving with people who carried more than their share.",
    );
    expect(result.session.article.body).toContain("자막 맥락");
    expect(result.session.article.body).not.toContain(
      "이 draft는 발행 전 검수를 위한 초안입니다",
    );
    expect(result.session.delivery_analysis).toEqual([]);
    expect(result.session.roleplay.situation).toContain("02:10");
    expect(result.session.roleplay.turns[0].translation).toContain(
      "공을 돌리는",
    );
    expect(result.session.roleplay.turns[2].translation).toContain(
      "내 상황에 맞게",
    );
    expect(result.session.roleplay.analysis_reference_text).toBe(
      "I had the privilege of serving with people who carried more than their share.",
    );
    expect(result.session.article.reviewed).toBe(false);
    expect(result.session.roleplay.reviewed).toBe(false);
    expect(result.session.reviewed).toBe(false);
  });

  it("connects expression cards to roleplay targets and publish-gate references", () => {
    const result = buildPremiumPipelineDraft({
      sourceUrl: "https://www.youtube.com/watch?v=video-1",
      title: "Jonny Kim commencement",
      durationSeconds: 400,
      transcript,
      expressionCards: [anchorExpressionCard, supportExpressionCard],
    });

    expect(result.session.roleplay.target_expression_ids).toEqual([
      "expr-privilege",
      "expr-serving",
    ]);
    const userTurn = result.session.roleplay.turns.find(
      (turn) => turn.speaker === "user",
    );
    expect(userTurn?.expression_ids).toEqual([
      "expr-privilege",
      "expr-serving",
    ]);

    const reviewedCards: PremiumExpressionCard[] =
      result.session.expression_cards.map((card) => ({
        ...card,
        id: card.id ?? card.expression,
        reviewed: true,
      }));
    const reviewedSession = {
      ...result.session,
      reviewed: true,
      article: { ...result.session.article, reviewed: true },
      roleplay: { ...result.session.roleplay, reviewed: true },
      expression_cards: reviewedCards,
    };

    expect(
      getPremiumPublishIssues({
        session: reviewedSession,
        cards: reviewedSession.expression_cards,
      }),
    ).toEqual([]);
  });
});
