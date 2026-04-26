import { SPEAKING_SITUATIONS } from "@inputenglish/shared";
import type {
  CuratedVideo,
  LearningGoalMode,
  LearningLevelBand,
  LearningProfile,
  Sentence,
  TransformationSet,
} from "@inputenglish/shared";
import type { SessionListItem } from "@/lib/api";
import {
  fetchCuratedVideo,
  fetchLearningSessions,
  fetchSessionsByIds,
} from "@/lib/api";
import { fetchTransformationSet } from "@/lib/transformation-api";
import { getRecentSessionIds } from "@/lib/recent-sessions";
import storage from "@/lib/mmkv";

export interface DailyInputQueueItem {
  sessionId: string;
  videoId: string;
  title: string;
  thumbnailUrl?: string;
  channelName?: string;
  sentenceId: string;
  sentenceText: string;
  translation?: string;
  startTime: number;
  endTime: number;
  mode: LearningGoalMode;
  isReview: boolean;
  cardOrder: number;
  reason: string;
  transformationSet?: TransformationSet | null;
}

interface CachedDailyInputQueue {
  version: number;
  queueDate: string;
  profileHash: string;
  items: DailyInputQueueItem[];
}

const DAILY_INPUT_CACHE_PREFIX = "daily_input_queue";
const DAILY_INPUT_CACHE_VERSION = 3;
const MAX_DAILY_INPUT_ITEMS = 5;

const EXPRESSION_HINTS: Record<
  string,
  {
    sourceTypes?: Array<SessionListItem["source_type"]>;
    genres?: Array<SessionListItem["genre"]>;
    titleKeywords?: string[];
  }
> = {
  "일상 잡담": {
    sourceTypes: ["podcast", "interview", "panel"],
    genres: ["entertainment", "business", "news"],
    titleKeywords: ["chat", "conversation", "talk", "daily"],
  },
  "친구/연애": {
    sourceTypes: ["podcast", "interview"],
    genres: ["entertainment", "lifestyle"],
    titleKeywords: ["relationship", "friend", "dating", "love"],
  },
  "학교/업무": {
    sourceTypes: ["podcast", "earnings-call", "demo"],
    genres: ["business", "economy"],
    titleKeywords: ["update", "review", "work", "school", "meeting"],
  },
  "회의/업데이트": {
    sourceTypes: ["podcast", "earnings-call", "demo"],
    genres: ["business", "economy"],
    titleKeywords: ["update", "review", "wrap", "sync", "meeting"],
  },
  "발표/회의": {
    sourceTypes: ["demo", "keynote", "public-speech"],
    genres: ["tech", "business"],
    titleKeywords: ["demo", "launch", "presentation", "meeting"],
  },
  "발표/데모": {
    sourceTypes: ["demo", "keynote", "public-speech"],
    genres: ["tech", "business"],
    titleKeywords: ["demo", "launch", "presentation", "pitch"],
  },
  인터뷰: {
    sourceTypes: ["interview", "panel"],
    genres: ["business", "tech"],
    titleKeywords: ["interview", "career", "question", "answer"],
  },
  서비스직: {
    sourceTypes: ["interview", "podcast"],
    genres: ["business", "entertainment"],
    titleKeywords: ["service", "customer", "hospitality", "support"],
  },
  "자기소개/스몰토크": {
    sourceTypes: ["interview", "podcast", "panel"],
    genres: ["business", "entertainment", "news"],
    titleKeywords: ["introduce", "small talk", "icebreaker", "about me"],
  },
  "면접/자기소개": {
    sourceTypes: ["interview", "panel"],
    genres: ["business", "tech"],
    titleKeywords: ["interview", "career", "introduce"],
  },
  "설득/제안": {
    sourceTypes: ["demo", "keynote", "podcast"],
    genres: ["business", "tech"],
    titleKeywords: ["proposal", "sell", "convince", "pitch"],
  },
  브이로그: {
    sourceTypes: ["podcast", "interview"],
    genres: ["lifestyle", "entertainment"],
    titleKeywords: ["vlog", "day", "routine", "life"],
  },
  "영화 속 장면들": {
    sourceTypes: ["interview", "panel"],
    genres: ["entertainment"],
    titleKeywords: ["movie", "film", "scene", "cinema"],
  },
  "드라마 속 장면들": {
    sourceTypes: ["interview", "panel"],
    genres: ["entertainment"],
    titleKeywords: ["drama", "series", "scene", "show"],
  },
  "연설이나 강단 발표": {
    sourceTypes: ["keynote", "public-speech"],
    genres: ["tech", "business", "current-affairs"],
    titleKeywords: ["speech", "talk", "keynote", "lecture"],
  },
  "정보성 팟캐스트/인터뷰": {
    sourceTypes: ["podcast", "interview"],
    genres: ["tech", "business", "economy"],
    titleKeywords: ["podcast", "interview", "explain", "insight"],
  },
  "셀럽 인터뷰": {
    sourceTypes: ["interview", "panel"],
    genres: ["entertainment", "lifestyle"],
    titleKeywords: ["interview", "celebrity", "star", "artist"],
  },
  "최신 시사 이슈": {
    sourceTypes: ["podcast", "public-speech", "panel"],
    genres: ["current-affairs", "news", "economy", "politics"],
    titleKeywords: ["news", "issue", "today", "latest"],
  },
  "티키타카를 배울 수 있는 팟캐스트/토크쇼": {
    sourceTypes: ["podcast", "panel", "interview"],
    genres: ["entertainment", "news", "business"],
    titleKeywords: ["talk show", "banter", "conversation", "podcast"],
  },
};

