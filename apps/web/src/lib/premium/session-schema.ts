import { z } from "zod";
import type {
  PremiumArticle,
  PremiumExpressionCard,
  PremiumExpressionDepth,
  PremiumRoleplay,
  PremiumSession,
} from "@inputenglish/shared";
import { findPremiumCopySlop } from "@inputenglish/shared";

export const premiumTranscriptLineSchema = z.object({
  id: z.string().min(1),
  text: z.string().min(1),
  translation: z.string().optional(),
  startTime: z.number().nonnegative(),
  endTime: z.number().nonnegative(),
  speaker: z.string().nullable().optional(),
  delivery_note: z.string().nullable().optional(),
  analysis_note: z.string().nullable().optional(),
});

export const premiumArticleSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  body: z.string().min(1),
  summary_bullets: z.array(z.string()).optional().default([]),
  reading_minutes: z.number().int().positive().nullable().optional(),
  reviewed: z.boolean().default(false),
});

export const premiumDeliveryAnalysisSchema = z.object({
  id: z.string().min(1),
  line_id: z.string().min(1),
  intonation_note: z.string().min(1),
  style_note: z.string().min(1),
  coaching_note: z.string().min(1),
  reviewed: z.boolean().default(false),
});

export const premiumExpressionPronunciationSchema = z.object({
  stress: z.string().min(1),
  linking: z.string().min(1),
  trap_ko: z.string().min(1),
  ipa: z.string().min(1),
  say_it_ko: z.string().min(1),
  drill: z.string().min(1),
});

export const premiumExpressionVariationSchema = z.object({
  en: z.string().min(1),
  when_ko: z.string().min(1),
});

export const premiumExpressionSavedAtomsSchema = z.object({
  headword: z.string().min(1),
  one_line_nuance_ko: z.string().min(1),
  register_ko: z.string().min(1),
  examples: z.array(z.string().min(1)).min(1),
});

export const premiumExpressionCardBaseSchema = z.object({
  id: z.string().optional(),
  session_id: z.string().uuid().optional(),
  source_sentence_id: z.string().nullable().optional(),
  order_index: z.number().int().nonnegative().default(0),
  depth: z.enum(["anchor", "support"]),
  expression: z.string().min(1),
  source_line: z.string().min(1),
  timestamp: z.string().min(1),
  natural_meaning_ko: z.string().min(1),
  story: z.string().min(1),
  pronunciation: premiumExpressionPronunciationSchema,
  variations: z.array(premiumExpressionVariationSchema).default([]),
  saved_atoms: premiumExpressionSavedAtomsSchema,
  reviewed: z.boolean().default(false),
});

function countStoryParagraphs(story: string): number {
  return story
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean).length;
}

export const premiumExpressionCardSchema =
  premiumExpressionCardBaseSchema.superRefine((value, ctx) => {
    if (value.depth === "support" && value.variations.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["variations"],
        message: "support expression cards must not include variations",
      });
    }
    if (value.depth === "support" && countStoryParagraphs(value.story) > 2) {
      ctx.addIssue({
        code: "custom",
        path: ["story"],
        message: "support expression card stories must be 1-2 paragraphs",
      });
    }
  });

export const premiumRoleplayTurnSchema = z.object({
  id: z.string().min(1),
  speaker: z.enum(["coach", "user"]),
  avatar_label: z.string().nullable().optional(),
  line: z.string().nullable().optional(),
  translation: z.string().nullable().optional(),
  hidden: z.boolean().optional(),
  reference_text: z.string().nullable().optional(),
  expression_ids: z.array(z.string()).optional().default([]),
});

export const premiumRoleplaySchema = z.object({
  title: z.string().min(1),
  situation: z.string().min(1),
  user_role: z.string().min(1),
  partner_role: z.string().min(1),
  turns: z.array(premiumRoleplayTurnSchema).default([]),
  target_expression_ids: z.array(z.string()).default([]),
  analysis_reference_text: z.string().nullable().optional(),
  reviewed: z.boolean().default(false),
});

