import { describe, expect, it } from "vitest";
import { findPremiumCopySlop } from "@inputenglish/shared";
import {
  getPremiumPublishIssues,
  parseAiExpressionCard,
  premiumSessionDraftSchema,
} from "./session-schema";

const VALID_CARD_JSON = JSON.stringify({
  expression: "I had the privilege of",
  source_line: "I had the privilege of working with this team.",
  timestamp: "00:05",
  natural_meaning_ko: "영광스럽게도 ~할 기회가 있었다",
  story: "그가 자기를 한껏 낮춘 거예요.",
  pronunciation: {
    stress: "privilege",
    linking: "had the가 붙어요.",
    trap_ko: "너무 또박또박 읽지 마세요.",
    ipa: "/ˈprɪvəlɪdʒ/",
    say_it_ko: "프리빌리지 → **프리**빌리졉",
    drill: "I had the privilege of joining the team.",
  },
  variations: [
    {
      en: "I had the privilege of learning from her.",
      when_ko: "멘토에게 배운 경험을 말할 때.",
    },
  ],
  saved_atoms: {
    headword: "have the privilege of",
    one_line_nuance_ko: "기회와 상대를 먼저 세우는 표현.",
    register_ko: "격식 있는 회의와 이메일",
    examples: ["I had the privilege of leading this work."],
  },
  reviewed: true,
});

