import type { PremiumExpressionCard } from "@inputenglish/shared";

export type PremiumAdminDraft = Record<string, unknown> & {
  title?: string;
  description?: string | null;
  source_url?: string;
  source_video_id?: string;
  duration_seconds?: number;
  segment_start_time?: number;
  segment_end_time?: number;
  transcript?: Array<Record<string, unknown>>;
  article?: (Record<string, unknown> & { reviewed?: boolean }) | null;
  delivery_analysis?: Array<Record<string, unknown> & { reviewed?: boolean }>;
  roleplay?:
    | (Record<string, unknown> & {
        reviewed?: boolean;
        target_expression_ids?: string[];
        turns?: Array<
          Record<string, unknown> & {
            speaker?: string;
            expression_ids?: string[];
          }
        >;
      })
    | null;
  expression_cards?: PremiumExpressionCard[];
  reviewed?: boolean;
};

export type PremiumReviewTarget =
  | "article"
  | "delivery"
  | "expressions"
  | "roleplay"
  | "session"
  | "all";

export type PremiumPipelineAdminSummary = {
  sourceUrl: string;
  keySegments: Array<{
    title: string;
    startTime: number;
    endTime: number;
    reason: string;
  }>;
  crop: {
    startTime: number;
    endTime: number;
    paddingBeforeSeconds: number;
    paddingAfterSeconds: number;
  };
  generatedModules: string[];
  keySegmentSource?: "operator" | "ai" | "fallback";
  keySegmentProvider?: string | null;
  keySegmentModel?: string | null;
  moduleSource?: "ai" | "fallback";
  moduleProvider?: string | null;
  moduleModel?: string | null;
  expressionCardSource?: "ai" | "fallback";
  expressionCardProvider?: string | null;
  expressionCardModel?: string | null;
};

export type PremiumAdminReadinessItem = {
  id:
    | "draft"
    | "session"
    | "transcript"
    | "crop"
    | "article"
    | "delivery"
    | "anchor"
    | "expressions"
    | "roleplay"
    | "session-review";
  label: string;
  done: boolean;
  detail: string;
};

export type PremiumAdminOperationalSummary = {
  sourceLabel: string;
  moduleLabel: string;
  expressionCardLabel: string;
  cropLabel: string;
  reviewLabel: string;
  publishReady: boolean;
  readyCount: number;
  totalCount: number;
  blockingIssues: string[];
  readinessItems: PremiumAdminReadinessItem[];
  deliveryLinkedCount: number;
  roleplayUserTurnCount: number;
};

export function parsePremiumAdminDraftJson(draftJson: string) {
  try {
    return { draft: JSON.parse(draftJson) as PremiumAdminDraft, error: null };
  } catch (error) {
    return {
      draft: null,
      error: error instanceof Error ? error.message : "JSON을 읽을 수 없어요.",
    };
  }
}

export function getPremiumAdminDraftStats(draft: PremiumAdminDraft | null) {
  const expressionCards = Array.isArray(draft?.expression_cards)
    ? draft.expression_cards
    : [];
  const deliveryAnalysis = Array.isArray(draft?.delivery_analysis)
    ? draft.delivery_analysis
    : [];
  const transcript = Array.isArray(draft?.transcript) ? draft.transcript : [];

  return {
    transcriptCount: transcript.length,
    expressionCards,
    anchorCount: expressionCards.filter((card) => card.depth === "anchor")
      .length,
    supportCount: expressionCards.filter((card) => card.depth === "support")
      .length,
    deliveryAnalysis,
    articleReviewed: Boolean(draft?.article?.reviewed),
    deliveryReviewed:
      deliveryAnalysis.length > 0 &&
      deliveryAnalysis.every((item) => item.reviewed),
    expressionReviewed:
      expressionCards.length > 0 &&
      expressionCards.every((card) => card.reviewed),
    roleplayReviewed: Boolean(draft?.roleplay?.reviewed),
    sessionReviewed: Boolean(draft?.reviewed),
  };
}

function getNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