export const premiumSessionDraftSchema = z.object({
  id: z.string().uuid().optional(),
  slug: z.string().nullable().optional(),
  source_video_id: z.string().min(1),
  source_url: z.string().url(),
  title: z.string().min(1),
  subtitle: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  thumbnail_url: z.string().url().nullable().optional(),
  channel_name: z.string().nullable().optional(),
  speaker_name: z.string().nullable().optional(),
  source_type: z.string().nullable().optional(),
  genre: z.string().nullable().optional(),
  speaking_situations: z.array(z.string()).default([]),
  interest_tags: z.array(z.string()).default([]),
  difficulty_level: z.number().int().min(1).max(5).nullable().optional(),
  duration_seconds: z.number().int().nonnegative().default(0),
  segment_start_time: z.number().nonnegative().default(0),
  segment_end_time: z.number().nonnegative().default(0),
  transcript: z.array(premiumTranscriptLineSchema).default([]),
  article: premiumArticleSchema,
  delivery_analysis: z.array(premiumDeliveryAnalysisSchema).default([]),
  roleplay: premiumRoleplaySchema,
  expression_cards: z.array(premiumExpressionCardSchema).default([]),
  reviewed: z.boolean().default(false),
  published_on: z.string().nullable().optional(),
});

export type PremiumSessionDraftInput = z.infer<
  typeof premiumSessionDraftSchema
>;

export function parseAiExpressionCard(
  raw: string,
  depth: PremiumExpressionDepth,
): Omit<PremiumExpressionCard, "id" | "order_index"> {
  const cleaned = raw
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
  const parsed = JSON.parse(cleaned) as unknown;
  const card = premiumExpressionCardBaseSchema
    .omit({ id: true, order_index: true, session_id: true })
    .parse({ ...(parsed as object), depth });
  premiumExpressionCardSchema.parse({ ...card, order_index: 0 });
  return card;
}

export function buildPremiumSessionRow(
  input: PremiumSessionDraftInput,
  adminUserId: string,
) {
  return {
    ...(input.id ? { id: input.id } : {}),
    slug: input.slug ?? null,
    source_video_id: input.source_video_id,
    source_url: input.source_url,
    title: input.title,
    subtitle: input.subtitle ?? null,
    description: input.description ?? null,
    thumbnail_url: input.thumbnail_url ?? null,
    channel_name: input.channel_name ?? null,
    speaker_name: input.speaker_name ?? null,
    source_type: input.source_type ?? null,
    genre: input.genre ?? null,
    speaking_situations: input.speaking_situations,
    interest_tags: input.interest_tags,
    difficulty_level: input.difficulty_level ?? null,
    duration_seconds: input.duration_seconds,
    segment_start_time: input.segment_start_time,
    segment_end_time: input.segment_end_time,
    transcript: input.transcript,
    article: input.article,
    delivery_analysis: input.delivery_analysis,
    roleplay: input.roleplay,
    status: "draft",
    reviewed: input.reviewed,
    published_on: input.published_on ?? null,
    published_at: null,
    updated_by: adminUserId,
    ...(input.id ? {} : { created_by: adminUserId }),
  };
}

export function buildPremiumArticleRow(
  sessionId: string,
  article: PremiumSessionDraftInput["article"],
) {
  return {
    session_id: sessionId,
    title: article.title,
    subtitle: article.subtitle ?? null,
    body: article.body,
    summary_bullets: article.summary_bullets ?? [],
    reading_minutes: article.reading_minutes ?? null,
    reviewed: article.reviewed,
  };
}

export function buildPremiumExpressionRows(
  sessionId: string,
  cards: PremiumSessionDraftInput["expression_cards"],
) {
  return cards.map((card, index) => ({
    ...(card.id ? { id: card.id } : {}),
    session_id: sessionId,
    source_sentence_id: card.source_sentence_id ?? null,
    order_index: index,
    depth: card.depth,
    expression: card.expression,
    source_line: card.source_line,
    timestamp: card.timestamp,
    natural_meaning_ko: card.natural_meaning_ko,
    story: card.story,
    pronunciation: card.pronunciation,
    variations: card.variations,
    saved_atoms: card.saved_atoms,
    reviewed: card.reviewed,
  }));
}

export function mapPremiumArticleRow(
  row: Record<string, unknown>,
): PremiumArticle {
  return premiumArticleSchema.parse({
    title: row.title,
    subtitle: row.subtitle ?? null,
    body: row.body,
    summary_bullets: row.summary_bullets ?? [],
    reading_minutes: row.reading_minutes ?? null,
    reviewed: row.reviewed,
  });
}

