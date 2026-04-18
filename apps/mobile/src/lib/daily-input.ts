import type {
  CuratedVideo,
  LearningGoalMode,
  LearningLevelBand,
  LearningProfile,
  Sentence,
} from "@inputenglish/shared";
import type { SessionListItem } from "@/lib/api";
import {
  fetchCuratedVideo,
  fetchLearningSessions,
  fetchSessionsByIds,
} from "@/lib/api";
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
}

interface CachedDailyInputQueue {
  queueDate: string;
  profileHash: string;
  items: DailyInputQueueItem[];
}

const DAILY_INPUT_CACHE_PREFIX = "daily_input_queue";
const MAX_DAILY_INPUT_ITEMS = 3;

const EXPRESSION_HINTS: Record<
  string,
  {
    sourceTypes?: Array<SessionListItem["source_type"]>;
    genres?: Array<SessionListItem["genre"]>;
    titleKeywords?: string[];
  }
> = {
  "회의/업데이트": {
    sourceTypes: ["podcast", "earnings-call", "demo"],
    genres: ["business", "economy"],
    titleKeywords: ["update", "review", "wrap", "sync", "meeting"],
  },
  "발표/데모": {
    sourceTypes: ["demo", "keynote", "public-speech"],
    genres: ["tech", "business"],
    titleKeywords: ["demo", "launch", "presentation", "pitch"],
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
};

const PRONUNCIATION_HINTS: Record<
  string,
  {
    sourceTypes?: Array<SessionListItem["source_type"]>;
    titleKeywords?: string[];
  }
> = {
  "차분한 리더 톤": {
    sourceTypes: ["keynote", "earnings-call", "public-speech"],
    titleKeywords: ["leader", "ceo", "founder", "briefing"],
  },
  "또렷한 발표 스타일": {
    sourceTypes: ["demo", "keynote", "public-speech"],
    titleKeywords: ["presentation", "talk", "demo", "launch"],
  },
  "설득력 있는 데모 말투": {
    sourceTypes: ["demo", "podcast"],
    titleKeywords: ["demo", "product", "pitch"],
  },
  "좋아하는 인물 따라하기": {
    sourceTypes: ["interview", "podcast", "panel"],
    titleKeywords: ["conversation", "interview", "fireside"],
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
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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
): number {
  let score = 0;
  const searchText = getSessionSearchText(session);
  const preferredTags =
    profile.preferred_speakers.length > 0
      ? profile.preferred_speakers
      : profile.focus_tags;

  for (const tag of preferredTags) {
    const hint = PRONUNCIATION_HINTS[tag];
    if (hint?.sourceTypes?.includes(session.source_type)) score += 3;
    for (const keyword of hint?.titleKeywords ?? []) {
      if (searchText.includes(keyword)) score += 1;
    }
    if (searchText.includes(tag.toLowerCase())) score += 2;
  }

  if (session.source_type === "demo" || session.source_type === "keynote") {
    score += 1;
  }

  return score;
}

function scoreExpressionSession(
  session: SessionListItem,
  profile: LearningProfile,
): number {
  let score = 0;
  const searchText = getSessionSearchText(session);
  const preferredTags =
    profile.preferred_situations.length > 0
      ? profile.preferred_situations
      : profile.focus_tags;

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

  return score;
}

function scoreSessionForProfile(
  session: SessionListItem,
  profile: LearningProfile,
): number {
  const baseScore = scoreLevelFit(session, profile.level_band);

  if (profile.goal_mode === "pronunciation") {
    return baseScore + scorePronunciationSession(session, profile);
  }

  if (profile.goal_mode === "expression") {
    return baseScore + scoreExpressionSession(session, profile);
  }

  return baseScore;
}

function pickSentence(
  session: SessionListItem,
  video: CuratedVideo,
): Sentence | null {
  const transcript = video.transcript ?? [];
  if (transcript.length === 0) return null;

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
  const sentence = pickSentence(session, video);
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
      const scoreDiff =
        scoreSessionForProfile(right, profile) -
        scoreSessionForProfile(left, profile);
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
    cachedQueue?.queueDate === queueDate &&
    cachedQueue.profileHash === profileHash
  ) {
    return cachedQueue.items;
  }

  const items = await generateDailyInputQueue(profile);
  const payload: CachedDailyInputQueue = {
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
