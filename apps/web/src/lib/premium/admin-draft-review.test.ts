import { describe, expect, it } from "vitest";
import type { PremiumExpressionCard } from "@inputenglish/shared";
import {
  appendPremiumExpressionCard,
  getPremiumAdminOperationalSummary,
  getPremiumAdminDraftStats,
  markPremiumDraftReview,
  parsePremiumAdminDraftJson,
  updatePremiumDraftCrop,
  type PremiumAdminDraft,
} from "@/lib/premium/admin-draft-review";

const anchorCard: PremiumExpressionCard = {
  id: "expr-anchor",
  source_sentence_id: "t1",
  order_index: 0,
  depth: "anchor",
  expression: "had the privilege of",
  source_line: "I had the privilege of working with them.",
  timestamp: "00:12",
  natural_meaning_ko: "함께할 수 있어 영광이었다는 말",
  story: "상대에게 공을 돌릴 때 쓰기 좋은 표현입니다.",
  pronunciation: {
    stress: "privilege에 힘을 둔다.",
    linking: "had the를 붙인다.",
    trap_ko: "privilege를 길게 끌지 않는다.",
    ipa: "/ˈprɪvəlɪdʒ/",
    say_it_ko: "해드 더 프리-v리j",
    drill: "I had the privilege of / working with them.",
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

function makeDraft(): PremiumAdminDraft {
  return {
    title: "Premium draft",
    transcript: [
      {
        id: "t1",
        text: "I had the privilege of working with them.",
        startTime: 12,
        endTime: 16,
      },
    ],
    article: {
      title: "Article",
      body: "Body",
      reviewed: false,
    },
    delivery_analysis: [
      {
        id: "delivery-t1",
        line_id: "t1",
        intonation_note: "Listen for privilege.",
        reviewed: false,
      },
    ],
    roleplay: {
      title: "Roleplay",
      situation: "Meeting",
      target_expression_ids: [],
      turns: [
        {
          id: "coach-1",
          speaker: "coach",
          line: "How would you describe the work?",
        },
        {
          id: "user-1",
          speaker: "user",
          hidden: true,
          reference_text: "I had the privilege of working with them.",
          expression_ids: [],
        },
      ],
      reviewed: false,
    },
    expression_cards: [],
    reviewed: false,
  };
}

describe("premium admin draft review helpers", () => {
  it("parses draft JSON and reports invalid JSON", () => {
    expect(
      parsePremiumAdminDraftJson(JSON.stringify(makeDraft())).draft,
    ).toBeTruthy();
    expect(parsePremiumAdminDraftJson("{").error).toContain(
      "Expected property name",
    );
  });

  it("marks individual review gates without approving the whole session", () => {
    const articleOnly = markPremiumDraftReview(makeDraft(), "article");
    const stats = getPremiumAdminDraftStats(articleOnly);

    expect(stats.articleReviewed).toBe(true);
    expect(stats.deliveryReviewed).toBe(false);
    expect(stats.roleplayReviewed).toBe(false);
    expect(stats.sessionReviewed).toBe(false);
  });

  it("marks all publish gates when the operator accepts the full draft", () => {
    const draft = {
      ...makeDraft(),
      expression_cards: [anchorCard],
    };
    const reviewed = markPremiumDraftReview(draft, "all");
    const stats = getPremiumAdminDraftStats(reviewed);

    expect(stats.articleReviewed).toBe(true);
    expect(stats.deliveryReviewed).toBe(true);
    expect(stats.expressionReviewed).toBe(true);
    expect(stats.roleplayReviewed).toBe(true);
    expect(stats.sessionReviewed).toBe(true);
  });

  it("appends expression cards to draft and roleplay user turns", () => {
    const updated = appendPremiumExpressionCard(makeDraft(), anchorCard);

    expect(updated.expression_cards).toHaveLength(1);
    expect(updated.roleplay?.target_expression_ids).toEqual(["expr-anchor"]);
    expect(updated.roleplay?.turns?.[1].expression_ids).toEqual([
      "expr-anchor",
    ]);
  });

  it("updates the editable crop and keeps only transcript lines in range", () => {
    const cropped = updatePremiumDraftCrop(
      {
        ...makeDraft(),
        transcript: [
          {
            id: "before",
            text: "Before",
            startTime: 1,
            endTime: 3,
          },
          ...(makeDraft().transcript ?? []),
          {
            id: "after",
            text: "After",
            startTime: 80,
            endTime: 84,
          },
        ],
      },
      { startTime: 10, endTime: 20 },
    );

    expect(cropped.segment_start_time).toBe(10);
    expect(cropped.segment_end_time).toBe(20);
    expect(cropped.transcript?.map((line) => line.id)).toEqual(["t1"]);
  });

  it("rejects invalid editable crop ranges", () => {
    expect(() =>
      updatePremiumDraftCrop(makeDraft(), { startTime: 20, endTime: 10 }),
    ).toThrow("편집 끝 시간은 시작 시간보다 커야 합니다.");
  });

  it("summarizes operational blockers before publish", () => {
    const summary = getPremiumAdminOperationalSummary({
      draft: makeDraft(),
      sessionId: "",
      pipelineSummary: {
        sourceUrl: "https://www.youtube.com/watch?v=video-1",
        keySegments: [
          {
            title: "Privilege",
            startTime: 12,
            endTime: 16,
            reason: "operator selected",
          },
        ],
        crop: {
          startTime: 0,
          endTime: 100,
          paddingBeforeSeconds: 60,
          paddingAfterSeconds: 60,
        },
        generatedModules: ["article", "delivery", "roleplay"],
        keySegmentSource: "operator",
        moduleSource: "fallback",
      },
    });

    expect(summary.publishReady).toBe(false);
    expect(summary.sourceLabel).toBe("운영자 선택");
    expect(summary.moduleLabel).toBe("기본 생성");
    expect(summary.blockingIssues).toContain(
      "초안 저장: 초안을 저장하면 세션 아이디가 생깁니다",
    );
    expect(summary.blockingIssues).toContain("단일 편집 범위: 편집 범위 없음");
    expect(summary.blockingIssues).toContain("핵심 표현: 0개");
  });

  it("marks a fully reviewed grounded draft as publish-ready", () => {
    const reviewed = markPremiumDraftReview(
      {
        ...makeDraft(),
        segment_start_time: 0,
        segment_end_time: 100,
        expression_cards: [{ ...anchorCard, reviewed: true }],
      },
      "all",
    );
    const summary = getPremiumAdminOperationalSummary({
      draft: reviewed,
      sessionId: "session-1",
      pipelineSummary: {
        sourceUrl: "https://www.youtube.com/watch?v=video-1",
        keySegments: [
          {
            title: "Privilege",
            startTime: 12,
            endTime: 16,
            reason: "AI selected",
          },
        ],
        crop: {
          startTime: 0,
          endTime: 100,
          paddingBeforeSeconds: 60,
          paddingAfterSeconds: 60,
        },
        generatedModules: ["article", "delivery", "roleplay"],
        keySegmentSource: "ai",
        keySegmentProvider: "azure-openai",
        keySegmentModel: "gpt-4o-segment",
        moduleSource: "ai",
        moduleProvider: "azure-openai",
        moduleModel: "gpt-4o-modules",
      },
    });

    expect(summary.publishReady).toBe(true);
    expect(summary.blockingIssues).toEqual([]);
    expect(summary.sourceLabel).toBe("AI 선택 · azure-openai · gpt-4o-segment");
    expect(summary.moduleLabel).toBe("AI 생성 · azure-openai · gpt-4o-modules");
    expect(summary.reviewLabel).toBe("10/10개 완료");
  });
});