const PRONUNCIATION_HINTS: Record<
  string,
  {
    sourceTypes?: Array<SessionListItem["source_type"]>;
    titleKeywords?: string[];
  }
> = {
  "Michelle Obama": {
    sourceTypes: ["public-speech", "interview", "panel"],
    titleKeywords: ["michelle obama", "michelle"],
  },
  "차분한 리더 톤": {
    sourceTypes: ["keynote", "earnings-call", "public-speech"],
    titleKeywords: ["leader", "ceo", "founder", "briefing"],
  },
  Oprah: {
    sourceTypes: ["interview", "panel", "podcast"],
    titleKeywords: ["oprah"],
  },
  "Taylor Swift": {
    sourceTypes: ["interview", "panel"],
    titleKeywords: ["taylor swift", "taylor"],
  },
  Zendaya: {
    sourceTypes: ["interview", "panel"],
    titleKeywords: ["zendaya"],
  },
  "Emma Watson": {
    sourceTypes: ["interview", "public-speech"],
    titleKeywords: ["emma watson", "emma"],
  },
  Jennie: {
    sourceTypes: ["interview", "panel"],
    titleKeywords: ["jennie"],
  },
  "Ryan Reynolds": {
    sourceTypes: ["interview", "panel", "podcast"],
    titleKeywords: ["ryan reynolds", "ryan"],
  },
  "Matt Damon": {
    sourceTypes: ["interview", "panel"],
    titleKeywords: ["matt damon", "matt"],
  },
  "Jensen Huang": {
    sourceTypes: ["keynote", "interview", "public-speech"],
    titleKeywords: ["jensen huang", "jensen", "nvidia"],
  },
  "또렷한 발표 스타일": {
    sourceTypes: ["demo", "keynote", "public-speech"],
    titleKeywords: ["presentation", "talk", "demo", "launch"],
  },
  "Simon Sinek": {
    sourceTypes: ["public-speech", "podcast", "interview"],
    titleKeywords: ["simon sinek", "simon"],
  },
  "설득력 있는 데모 말투": {
    sourceTypes: ["demo", "podcast"],
    titleKeywords: ["demo", "product", "pitch"],
  },
  "Conan O’Brien": {
    sourceTypes: ["interview", "podcast", "panel"],
    titleKeywords: ["conan", "obrien", "o'brien"],
  },
  "좋아하는 인물 따라하기": {
    sourceTypes: ["interview", "podcast", "panel"],
    titleKeywords: ["conversation", "interview", "fireside"],
  },
  "Barack Obama": {
    sourceTypes: ["public-speech", "interview", "panel"],
    titleKeywords: ["barack obama", "obama"],
  },
};

function getLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCacheKey(userId: string): string {
  return `${DAILY_INPUT_CACHE_PREFIX}:${userId}`;
}

function sortStrings(values: string[] | undefined): string[] {
  return [...(values ?? [])].sort((left, right) => left.localeCompare(right));
}

