import { z } from "zod";
import {
  premiumExpressionCardSchema,
  premiumSessionDraftSchema,
  premiumTranscriptLineSchema,
  type PremiumSessionDraftInput,
} from "@/lib/premium/session-schema";

export const premiumPipelineKeySegmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  startTime: z.number().nonnegative(),
  endTime: z.number().positive(),
  reason: z.string().min(1),
});

export const premiumPipelineRequestSchema = z.object({
  sourceUrl: z.string().url(),
  sourceVideoId: z.string().min(1).optional(),
  title: z.string().min(1).optional(),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  thumbnailUrl: z.string().url().nullable().optional(),
  channelName: z.string().nullable().optional(),
  speakerName: z.string().nullable().optional(),
  durationSeconds: z.number().int().positive().optional(),
  sourceType: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  speakingSituations: z.array(z.string()).optional().default([]),
  interestTags: z.array(z.string()).optional().default([]),
  difficultyLevel: z.number().int().min(1).max(5).nullable().optional(),
  transcript: z.array(premiumTranscriptLineSchema).min(1).optional(),
  keySegments: z.array(premiumPipelineKeySegmentSchema).optional(),
  expressionCards: z.array(premiumExpressionCardSchema).optional().default([]),
});

export type PremiumPipelineRequest = z.input<
  typeof premiumPipelineRequestSchema
>;
export type PremiumPipelineKeySegment = z.infer<
  typeof premiumPipelineKeySegmentSchema
>;
type PremiumPipelineData = z.infer<typeof premiumPipelineRequestSchema>;
type PremiumTranscriptLine = z.infer<typeof premiumTranscriptLineSchema>;

export interface PremiumPipelineCrop {
  startTime: number;
  endTime: number;
  paddingBeforeSeconds: number;
  paddingAfterSeconds: number;
}

export interface PremiumPipelineDraftResult {
  session: PremiumSessionDraftInput;
  pipeline: {
    sourceUrl: string;
    keySegments: [PremiumPipelineKeySegment];
    crop: PremiumPipelineCrop;
    generatedModules: Array<"article" | "expression_cards" | "roleplay">;
  };
}

const MAX_CROP_WINDOW_SECONDS = 180;
const CONTEXT_WINDOW_SECONDS = 30;

function formatTimestamp(seconds: number): string {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = `${Math.floor(rounded / 60)}`.padStart(2, "0");
  const rest = `${rounded % 60}`.padStart(2, "0");
  return `${minutes}:${rest}`;
}

function clipText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatQuoted(text: string, maxLength: number): string {
  return `"${clipText(text, maxLength)}"`;
}

function getSegmentContextLines(
  transcript: PremiumTranscriptLine[],
  segment: PremiumPipelineKeySegment,
  anchorLine: PremiumTranscriptLine,
): PremiumTranscriptLine[] {
  const nearbyLines = transcript.filter(
    (line) =>
      line.endTime >= segment.startTime - CONTEXT_WINDOW_SECONDS &&
      line.startTime <= segment.endTime + CONTEXT_WINDOW_SECONDS,
  );
  const lines = nearbyLines.some((line) => line.id === anchorLine.id)
    ? nearbyLines
    : [...nearbyLines, anchorLine];

  return lines.sort((a, b) => a.startTime - b.startTime).slice(0, 4);
}

function buildSegmentContextText(lines: PremiumTranscriptLine[]): string {
  return lines
    .map(
      (line) => `${formatTimestamp(line.startTime)} ${clipText(line.text, 96)}`,
    )
    .join("\n");
}