describe("premium session schema", () => {
  it("rejects support expression cards with variations", () => {
    expect(() => parseAiExpressionCard(VALID_CARD_JSON, "support")).toThrow(
      /support expression cards/,
    );
  });

  it("rejects support expression card stories longer than two paragraphs", () => {
    const raw = JSON.stringify({
      ...JSON.parse(VALID_CARD_JSON),
      story: ["첫 문단.", "둘째 문단.", "셋째 문단."].join("\n\n"),
      variations: [],
    });

    expect(() => parseAiExpressionCard(raw, "support")).toThrow(
      /1-2 paragraphs/,
    );
  });

  it("returns publish issues for incomplete drafts", () => {
    const session = premiumSessionDraftSchema.parse({
      source_video_id: "video-1",
      source_url: "https://www.youtube.com/watch?v=video-1",
      title: "Draft",
      duration_seconds: 300,
      segment_start_time: 0,
      segment_end_time: 300,
      transcript: [],
      article: {
        title: "Article",
        body: "Draft body",
        reviewed: false,
      },
      delivery_analysis: [],
      roleplay: {
        title: "Roleplay",
        situation: "Meeting",
        user_role: "Lead",
        partner_role: "Coach",
        target_expression_ids: [],
        turns: [],
        reviewed: false,
      },
      expression_cards: [],
      reviewed: false,
    });

    expect(getPremiumPublishIssues({ session, cards: [] })).toEqual([
      "transcript is empty",
      "article is not reviewed",
      "delivery analysis is empty",
      "expression cards are empty",
      "at least one anchor expression card is required",
      "at least one support expression card is required",
      "roleplay turns are empty",
      "roleplay is not reviewed",
      "session is not reviewed",
      "roleplay needs at least one user turn",
      "roleplay needs analysis reference text",
    ]);
  });

  it("blocks publishing when support expression cards are missing or overbuilt", () => {
    const session = premiumSessionDraftSchema.parse({
      source_video_id: "video-1",
      source_url: "https://www.youtube.com/watch?v=video-1",
      title: "Draft",
      duration_seconds: 300,
      segment_start_time: 0,
      segment_end_time: 300,
      transcript: [
        {
          id: "s1",
          text: "I had the privilege of working with this team.",
          startTime: 0,
          endTime: 5,
        },
      ],
      article: {
        title: "Article",
        body: "A clean reviewed body.",
        reviewed: true,
      },
      delivery_analysis: [
        {
          id: "d1",
          line_id: "s1",
          intonation_note: "Lower the ending.",
          style_note: "Credits the team.",
          coaching_note: "Keep privilege compact.",
          reviewed: true,
        },
      ],
      roleplay: {
        title: "Roleplay",
        situation: "Meeting",
        user_role: "Lead",
        partner_role: "Coach",
        target_expression_ids: [],
        turns: [
          {
            id: "r1",
            speaker: "user",
            translation: "이 팀과 함께 일할 수 있어 영광이었다고 말해보세요.",
            reference_text: "I had the privilege of working with this team.",
          },
        ],
        reviewed: true,
      },
      expression_cards: [],
      reviewed: true,
    });
    const anchorCard = {
      id: "card-1",
      session_id: "11111111-1111-4111-8111-111111111111",
      source_sentence_id: "s1",
      order_index: 0,
      ...JSON.parse(VALID_CARD_JSON),
      reviewed: true,
    };
    const supportCard = {
      ...anchorCard,
      id: "card-2",
      depth: "support",
      expression: "working with this team",
      story: ["첫 문단.", "둘째 문단.", "셋째 문단."].join("\n\n"),
      variations: [
        {
          en: "I enjoyed working with this team.",
          when_ko: "팀 경험을 좋게 말할 때.",
        },
      ],
    };

    expect(getPremiumPublishIssues({ session, cards: [anchorCard] })).toContain(
      "at least one support expression card is required",
    );
    expect(
      getPremiumPublishIssues({ session, cards: [anchorCard, supportCard] }),
    ).toEqual(
      expect.arrayContaining([
        "support expression card working with this team must not include variations",
        "support expression card working with this team story must be 1-2 paragraphs",
      ]),
    );
  });

  it("detects premium copy slop before publish", () => {
    expect(
      findPremiumCopySlop("이 표현은 화자의 진정성을 효과적으로 드러냅니다."),
    ).toContain('banned term "효과적으로"');
    expect(findPremiumCopySlop("분위기가 조용히 스며들어요.")).toContain(
      "abstract noun + decorative verb",
    );
    expect(
      findPremiumCopySlop("분위기가 조용히 스며드는 장면입니다."),
    ).toContain("abstract noun + decorative verb");
  });

  it("blocks publishing when article or expression copy contains slop", () => {
    const session = premiumSessionDraftSchema.parse({
      source_video_id: "video-1",
      source_url: "https://www.youtube.com/watch?v=video-1",
      title: "Draft",
      duration_seconds: 300,
      segment_start_time: 0,
      segment_end_time: 300,
      transcript: [
        {
          id: "s1",
          text: "I had the privilege of working with this team.",
          startTime: 0,
          endTime: 5,
        },
      ],
      article: {
        title: "Article",
        body: "화자의 메시지를 전략적으로 이해하는 글입니다.",
        reviewed: true,
      },
      delivery_analysis: [
        {
          id: "d1",
          line_id: "s1",
          intonation_note: "Lower the ending.",
          style_note: "Credits the team.",
          coaching_note: "Keep privilege compact.",
          reviewed: true,
        },
      ],
      roleplay: {
        title: "Roleplay",
        situation: "Meeting",
        user_role: "Lead",
        partner_role: "Coach",
        target_expression_ids: [],
        turns: [
          {
            id: "r1",
            speaker: "user",
            translation: "이 팀과 함께 일할 수 있어 영광이었다고 말해보세요.",
            reference_text: "I had the privilege of working with this team.",
          },
        ],
        reviewed: true,
      },
      expression_cards: [],
      reviewed: true,
    });
    const card = {
      id: "card-1",
      session_id: "11111111-1111-4111-8111-111111111111",
      source_sentence_id: "s1",
      order_index: 0,
      ...JSON.parse(VALID_CARD_JSON),
      story: "이 표현을 쓰면 가능성이 피어나는 느낌이 납니다.",
      reviewed: true,
    };

    expect(getPremiumPublishIssues({ session, cards: [card] })).toEqual(
      expect.arrayContaining([
        'copy slop in article: banned term "전략적으로"',
        "copy slop in expression card I had the privilege of: abstract noun + decorative verb",
      ]),
    );
  });

  it("blocks publishing when transcript, delivery, or roleplay copy contains slop", () => {
    const session = premiumSessionDraftSchema.parse({
      source_video_id: "video-1",
      source_url: "https://www.youtube.com/watch?v=video-1",
      title: "Draft",
      duration_seconds: 300,
      segment_start_time: 0,
      segment_end_time: 300,
      transcript: [
        {
          id: "s1",
          text: "I had the privilege of working with this team.",
          translation: "분위기가 조용히 스며드는 문장입니다.",
          startTime: 0,
          endTime: 5,
        },
      ],
      article: {
        title: "Article",
        body: "A clean reviewed body.",
        reviewed: true,
      },
      delivery_analysis: [
        {
          id: "d1",
          line_id: "s1",
          intonation_note: "Lower the ending.",
          style_note: "이 표현은 화자의 태도를 효과적으로 설명합니다.",
          coaching_note: "Keep privilege compact.",
          reviewed: true,
        },
      ],
      roleplay: {
        title: "Roleplay",
        situation: "가능성이 피어나는 회의 상황",
        user_role: "Lead",
        partner_role: "Coach",
        target_expression_ids: [],
        turns: [
          {
            id: "r1",
            speaker: "user",
            translation: "이 팀과 함께 일할 수 있어 영광이었다고 말해보세요.",
            reference_text: "I had the privilege of working with this team.",
          },
        ],
        reviewed: true,
      },
      expression_cards: [],
      reviewed: true,
    });

    expect(getPremiumPublishIssues({ session, cards: [] })).toEqual(
      expect.arrayContaining([
        "copy slop in transcript: abstract noun + decorative verb",
        'copy slop in delivery analysis: banned term "효과적으로"',
        "copy slop in roleplay: abstract noun + decorative verb",
      ]),
    );
  });

  it("blocks publishing when roleplay translations are missing", () => {
    const session = premiumSessionDraftSchema.parse({
      source_video_id: "video-1",
      source_url: "https://www.youtube.com/watch?v=video-1",
      title: "Draft",
      duration_seconds: 300,
      segment_start_time: 0,
      segment_end_time: 300,
      transcript: [
        {
          id: "s1",
          text: "I had the privilege of working with this team.",
          startTime: 0,
          endTime: 5,
        },
      ],
      article: {
        title: "Article",
        body: "A clean reviewed body.",
        reviewed: true,
      },
      delivery_analysis: [
        {
          id: "d1",
          line_id: "s1",
          intonation_note: "Lower the ending.",
          style_note: "Credits the team.",
          coaching_note: "Keep privilege compact.",
          reviewed: true,
        },
      ],
      roleplay: {
        title: "Roleplay",
        situation: "Meeting",
        user_role: "Lead",
        partner_role: "Coach",
        target_expression_ids: [],
        turns: [
          {
            id: "r1",
            speaker: "user",
            reference_text: "I had the privilege of working with this team.",
          },
        ],
        reviewed: true,
      },
      expression_cards: [],
      reviewed: true,
    });

    expect(getPremiumPublishIssues({ session, cards: [] })).toContain(
      "roleplay translations are incomplete",
    );
  });

  it("blocks publishing generated drafts whose module references do not match transcript or cards", () => {
    const session = premiumSessionDraftSchema.parse({
      source_video_id: "video-1",
      source_url: "https://www.youtube.com/watch?v=video-1",
      title: "Draft",
      duration_seconds: 300,
      segment_start_time: 50,
      segment_end_time: 40,
      transcript: [
        {
          id: "s1",
          text: "I had the privilege of working with this team.",
          startTime: 0,
          endTime: 0,
        },
      ],
      article: {
        title: "Article",
        body: "A clean reviewed body.",
        reviewed: true,
      },
      delivery_analysis: [
        {
          id: "d1",
          line_id: "missing-line",
          intonation_note: "Lower the ending.",
          style_note: "Credits the team.",
          coaching_note: "Keep privilege compact.",
          reviewed: true,
        },
      ],
      roleplay: {
        title: "Roleplay",
        situation: "Meeting",
        user_role: "Lead",
        partner_role: "Coach",
        target_expression_ids: ["missing-card"],
        turns: [
          {
            id: "r1",
            speaker: "user",
            translation: "이 팀과 함께 일할 수 있어 영광이었다고 말해보세요.",
            reference_text: "I had the privilege of working with this team.",
            expression_ids: ["missing-turn-card"],
          },
        ],
        reviewed: true,
      },
      expression_cards: [],
      reviewed: true,
    });
    const card = {
      id: "card-1",
      session_id: "11111111-1111-4111-8111-111111111111",
      source_sentence_id: "missing-line",
      order_index: 0,
      ...JSON.parse(VALID_CARD_JSON),
      reviewed: true,
    };

    expect(getPremiumPublishIssues({ session, cards: [card] })).toEqual(
      expect.arrayContaining([
        "segment endTime must be greater than startTime",
        "transcript line s1 endTime must be greater than startTime",
        "segment has no transcript coverage",
        "delivery analysis d1 line_id is not in transcript",
        "expression card I had the privilege of source_sentence_id is not in transcript",
        "roleplay target expression missing-card is not in expression cards",
        "roleplay turn r1 expression missing-turn-card is not in expression cards",
      ]),
    );
  });
});