function getProfileHash(profile: LearningProfile): string {
  return JSON.stringify({
    goal_mode: profile.goal_mode,
    level_band: profile.level_band,
    focus_tags: sortStrings(profile.focus_tags),
    preferred_speakers: sortStrings(profile.preferred_speakers),
    preferred_situations: sortStrings(profile.preferred_situations),
    preferred_source_types: sortStrings(profile.preferred_source_types),
    preferred_genres: sortStrings(profile.preferred_genres),
  });
}

function mapLevelToDifficulty(levelBand: LearningLevelBand | null) {
  switch (levelBand) {
    case "beginner":
    case "basic":
      return "beginner";
    case "conversation":
      return "intermediate";
    case "professional":
      return "advanced";
    default:
      return null;
  }
}

function getSessionSearchText(session: SessionListItem): string {
  return [
    session.title,
    session.subtitle,
    session.description,
    session.channel_name,
    session.expected_takeaway,
    session.primary_speaker_name,
    ...(session.speaker_names ?? []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function normalizeTextArray(values: string[] | null | undefined): string[] {
  return (values ?? []).map((value) => normalizeText(value)).filter(Boolean);
}

function getPreferredExpressionSituations(profile: LearningProfile): string[] {
  if (profile.preferred_situations.length > 0) {
    return profile.preferred_situations;
  }

  return profile.focus_tags.filter((tag) =>
    SPEAKING_SITUATIONS.includes(tag as any),
  );
}

function getPreferredSourceTypes(profile: LearningProfile): string[] {
  return profile.preferred_source_types ?? [];
}

function getPreferredGenres(profile: LearningProfile): string[] {
  return profile.preferred_genres ?? [];
}

function scoreLevelFit(
  session: SessionListItem,
  levelBand: LearningLevelBand | null,
): number {
  const preferredDifficulty = mapLevelToDifficulty(levelBand);
  if (!preferredDifficulty || !session.difficulty) return 0;
  if (preferredDifficulty === session.difficulty) return 3;

  const order = ["beginner", "intermediate", "advanced"];
  const preferredIndex = order.indexOf(preferredDifficulty);
  const sessionIndex = order.indexOf(session.difficulty);
  return Math.abs(preferredIndex - sessionIndex) === 1 ? 1 : 0;
}

function scorePronunciationSession(
  session: SessionListItem,
  profile: LearningProfile,
): {
  total: number;
  exactSpeakerMatch: boolean;
} {
  let score = 0;
  const searchText = getSessionSearchText(session);
  const preferredTags =
    profile.preferred_speakers.length > 0
      ? profile.preferred_speakers
      : profile.focus_tags;
  const normalizedPrimarySpeaker = normalizeText(session.primary_speaker_name);
  const normalizedSpeakerNames = normalizeTextArray(session.speaker_names);
  let exactSpeakerMatch = false;

  for (const tag of preferredTags) {
    const hint = PRONUNCIATION_HINTS[tag];
    const normalizedTag = normalizeText(tag);

    if (normalizedTag && normalizedPrimarySpeaker === normalizedTag) {
      exactSpeakerMatch = true;
      score += 18;
    } else if (
      normalizedTag &&
      normalizedSpeakerNames.includes(normalizedTag)
    ) {
      exactSpeakerMatch = true;
      score += 12;
    }

    if (hint?.sourceTypes?.includes(session.source_type)) score += 3;
    for (const keyword of hint?.titleKeywords ?? []) {
      if (searchText.includes(keyword)) score += 1;
    }
    if (searchText.includes(tag.toLowerCase())) score += 2;
  }

  if (session.source_type === "demo" || session.source_type === "keynote") {
    score += 1;
  }

  return {
    total: score,
    exactSpeakerMatch,
  };
}

function scoreExpressionSession(
  session: SessionListItem,
  profile: LearningProfile,
): {
  total: number;
  exactCategoryMatch: boolean;
  exactSituationMatch: boolean;
} {
  let score = 0;
  const searchText = getSessionSearchText(session);
  const preferredSituations = getPreferredExpressionSituations(profile);
  const preferredSourceTypes = getPreferredSourceTypes(profile);
  const preferredGenres = getPreferredGenres(profile);
  const sessionSituations = normalizeTextArray(session.speaking_situations);
  let exactCategoryMatch = false;
  let exactSituationMatch = false;
  const preferredTags = [
    ...new Set([...preferredSituations, ...profile.focus_tags].filter(Boolean)),
  ];

  if (
    session.source_type &&
    preferredSourceTypes.includes(session.source_type)
  ) {
    exactCategoryMatch = true;
    score += 8;
  }

  if (session.genre && preferredGenres.includes(session.genre)) {
    exactCategoryMatch = true;
    score += 6;
  }

  for (const situation of preferredSituations) {
    if (sessionSituations.includes(normalizeText(situation))) {
      exactSituationMatch = true;
      score += 12;
    }
  }

  for (const tag of preferredTags) {
    const hint = EXPRESSION_HINTS[tag];
    if (hint?.sourceTypes?.includes(session.source_type)) score += 3;
    if (hint?.genres?.includes(session.genre)) score += 2;
    for (const keyword of hint?.titleKeywords ?? []) {
      if (searchText.includes(keyword)) score += 1;
    }
    if (searchText.includes(tag.toLowerCase())) score += 2;
  }

  if (session.genre === "business" || session.genre === "tech") {
    score += 1;
  }

  return {
    total: score,
    exactCategoryMatch,
    exactSituationMatch,
  };
}

function scoreSessionForProfile(
  session: SessionListItem,
  profile: LearningProfile,
): {
  total: number;
  exactSpeakerMatch: boolean;
  exactCategoryMatch: boolean;
  exactSituationMatch: boolean;
} {
  const baseScore = scoreLevelFit(session, profile.level_band);

  if (profile.goal_mode === "pronunciation") {
    const pronunciationScore = scorePronunciationSession(session, profile);
    return {
      total: baseScore + pronunciationScore.total,
      exactSpeakerMatch: pronunciationScore.exactSpeakerMatch,
      exactCategoryMatch: false,
      exactSituationMatch: false,
    };
  }

  if (profile.goal_mode === "expression") {
    const expressionScore = scoreExpressionSession(session, profile);
    return {
      total: baseScore + expressionScore.total,
      exactSpeakerMatch: false,
      exactCategoryMatch: expressionScore.exactCategoryMatch,
      exactSituationMatch: expressionScore.exactSituationMatch,
    };
  }

  return {
    total: baseScore,
    exactSpeakerMatch: false,
    exactCategoryMatch: false,
    exactSituationMatch: false,
  };
}

function pickSentence(
  session: SessionListItem,
  video: CuratedVideo,
  allowedSentenceIds?: string[],
): Sentence | null {
  const transcript = video.transcript ?? [];
  if (transcript.length === 0) return null;

  if (allowedSentenceIds !== undefined) {
    if (allowedSentenceIds.length === 0) {
      return null;
    }

    for (const sentenceId of allowedSentenceIds) {
      const matched = transcript.find((sentence) => sentence.id === sentenceId);
      if (matched) return matched;
    }
    return null;
  }

  const sentenceIds = session.sentence_ids ?? [];
  if (sentenceIds.length === 0) {
    return transcript[0] ?? null;
  }

  for (const sentenceId of sentenceIds) {
    const matched = transcript.find((sentence) => sentence.id === sentenceId);
    if (matched) return matched;
  }

  return transcript[0] ?? null;
}

function buildReason(
  mode: LearningGoalMode,
  isReview: boolean,
  session: SessionListItem,
): string {
  if (isReview) return "최근 학습한 흐름을 다시 꺼내보는 복습 카드";
  if (mode === "pronunciation") {
    return `${session.channel_name ?? "이 영상"}의 말투를 따라 말해보기 좋은 카드`;
  }
  return `${session.title}에서 바로 써먹을 표현을 뽑아 연습하기 좋은 카드`;
}

function parseCachedQueue(
  rawValue: string | undefined,
): CachedDailyInputQueue | null {
  if (!rawValue) return null;
  try {
    return JSON.parse(rawValue) as CachedDailyInputQueue;
  } catch {
    return null;
  }
}

async function materializeQueueItem(
  session: SessionListItem,
  mode: LearningGoalMode,
  isReview: boolean,
): Promise<DailyInputQueueItem | null> {
  const video = await fetchCuratedVideo(session.source_video_id);
  const transformationSet =
    mode === "expression" ? await fetchTransformationSet(session.id) : null;
  const sentenceAnchorIds =
    mode === "expression"
      ? (transformationSet?.source_sentence_ids ?? [])
      : mode === "pronunciation"
        ? (session.sentence_ids ?? [])
        : undefined;
  const sentence = pickSentence(session, video, sentenceAnchorIds);

  if (mode === "expression" && (!transformationSet || !sentence)) {
    return null;
  }

  if (!sentence) return null;

  return {
    sessionId: session.id,
    videoId: session.source_video_id,
    title: session.title,
    thumbnailUrl: session.thumbnail_url,
    channelName: session.channel_name,
    sentenceId: sentence.id,
    sentenceText: sentence.text,
    translation: sentence.translation,
    startTime: sentence.startTime,
    endTime: sentence.endTime,
    mode,
    isReview,
    cardOrder: 0,
    reason: buildReason(mode, isReview, session),
    transformationSet,
  };
}

async function generateDailyInputQueue(
  profile: LearningProfile,
): Promise<DailyInputQueueItem[]> {
  const mode = profile.goal_mode;
  if (!mode) return [];

  const items: DailyInputQueueItem[] = [];
  const seenSentenceTexts = new Set<string>();
  const recentSessionIds = getRecentSessionIds();
  const recentSessions = await fetchSessionsByIds(recentSessionIds.slice(0, 6));

  for (const session of recentSessions) {
    if (items.length >= 1) break;
    const nextItem = await materializeQueueItem(session, mode, true);
    if (!nextItem) continue;
    const dedupeKey = nextItem.sentenceText.trim().toLowerCase();
    if (seenSentenceTexts.has(dedupeKey)) continue;
    seenSentenceTexts.add(dedupeKey);
    items.push(nextItem);
  }

  const sessions = await fetchLearningSessions();
  const reviewSessionIds = new Set(items.map((item) => item.sessionId));
  const rankedCandidates = [...sessions]
    .filter((session) => !reviewSessionIds.has(session.id))
    .sort((left, right) => {
      const leftScore = scoreSessionForProfile(left, profile);
      const rightScore = scoreSessionForProfile(right, profile);

      if (leftScore.exactSpeakerMatch !== rightScore.exactSpeakerMatch) {
        return (
          Number(rightScore.exactSpeakerMatch) -
          Number(leftScore.exactSpeakerMatch)
        );
      }

      if (leftScore.exactCategoryMatch !== rightScore.exactCategoryMatch) {
        return (
          Number(rightScore.exactCategoryMatch) -
          Number(leftScore.exactCategoryMatch)
        );
      }

      if (leftScore.exactSituationMatch !== rightScore.exactSituationMatch) {
        return (
          Number(rightScore.exactSituationMatch) -
          Number(leftScore.exactSituationMatch)
        );
      }

      const scoreDiff = rightScore.total - leftScore.total;
      if (scoreDiff !== 0) return scoreDiff;
      return left.order_index - right.order_index;
    });

  for (const session of rankedCandidates) {
    if (items.length >= MAX_DAILY_INPUT_ITEMS) break;

    const nextItem = await materializeQueueItem(session, mode, false);
    if (!nextItem) continue;

    const dedupeKey = nextItem.sentenceText.trim().toLowerCase();
    if (seenSentenceTexts.has(dedupeKey)) continue;

    seenSentenceTexts.add(dedupeKey);
    items.push(nextItem);
  }

  return items
    .slice(0, MAX_DAILY_INPUT_ITEMS)
    .map((item, index) => ({ ...item, cardOrder: index }));
}

export async function getDailyInputQueue(
  profile: LearningProfile | null,
): Promise<DailyInputQueueItem[]> {
  if (!profile?.user_id || !profile.goal_mode) return [];

  const queueDate = getLocalDateKey();
  const profileHash = getProfileHash(profile);
  const cacheKey = getCacheKey(profile.user_id);
  const cachedQueue = parseCachedQueue(storage.getString(cacheKey));

  if (
    cachedQueue?.version === DAILY_INPUT_CACHE_VERSION &&
    cachedQueue?.queueDate === queueDate &&
    cachedQueue.profileHash === profileHash
  ) {
    return cachedQueue.items;
  }

  const items = await generateDailyInputQueue(profile);
  const payload: CachedDailyInputQueue = {
    version: DAILY_INPUT_CACHE_VERSION,
    queueDate,
    profileHash,
    items,
  };
  storage.set(cacheKey, JSON.stringify(payload));
  return items;
}

export function clearDailyInputQueueCache(userId: string): void {
  storage.delete(getCacheKey(userId));
}