function buildGroundedArticle(input: {
  data: PremiumPipelineData;
  segment: PremiumPipelineKeySegment;
  crop: PremiumPipelineCrop;
  anchorLine: PremiumTranscriptLine;
  croppedTranscript: PremiumTranscriptLine[];
}) {
  const { data, segment, crop, anchorLine, croppedTranscript } = input;
  const context = buildSegmentContextText(
    getSegmentContextLines(croppedTranscript, segment, anchorLine),
  );
  const title = data.title ?? segment.title;
  const quotedAnchor = formatQuoted(anchorLine.text, 140);

  return {
    title: "오늘의 장면 노트",
    subtitle: title,
    body: [
      `선택 구간은 ${formatTimestamp(segment.startTime)}-${formatTimestamp(segment.endTime)}의 ${quotedAnchor}입니다. 운영자는 이 문장이 오늘의 anchor로 충분한지, 앞뒤 자막이 같은 장면을 받쳐 주는지 확인합니다.`,
      `자막 맥락:\n${context}`,
      `세그먼트 선택 이유: ${clipText(segment.reason, 160)} 이 초안은 발행 전 기사 본문, 표현 카드, 롤플레이가 같은 문장을 가리키는지 점검하기 위한 review copy입니다.`,
    ].join("\n\n"),
    summary_bullets: [
      `${formatTimestamp(crop.startTime)}-${formatTimestamp(crop.endTime)} 범위로 편집된 세션입니다.`,
      `Anchor 후보: ${formatQuoted(anchorLine.text, 96)}`,
      `검수 포인트: ${clipText(segment.reason, 88)}`,
    ],
    reading_minutes: 2,
    reviewed: false,
  };
}

function buildGroundedRoleplay(input: {
  data: PremiumPipelineData;
  segment: PremiumPipelineKeySegment;
  anchorLine: PremiumTranscriptLine;
}) {
  const { data, segment, anchorLine } = input;
  const targetExpressionCards = data.expressionCards;
  const targetExpressionIds = targetExpressionCards.map(
    (card) => card.id ?? card.expression,
  );
  const anchorExpression =
    targetExpressionCards.find((card) => card.depth === "anchor") ??
    targetExpressionCards[0];
  const referenceText =
    anchorExpression?.source_line?.trim() || anchorLine.text;
  const sourceTitle = data.title ?? segment.title;

  return {
    title: "선택 장면으로 답하기",
    situation: `${sourceTitle}의 ${formatTimestamp(segment.startTime)} 장면을 바탕으로, 비슷한 회의나 인터뷰 상황에서 같은 뜻을 짧게 말한다.`,
    user_role: "학습자",
    partner_role: "상황 속 동료",
    target_expression_ids: targetExpressionIds,
    turns: [
      {
        id: "roleplay-a-1",
        speaker: "coach" as const,
        avatar_label: "A",
        line: "We need to answer this in a way that gives credit without sounding too formal.",
        translation: "너무 딱딱하지 않게 공을 돌리는 방식으로 답해야 해요.",
        expression_ids: [],
      },
      {
        id: "roleplay-b-1",
        speaker: "coach" as const,
        avatar_label: "B",
        line: "Right. How would you say it if this were your team?",
        translation: "맞아요. 이게 당신 팀 이야기라면 어떻게 말할 수 있을까요?",
        expression_ids: [],
      },
      {
        id: "roleplay-user-1",
        speaker: "user" as const,
        avatar_label: "C",
        hidden: true,
        translation: anchorExpression?.expression
          ? `${anchorExpression.expression} 표현을 써서 내 상황에 맞게 말해보는 차례입니다.`
          : "선택한 장면의 뜻을 유지하면서 내 상황에 맞게 말해보는 차례입니다.",
        reference_text: referenceText,
        expression_ids: targetExpressionIds,
      },
    ],
    analysis_reference_text: referenceText,
    reviewed: false,
  };
}

export function resolveYouTubeVideoId(sourceUrl: string): string {
  const url = new URL(sourceUrl);
  if (url.hostname === "youtu.be") {
    return url.pathname.replace("/", "");
  }
  return (
    url.searchParams.get("v") ??
    url.pathname.split("/").filter(Boolean).pop() ??
    ""
  );
}

export function selectSinglePremiumKeySegment(
  transcript: PremiumPipelineRequest["transcript"],
): PremiumPipelineKeySegment {
  if (!transcript?.length) {
    throw new Error("transcript is required before selecting a key segment");
  }

  const selected = transcript.reduce((best, line) =>
    line.text.length > best.text.length ? line : best,
  );

  return {
    id: `segment-${selected.id}`,
    title: selected.text.slice(0, 64),
    startTime: selected.startTime,
    endTime: selected.endTime,
    reason: "가장 정보량이 높은 문장이라 세션의 anchor 후보로 적합합니다.",
  };
}