export function hydratePremiumSession(
  row: Record<string, unknown>,
  cards: PremiumExpressionCard[],
  articleOverride?: PremiumArticle | null,
): PremiumSession {
  return {
    id: String(row.id),
    slug: (row.slug as string | null) ?? null,
    source_video_id: String(row.source_video_id),
    source_url: String(row.source_url),
    title: String(row.title),
    subtitle: (row.subtitle as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    thumbnail_url: (row.thumbnail_url as string | null) ?? null,
    channel_name: (row.channel_name as string | null) ?? null,
    speaker_name: (row.speaker_name as string | null) ?? null,
    source_type: (row.source_type as PremiumSession["source_type"]) ?? null,
    genre: (row.genre as PremiumSession["genre"]) ?? null,
    speaking_situations: Array.isArray(row.speaking_situations)
      ? (row.speaking_situations as PremiumSession["speaking_situations"])
      : [],
    interest_tags: Array.isArray(row.interest_tags)
      ? (row.interest_tags as string[])
      : [],
    difficulty_level:
      typeof row.difficulty_level === "number"
        ? (row.difficulty_level as PremiumSession["difficulty_level"])
        : null,
    duration_seconds: Number(row.duration_seconds ?? 0),
    segment_start_time: Number(row.segment_start_time ?? 0),
    segment_end_time: Number(row.segment_end_time ?? 0),
    transcript: premiumSessionDraftSchema.shape.transcript.parse(
      row.transcript ?? [],
    ),
    article: premiumArticleSchema.parse(articleOverride ?? row.article ?? {}),
    delivery_analysis: z
      .array(premiumDeliveryAnalysisSchema)
      .parse(row.delivery_analysis ?? []),
    roleplay: premiumRoleplaySchema.parse(row.roleplay ?? {}),
    expression_cards: cards,
    status: row.status as PremiumSession["status"],
    reviewed: Boolean(row.reviewed),
    published_on: (row.published_on as string | null) ?? null,
    published_at: (row.published_at as string | null) ?? null,
    created_at: (row.created_at as string | undefined) ?? undefined,
    updated_at: (row.updated_at as string | undefined) ?? undefined,
  };
}

function normalizeExpressionMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[“”"'.!?;:()[\]{}]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textContainsExpression(text: string, expression: string) {
  const normalizedText = normalizeExpressionMatch(text);
  const normalizedExpression = normalizeExpressionMatch(expression);
  return (
    normalizedExpression.length > 0 &&
    normalizedText.includes(normalizedExpression)
  );
}

export function getPremiumPublishIssues(input: {
  session: PremiumSessionDraftInput;
  cards: PremiumExpressionCard[];
}): string[] {
  const issues: string[] = [];
  const { session, cards } = input;
  const transcriptIds = new Set(session.transcript.map((line) => line.id));
  const cardIdentifiers = new Set(
    cards.flatMap((card) => [card.id, card.expression]).filter(Boolean),
  );

  if (session.transcript.length === 0) issues.push("transcript is empty");
  if (session.segment_end_time <= session.segment_start_time) {
    issues.push("segment endTime must be greater than startTime");
  }
  if (
    session.duration_seconds > 0 &&
    session.segment_end_time > session.duration_seconds
  ) {
    issues.push("segment endTime exceeds duration");
  }
  session.transcript.forEach((line) => {
    if (line.endTime <= line.startTime) {
      issues.push(
        `transcript line ${line.id} endTime must be greater than startTime`,
      );
    }
  });
  if (
    session.transcript.length > 0 &&
    !session.transcript.some(
      (line) =>
        line.endTime >= session.segment_start_time &&
        line.startTime <= session.segment_end_time,
    )
  ) {
    issues.push("segment has no transcript coverage");
  }
  if (!session.article.body.trim()) issues.push("article body is empty");
  for (const issue of findPremiumCopySlop(
    [
      session.article.title,
      session.article.subtitle ?? "",
      session.article.body,
      ...(session.article.summary_bullets ?? []),
    ].join("\n"),
  )) {
    issues.push(`copy slop in article: ${issue}`);
  }
  for (const issue of findPremiumCopySlop(
    session.transcript
      .flatMap((line) => [
        line.translation ?? "",
        line.delivery_note ?? "",
        line.analysis_note ?? "",
      ])
      .join("\n"),
  )) {
    issues.push(`copy slop in transcript: ${issue}`);
  }
  if (!session.article.reviewed) issues.push("article is not reviewed");
  // @MX:NOTE: [AUTO] Delivery analysis is only mandatory before expression
  // cards exist. Pipeline-generated drafts intentionally leave
  // delivery_analysis empty once expression cards take over as the primary
  // coaching content, so gate the emptiness check on card presence instead
  // of requiring it unconditionally.
  if (cards.length === 0 && session.delivery_analysis.length === 0) {
    issues.push("delivery analysis is empty");
  }
  session.delivery_analysis.forEach((item) => {
    if (!transcriptIds.has(item.line_id)) {
      issues.push(`delivery analysis ${item.id} line_id is not in transcript`);
    }
  });
  for (const issue of findPremiumCopySlop(
    session.delivery_analysis
      .flatMap((item) => [
        item.intonation_note,
        item.style_note,
        item.coaching_note,
      ])
      .join("\n"),
  )) {
    issues.push(`copy slop in delivery analysis: ${issue}`);
  }
  if (cards.length === 0) issues.push("expression cards are empty");
  if (cards.some((card) => !card.reviewed)) {
    issues.push("expression cards are not fully reviewed");
  }
  cards.forEach((card) => {
    if (
      card.source_sentence_id &&
      !transcriptIds.has(card.source_sentence_id)
    ) {
      issues.push(
        `expression card ${card.expression} source_sentence_id is not in transcript`,
      );
    }
    const cardCopy = [
      card.natural_meaning_ko,
      card.story,
      card.pronunciation.trap_ko,
      card.pronunciation.say_it_ko,
      card.saved_atoms.one_line_nuance_ko,
      card.saved_atoms.register_ko,
      ...card.variations.map((variation) => variation.when_ko),
    ].join("\n");
    for (const issue of findPremiumCopySlop(cardCopy)) {
      issues.push(`copy slop in expression card ${card.expression}: ${issue}`);
    }
  });
  if (!cards.some((card) => card.depth === "anchor")) {
    issues.push("at least one anchor expression card is required");
  }
  if (!cards.some((card) => card.depth === "support")) {
    issues.push("at least one support expression card is required");
  }
  cards.forEach((card) => {
    if (card.depth !== "support") return;
    if (card.variations.length > 0) {
      issues.push(
        `support expression card ${card.expression} must not include variations`,
      );
    }
    if (countStoryParagraphs(card.story) > 2) {
      issues.push(
        `support expression card ${card.expression} story must be 1-2 paragraphs`,
      );
    }
  });

  const roleplay = session.roleplay as PremiumRoleplay;
  if (roleplay.turns.length === 0) issues.push("roleplay turns are empty");
  if (!roleplay.reviewed) issues.push("roleplay is not reviewed");
  if (!session.reviewed) issues.push("session is not reviewed");
  if (!roleplay.turns.some((turn) => turn.speaker === "user")) {
    issues.push("roleplay needs at least one user turn");
  }
  if (roleplay.turns.some((turn) => !turn.translation?.trim())) {
    issues.push("roleplay translations are incomplete");
  }
  for (const issue of findPremiumCopySlop(
    [
      roleplay.title,
      roleplay.situation,
      roleplay.user_role,
      roleplay.partner_role,
      roleplay.analysis_reference_text ?? "",
      ...roleplay.turns.flatMap((turn) => [
        turn.line ?? "",
        turn.translation ?? "",
        turn.reference_text ?? "",
      ]),
    ].join("\n"),
  )) {
    issues.push(`copy slop in roleplay: ${issue}`);
  }
  if (
    !roleplay.analysis_reference_text?.trim() &&
    !roleplay.turns.some(
      (turn) => turn.speaker === "user" && turn.reference_text?.trim(),
    )
  ) {
    issues.push("roleplay needs analysis reference text");
  }
  const roleplayReferenceText = [
    roleplay.analysis_reference_text ?? "",
    ...roleplay.turns
      .filter((turn) => turn.speaker === "user")
      .map((turn) => turn.reference_text ?? ""),
  ].join("\n");
  const anchorCard = cards.find((card) => card.depth === "anchor");
  if (
    anchorCard &&
    !textContainsExpression(roleplayReferenceText, anchorCard.expression)
  ) {
    issues.push(
      `roleplay reference text must use anchor expression ${anchorCard.expression}`,
    );
  }
  roleplay.target_expression_ids.forEach((expressionId) => {
    if (!cardIdentifiers.has(expressionId)) {
      issues.push(
        `roleplay target expression ${expressionId} is not in expression cards`,
      );
    }
  });
  roleplay.turns.forEach((turn) => {
    (turn.expression_ids ?? []).forEach((expressionId) => {
      if (!cardIdentifiers.has(expressionId)) {
        issues.push(
          `roleplay turn ${turn.id} expression ${expressionId} is not in expression cards`,
        );
      }
    });
  });

  return issues;
}