export function updatePremiumDraftCrop(
  draft: PremiumAdminDraft,
  crop: { startTime: number; endTime: number },
): PremiumAdminDraft {
  const startTime = getNumber(crop.startTime);
  const endTime = getNumber(crop.endTime);
  if (startTime === null || endTime === null || startTime < 0) {
    throw new Error("편집 시작과 끝은 0 이상의 초 단위 숫자여야 합니다.");
  }
  if (endTime <= startTime) {
    throw new Error("편집 끝 시간은 시작 시간보다 커야 합니다.");
  }

  const transcript = Array.isArray(draft.transcript)
    ? draft.transcript.filter((line) => {
        const lineStart = getNumber(line.startTime);
        const lineEnd = getNumber(line.endTime);
        if (lineStart === null || lineEnd === null) return true;
        return lineEnd >= startTime && lineStart <= endTime;
      })
    : draft.transcript;

  return {
    ...draft,
    segment_start_time: startTime,
    segment_end_time: endTime,
    ...(transcript ? { transcript } : {}),
  };
}

function formatDurationLabel(seconds: number | null) {
  if (seconds === null) return "편집 범위 없음";
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  const rest = `${rounded % 60}`.padStart(2, "0");
  return `${minutes}:${rest}`;
}

function getSourceLabel(pipelineSummary?: PremiumPipelineAdminSummary | null) {
  if (!pipelineSummary) return "아직 실행 전";
  if (pipelineSummary.keySegmentSource === "ai") {
    return [
      "AI 선택",
      pipelineSummary.keySegmentProvider,
      pipelineSummary.keySegmentModel,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  if (pipelineSummary.keySegmentSource === "operator") {
    return "운영자 선택";
  }
  return "자동 후보";
}

function getModuleLabel(pipelineSummary?: PremiumPipelineAdminSummary | null) {
  if (!pipelineSummary) return "아직 실행 전";
  if (pipelineSummary.moduleSource === "ai") {
    return [
      "AI 생성",
      pipelineSummary.moduleProvider,
      pipelineSummary.moduleModel,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return "기본 생성";
}

function getExpressionCardLabel(
  pipelineSummary?: PremiumPipelineAdminSummary | null,
) {
  if (!pipelineSummary) return "아직 실행 전";
  if (!pipelineSummary.expressionCardSource) return "아직 실행 전";
  if (pipelineSummary.expressionCardSource === "ai") {
    return [
      "AI 표현 카드",
      pipelineSummary.expressionCardProvider,
      pipelineSummary.expressionCardModel,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  return "기본 표현 카드";
}

export function getPremiumAdminOperationalSummary({
  draft,
  parseError,
  pipelineSummary,
  sessionId,
}: {
  draft: PremiumAdminDraft | null;
  parseError?: string | null;
  pipelineSummary?: PremiumPipelineAdminSummary | null;
  sessionId?: string | null;
}): PremiumAdminOperationalSummary {
  const stats = getPremiumAdminDraftStats(draft);
  const transcript = Array.isArray(draft?.transcript) ? draft.transcript : [];
  const roleplayTurns = Array.isArray(draft?.roleplay?.turns)
    ? draft.roleplay.turns
    : [];
  const roleplayUserTurnCount = roleplayTurns.filter((turn) => {
    if (turn.speaker !== "user") return false;
    return Boolean(getString(turn.reference_text) ?? getString(turn.line));
  }).length;
  const startTime = getNumber(draft?.segment_start_time);
  const endTime = getNumber(draft?.segment_end_time);
  const cropDuration =
    startTime !== null && endTime !== null && endTime > startTime
      ? endTime - startTime
      : null;

  const readinessItems: PremiumAdminReadinessItem[] = [
    {
      id: "draft",
      label: "초안 JSON",
      done: Boolean(draft && !parseError),
      detail: parseError ?? "JSON 확인 완료",
    },
    {
      id: "session",
      label: "초안 저장",
      done: Boolean(sessionId?.trim()),
      detail: sessionId?.trim() || "초안을 저장하면 세션 아이디가 생깁니다",
    },
    {
      id: "transcript",
      label: "자막",
      done: stats.transcriptCount > 0,
      detail: `${stats.transcriptCount}줄`,
    },
    {
      id: "crop",
      label: "단일 편집 범위",
      done: cropDuration !== null,
      detail: formatDurationLabel(cropDuration),
    },
    {
      id: "article",
      label: "아티클 검수",
      done: stats.articleReviewed,
      detail: stats.articleReviewed ? "검수 완료" : "사람 검수가 필요합니다",
    },
    {
      id: "anchor",
      label: "핵심 표현",
      done: stats.anchorCount > 0,
      detail: `${stats.anchorCount}개`,
    },
    {
      id: "expressions",
      label: "표현 카드 검수",
      done: stats.expressionReviewed,
      detail: `${stats.expressionCards.length}개`,
    },
    {
      id: "roleplay",
      label: "롤플레잉 검수",
      done: stats.roleplayReviewed && roleplayUserTurnCount > 0,
      detail: `${roleplayUserTurnCount}개 발화`,
    },
    {
      id: "session-review",
      label: "세션 검수",
      done: stats.sessionReviewed,
      detail: stats.sessionReviewed ? "검수 완료" : "최종 확인이 필요합니다",
    },
  ];
  const readyCount = readinessItems.filter((item) => item.done).length;
  const blockingIssues = readinessItems
    .filter((item) => !item.done)
    .map((item) => `${item.label}: ${item.detail}`);

  return {
    sourceLabel: getSourceLabel(pipelineSummary),
    moduleLabel: getModuleLabel(pipelineSummary),
    expressionCardLabel: getExpressionCardLabel(pipelineSummary),
    cropLabel: formatDurationLabel(cropDuration),
    reviewLabel: `${readyCount}/${readinessItems.length}개 완료`,
    publishReady: blockingIssues.length === 0,
    readyCount,
    totalCount: readinessItems.length,
    blockingIssues,
    readinessItems,
    deliveryLinkedCount: 0,
    roleplayUserTurnCount,
  };
}

export function markPremiumDraftReview(
  draft: PremiumAdminDraft,
  target: PremiumReviewTarget,
  reviewed = true,
): PremiumAdminDraft {
  const nextDraft: PremiumAdminDraft = { ...draft };

  if (target === "article" || target === "all") {
    nextDraft.article = draft.article
      ? { ...draft.article, reviewed }
      : draft.article;
  }

  if (target === "delivery" || target === "all") {
    nextDraft.delivery_analysis = Array.isArray(draft.delivery_analysis)
      ? draft.delivery_analysis.map((item) => ({ ...item, reviewed }))
      : draft.delivery_analysis;
  }

  if (target === "expressions" || target === "all") {
    nextDraft.expression_cards = Array.isArray(draft.expression_cards)
      ? draft.expression_cards.map((card) => ({ ...card, reviewed }))
      : draft.expression_cards;
  }

  if (target === "roleplay" || target === "all") {
    nextDraft.roleplay = draft.roleplay
      ? { ...draft.roleplay, reviewed }
      : draft.roleplay;
  }

  if (target === "session" || target === "all") {
    nextDraft.reviewed = reviewed;
  }

  return nextDraft;
}

function uniqueStrings(values: Array<string | undefined | null>) {
  return [...new Set(values.filter(Boolean) as string[])];
}

export function appendPremiumExpressionCard(
  draft: PremiumAdminDraft,
  card: PremiumExpressionCard,
): PremiumAdminDraft {
  const expressionId = card.id ?? card.expression;
  const existingCards = Array.isArray(draft.expression_cards)
    ? draft.expression_cards
    : [];
  const roleplay = draft.roleplay;

  return {
    ...draft,
    expression_cards: [...existingCards, card],
    roleplay: roleplay
      ? {
          ...roleplay,
          target_expression_ids: uniqueStrings([
            ...(Array.isArray(roleplay.target_expression_ids)
              ? roleplay.target_expression_ids
              : []),
            expressionId,
          ]),
          turns: Array.isArray(roleplay.turns)
            ? roleplay.turns.map((turn) =>
                turn.speaker === "user"
                  ? {
                      ...turn,
                      expression_ids: uniqueStrings([
                        ...(Array.isArray(turn.expression_ids)
                          ? turn.expression_ids
                          : []),
                        expressionId,
                      ]),
                    }
                  : turn,
              )
            : roleplay.turns,
        }
      : roleplay,
  };
}