export function resolveSinglePremiumKeySegment(
  transcript: PremiumPipelineRequest["transcript"],
  keySegments: PremiumPipelineRequest["keySegments"],
): PremiumPipelineKeySegment {
  if (keySegments && keySegments.length !== 1) {
    throw new Error("premium pipeline must produce exactly one key segment");
  }
  return keySegments?.[0] ?? selectSinglePremiumKeySegment(transcript);
}

export function calculatePremiumCrop(
  segment: PremiumPipelineKeySegment,
  durationSeconds: number,
): PremiumPipelineCrop {
  if (segment.endTime <= segment.startTime) {
    throw new Error("key segment endTime must be greater than startTime");
  }

  const boundedDuration = Math.max(segment.endTime, durationSeconds);
  const segmentDuration = segment.endTime - segment.startTime;
  const windowSeconds = Math.min(
    boundedDuration,
    Math.max(segmentDuration, MAX_CROP_WINDOW_SECONDS),
  );
  const segmentCenter = segment.startTime + segmentDuration / 2;
  const rawStartTime = segmentCenter - windowSeconds / 2;
  const startTime = Math.max(
    0,
    Math.min(rawStartTime, boundedDuration - windowSeconds),
  );
  const endTime = Math.min(boundedDuration, startTime + windowSeconds);

  return {
    startTime: Number(startTime.toFixed(2)),
    endTime: Number(endTime.toFixed(2)),
    paddingBeforeSeconds: Number((segment.startTime - startTime).toFixed(2)),
    paddingAfterSeconds: Number((endTime - segment.endTime).toFixed(2)),
  };
}

export function buildPremiumPipelineDraft(
  input: PremiumPipelineRequest,
): PremiumPipelineDraftResult {
  const data = premiumPipelineRequestSchema.parse(input);
  const transcript = data.transcript ?? [];
  const sourceVideoId =
    data.sourceVideoId ?? resolveYouTubeVideoId(data.sourceUrl);
  if (!sourceVideoId) throw new Error("sourceVideoId could not be resolved");

  const segment = resolveSinglePremiumKeySegment(transcript, data.keySegments);
  const durationSeconds =
    data.durationSeconds ??
    Math.ceil(
      Math.max(...transcript.map((line) => line.endTime), segment.endTime),
    );
  const crop = calculatePremiumCrop(segment, durationSeconds);
  const croppedTranscript = transcript.filter(
    (line) => line.endTime >= crop.startTime && line.startTime <= crop.endTime,
  );
  const anchorLine =
    croppedTranscript.find(
      (line) =>
        line.startTime <= segment.startTime && line.endTime >= segment.endTime,
    ) ??
    croppedTranscript[0] ??
    transcript[0];

  const session = {
    source_video_id: sourceVideoId,
    source_url: data.sourceUrl,
    title: data.title ?? segment.title,
    subtitle: data.subtitle ?? null,
    description:
      data.description ??
      "오늘의 한 장면을 읽고, 듣고, 말하기까지 이어가는 프리미엄 큐레이션.",
    thumbnail_url:
      data.thumbnailUrl ??
      `https://img.youtube.com/vi/${sourceVideoId}/hqdefault.jpg`,
    channel_name: data.channelName ?? null,
    speaker_name: data.speakerName ?? null,
    source_type: data.sourceType ?? null,
    genre: data.genre ?? null,
    speaking_situations: data.speakingSituations,
    interest_tags: data.interestTags,
    difficulty_level: data.difficultyLevel ?? null,
    duration_seconds: durationSeconds,
    segment_start_time: crop.startTime,
    segment_end_time: crop.endTime,
    transcript: croppedTranscript,
    article: buildGroundedArticle({
      data,
      segment,
      crop,
      anchorLine,
      croppedTranscript,
    }),
    delivery_analysis: [],
    roleplay: buildGroundedRoleplay({ data, segment, anchorLine }),
    expression_cards: data.expressionCards,
    reviewed: false,
  };

  return {
    session: premiumSessionDraftSchema.parse(session),
    pipeline: {
      sourceUrl: data.sourceUrl,
      keySegments: [segment],
      crop,
      generatedModules: ["article", "expression_cards", "roleplay"],
    },
  };
}
