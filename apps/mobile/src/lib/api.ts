// @MX:ANCHOR: api - Mobile Supabase direct query client for curated videos
// @MX:REASON: [AUTO] fan_in >= 3: used by HomeScreen, ListeningScreen, and future screens
// @MX:SPEC: SPEC-MOBILE-003 - direct Supabase queries bypassing web API server
import { supabase } from "./supabase";
import type {
  CardComment,
  CardCommentTargetType,
  CuratedVideo,
  FeaturedSpeaker,
  Genre,
  PlaybookEntry,
  PlaybookMasteryStatus,
  PracticeAttempt,
  PracticeCoachingSummary,
  PracticeMode,
  PracticePrompt,
  SessionContext,
  SessionRoleRelevance,
  SessionSourceType,
  Speaker,
} from "@inputenglish/shared";
import { buildDefaultPracticePrompts } from "./professional-practice";

export interface VideoListItem {
  video_id: string;
  title: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  thumbnail_url?: string;
  snippet_duration?: number;
  channel_name?: string;
}

export async function fetchCuratedVideos(): Promise<VideoListItem[]> {
  const { data, error } = await supabase
    .from("curated_videos")
    .select(
      "video_id, title, difficulty, thumbnail_url, snippet_duration, channel_name",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as VideoListItem[];
}

export interface SessionListItem {
  id: string;
  source_video_id: string;
  title: string;
  subtitle?: string;
  description?: string;
  duration: number;
  start_time?: number;
  end_time?: number;
  sentence_ids?: string[];
  difficulty?: "beginner" | "intermediate" | "advanced";
  thumbnail_url?: string;
  order_index: number;
  channel_name?: string;
  source_type?: SessionSourceType;
  genre?: Genre;
  role_relevance?: SessionRoleRelevance[];
  premium_required?: boolean;
  expected_takeaway?: string;
  context?: SessionContext | null;
}

const SESSION_SELECT =
  "id, source_video_id, title, subtitle, description, duration, difficulty, thumbnail_url, order_index, source_type, genre, role_relevance, premium_required, session_contexts(expected_takeaway)" as const;

const FEED_PAGE_SIZE = 20;

function mapSessionRow(
  s: any,
  video?: { thumbnail_url?: string; channel_name?: string } | null,
): SessionListItem {
  return {
    id: s.id,
    source_video_id: s.source_video_id,
    title: s.title,
    subtitle: s.subtitle || undefined,
    description: s.description || undefined,
    duration: Number(s.duration),
    difficulty: s.difficulty as SessionListItem["difficulty"],
    source_type: s.source_type as SessionListItem["source_type"],
    genre: s.genre as SessionListItem["genre"],
    role_relevance:
      (s.role_relevance as SessionListItem["role_relevance"]) || [],
    premium_required: Boolean(s.premium_required),
    thumbnail_url:
      s.thumbnail_url ||
      video?.thumbnail_url ||
      `https://img.youtube.com/vi/${s.source_video_id}/hqdefault.jpg`,
    order_index: s.order_index,
    channel_name: video?.channel_name || undefined,
    expected_takeaway:
      (Array.isArray(s.session_contexts)
        ? s.session_contexts[0]?.expected_takeaway
        : (s.session_contexts as { expected_takeaway?: string } | null)
            ?.expected_takeaway) || undefined,
  };
}

async function enrichWithVideos(
  sessions: { source_video_id: string }[],
): Promise<Map<string, { thumbnail_url?: string; channel_name?: string }>> {
  const videoIds = [...new Set(sessions.map((s) => s.source_video_id))];
  if (videoIds.length === 0) return new Map();
  const { data: videos } = await supabase
    .from("curated_videos")
    .select("video_id, thumbnail_url, channel_name")
    .in("video_id", videoIds);
  return new Map((videos ?? []).map((v) => [v.video_id, v]));
}

export async function fetchLearningSessions(): Promise<SessionListItem[]> {
  const { data: sessions, error: sessionsError } = await supabase
    .from("learning_sessions")
    .select(SESSION_SELECT)
    .order("created_at", { ascending: false });

  if (sessionsError) throw sessionsError;
  if (!sessions || sessions.length === 0) return [];

  const videoMap = await enrichWithVideos(sessions);
  return sessions.map((s) => mapSessionRow(s, videoMap.get(s.source_video_id)));
}

export interface FeedFilters {
  sourceType?: string;
  genre?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
}

export interface FeaturedSpeakerItem extends FeaturedSpeaker {
  image_url?: string | null;
}

export interface SpeakerDetail extends Speaker {
  image_url?: string | null;
  video_count: number;
  session_count: number;
}

export async function fetchLearningSessionsPaginated(
  offset: number = 0,
  filters?: FeedFilters,
): Promise<{ sessions: SessionListItem[]; hasMore: boolean }> {
  let query = supabase
    .from("learning_sessions")
    .select(SESSION_SELECT)
    .order("created_at", { ascending: false });

  if (filters?.sourceType) query = query.eq("source_type", filters.sourceType);
  if (filters?.genre) query = query.eq("genre", filters.genre);
  if (filters?.difficulty) query = query.eq("difficulty", filters.difficulty);

  const { data: sessions, error: sessionsError } = await query.range(
    offset,
    offset + FEED_PAGE_SIZE - 1,
  );

  if (sessionsError) throw sessionsError;
  if (!sessions || sessions.length === 0)
    return { sessions: [], hasMore: false };

  const videoMap = await enrichWithVideos(sessions);
  const mapped = sessions.map((s) =>
    mapSessionRow(s, videoMap.get(s.source_video_id)),
  );

  return { sessions: mapped, hasMore: sessions.length === FEED_PAGE_SIZE };
}

export async function fetchContinueLearning(
  userId: string,
): Promise<SessionListItem[]> {
  const { data: attempts, error: attemptsError } = await supabase
    .from("practice_attempts")
    .select("session_id")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (attemptsError) throw attemptsError;
  if (!attempts || attempts.length === 0) return [];

  const seen = new Set<string>();
  const sessionIds: string[] = [];
  for (const a of attempts) {
    if (!seen.has(a.session_id)) {
      seen.add(a.session_id);
      sessionIds.push(a.session_id);
    }
    if (sessionIds.length >= 10) break;
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from("learning_sessions")
    .select(SESSION_SELECT)
    .in("id", sessionIds);

  if (sessionsError) throw sessionsError;
  if (!sessions || sessions.length === 0) return [];

  const videoMap = await enrichWithVideos(sessions);
  const sessionMap = new Map(
    sessions.map((s) => [
      s.id,
      mapSessionRow(s, videoMap.get(s.source_video_id)),
    ]),
  );

  return sessionIds
    .map((id) => sessionMap.get(id))
    .filter((s): s is SessionListItem => s !== undefined);
}

export async function fetchSessionsByIds(
  ids: string[],
): Promise<SessionListItem[]> {
  if (ids.length === 0) return [];

  const { data: sessions, error } = await supabase
    .from("learning_sessions")
    .select(SESSION_SELECT)
    .in("id", ids);

  if (error) throw error;
  if (!sessions || sessions.length === 0) return [];

  const videoMap = await enrichWithVideos(sessions);
  const sessionMap = new Map(
    sessions.map((s) => [
      s.id,
      mapSessionRow(s, videoMap.get(s.source_video_id)),
    ]),
  );

  // Preserve caller's ordering
  return ids
    .map((id) => sessionMap.get(id))
    .filter((s): s is SessionListItem => s !== undefined);
}

export async function fetchLearningSessionDetail(
  sessionId: string,
): Promise<SessionListItem | null> {
  const { data, error } = await supabase
    .from("learning_sessions")
    .select(
      `
        id,
        source_video_id,
        title,
        subtitle,
        description,
        duration,
        start_time,
        end_time,
        sentence_ids,
        difficulty,
        thumbnail_url,
        order_index,
        source_type,
        genre,
        role_relevance,
        premium_required,
        context:session_contexts (
          session_id,
          strategic_intent,
          reusable_scenarios,
          key_vocabulary,
          grammar_rhetoric_note,
          expected_takeaway,
          generated_by,
          updated_by,
          created_at,
          updated_at
        )
      `,
    )
    .eq("id", sessionId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const context = Array.isArray(data.context)
    ? (data.context[0] as SessionContext | undefined)
    : (data.context as SessionContext | null);

  return {
    id: data.id,
    source_video_id: data.source_video_id,
    title: data.title,
    subtitle: data.subtitle || undefined,
    description: data.description || undefined,
    duration: Number(data.duration),
    start_time:
      typeof data.start_time === "number" ? Number(data.start_time) : undefined,
    end_time:
      typeof data.end_time === "number" ? Number(data.end_time) : undefined,
    sentence_ids: Array.isArray(data.sentence_ids)
      ? (data.sentence_ids as string[])
      : [],
    difficulty: data.difficulty as SessionListItem["difficulty"],
    thumbnail_url:
      data.thumbnail_url ||
      `https://img.youtube.com/vi/${data.source_video_id}/hqdefault.jpg`,
    order_index: data.order_index,
    source_type: data.source_type as SessionListItem["source_type"],
    genre: data.genre as SessionListItem["genre"],
    role_relevance:
      (data.role_relevance as SessionListItem["role_relevance"]) || [],
    premium_required: Boolean(data.premium_required),
    context: context
      ? {
          ...context,
          reusable_scenarios: context.reusable_scenarios || [],
          key_vocabulary: context.key_vocabulary || [],
        }
      : null,
  };
}

export async function fetchCuratedVideo(
  videoId: string,
): Promise<CuratedVideo> {
  const { data, error } = await supabase
    .from("curated_videos")
    .select("*")
    .eq("video_id", videoId)
    .single();

  if (error) throw error;
  return data as CuratedVideo;
}

export async function fetchFeaturedSpeakers(): Promise<FeaturedSpeakerItem[]> {
  const { data, error } = await supabase
    .from("speaker_library_items")
    .select(
      "speaker_id, speaker_slug, speaker_name, speaker_headline, speaker_avatar_url, speaker_sort_order, video_id, video_thumbnail_url, session_id",
    )
    .eq("speaker_is_featured", true)
    .order("speaker_sort_order", { ascending: true });

  if (error) throw error;

  const speakerMap = new Map<
    string,
    FeaturedSpeakerItem & {
      sort_order: number;
      _videoIds: Set<string>;
      _sessionIds: Set<string>;
    }
  >();

  for (const row of data ?? []) {
    if (!row.speaker_id || !row.speaker_slug || !row.speaker_name) continue;

    const existing = speakerMap.get(row.speaker_id);
    if (existing) {
      if (row.video_id) existing._videoIds.add(row.video_id);
      if (row.session_id) existing._sessionIds.add(row.session_id);
      if (!existing.image_url && row.video_thumbnail_url) {
        existing.image_url = row.video_thumbnail_url;
      }
      continue;
    }

    const nextSpeaker = {
      id: row.speaker_id,
      slug: row.speaker_slug,
      name: row.speaker_name,
      headline: row.speaker_headline || null,
      image_url: row.speaker_avatar_url || row.video_thumbnail_url || null,
      video_count: row.video_id ? 1 : 0,
      session_count: row.session_id ? 1 : 0,
      sort_order: Number(row.speaker_sort_order ?? 0),
      _videoIds: new Set(row.video_id ? [row.video_id] : []),
      _sessionIds: new Set(row.session_id ? [row.session_id] : []),
    };
    speakerMap.set(row.speaker_id, nextSpeaker);
  }

  return Array.from(speakerMap.values())
    .map((speaker) => ({
      id: speaker.id,
      slug: speaker.slug,
      name: speaker.name,
      headline: speaker.headline,
      image_url: speaker.image_url,
      video_count: speaker._videoIds.size,
      session_count: speaker._sessionIds.size,
      sort_order: speaker.sort_order,
    }))
    .sort((a, b) => a.sort_order - b.sort_order)
    .map(({ sort_order: _sortOrder, ...speaker }) => speaker);
}

export async function fetchSpeakerDetail(slug: string): Promise<SpeakerDetail> {
  const [
    { data: speaker, error: speakerError },
    { data: items, error: itemsError },
  ] = await Promise.all([
    supabase
      .from("speakers")
      .select("*")
      .eq("slug", slug)
      .eq("status", "active")
      .maybeSingle(),
    supabase
      .from("speaker_library_items")
      .select("video_id, video_thumbnail_url, session_id")
      .eq("speaker_slug", slug),
  ]);

  if (speakerError) throw speakerError;
  if (itemsError) throw itemsError;
  if (!speaker) {
    throw new Error("Speaker not found");
  }

  const videoIds = new Set<string>();
  const sessionIds = new Set<string>();
  let fallbackImage: string | null = null;

  for (const item of items ?? []) {
    if (item.video_id) videoIds.add(item.video_id);
    if (item.session_id) sessionIds.add(item.session_id);
    if (!fallbackImage && item.video_thumbnail_url) {
      fallbackImage = item.video_thumbnail_url;
    }
  }

  return {
    ...(speaker as Speaker),
    image_url: speaker.avatar_url || fallbackImage,
    video_count: videoIds.size,
    session_count: sessionIds.size,
  };
}

export async function fetchSpeakerSessions(
  slug: string,
): Promise<SessionListItem[]> {
  const { data, error } = await supabase
    .from("speaker_library_items")
    .select(
      `
        session_id,
        session_title,
        session_subtitle,
        session_description,
        session_duration,
        session_order_index,
        session_difficulty,
        session_source_type,
        session_genre,
        session_premium_required,
        video_id,
        video_thumbnail_url,
        channel_name
      `,
    )
    .eq("speaker_slug", slug)
    .not("session_id", "is", null)
    .order("session_order_index", { ascending: true });

  if (error) throw error;

  const sessionMap = new Map<string, SessionListItem>();

  for (const row of data ?? []) {
    if (!row.session_id || sessionMap.has(row.session_id)) continue;

    sessionMap.set(row.session_id, {
      id: row.session_id,
      source_video_id: row.video_id,
      title: row.session_title,
      subtitle: row.session_subtitle || undefined,
      description: row.session_description || undefined,
      duration: Number(row.session_duration),
      difficulty: row.session_difficulty as SessionListItem["difficulty"],
      thumbnail_url:
        row.video_thumbnail_url ||
        `https://img.youtube.com/vi/${row.video_id}/hqdefault.jpg`,
      order_index: Number(row.session_order_index ?? 0),
      channel_name: row.channel_name || undefined,
      source_type: row.session_source_type as SessionListItem["source_type"],
      genre: row.session_genre as SessionListItem["genre"],
      premium_required: Boolean(row.session_premium_required),
      role_relevance: [],
    });
  }

  return Array.from(sessionMap.values());
}

export async function ensurePracticePrompts(
  session: SessionListItem,
  userDisplayName?: string | null,
): Promise<PracticePrompt[]> {
  const { data, error } = await supabase
    .from("practice_prompts")
    .select(
      "id, session_id, mode, title, prompt_text, guidance, created_at, updated_at",
    )
    .eq("session_id", session.id)
    .order("created_at", { ascending: true });

  if (error) throw error;

  if (data && data.length > 0) {
    return data.map((item) => ({
      id: item.id,
      session_id: item.session_id,
      mode: item.mode as PracticeMode,
      title: item.title,
      prompt_text: item.prompt_text,
      guidance: Array.isArray(item.guidance) ? (item.guidance as string[]) : [],
      created_at: item.created_at,
      updated_at: item.updated_at,
    }));
  }

  const defaults = buildDefaultPracticePrompts({
    sessionId: session.id,
    title: session.title,
    description: session.description,
    roleRelevance: session.role_relevance,
    context: session.context,
    userDisplayName,
  });

  const { data: inserted, error: insertError } = await supabase
    .from("practice_prompts")
    .upsert(defaults, { onConflict: "session_id,mode" })
    .select(
      "id, session_id, mode, title, prompt_text, guidance, created_at, updated_at",
    );

  if (insertError) throw insertError;

  return (inserted ?? []).map((item) => ({
    id: item.id,
    session_id: item.session_id,
    mode: item.mode as PracticeMode,
    title: item.title,
    prompt_text: item.prompt_text,
    guidance: Array.isArray(item.guidance) ? (item.guidance as string[]) : [],
    created_at: item.created_at,
    updated_at: item.updated_at,
  }));
}

export async function savePracticeAttempt(
  userId: string,
  payload: {
    sessionId: string;
    sourceVideoId: string;
    sourceSentence: string;
    mode: PracticeMode;
    responseText?: string;
    recordingUrl?: string;
    coachingSummary?: PracticeCoachingSummary | null;
    attemptMetadata?: Record<string, unknown>;
  },
): Promise<PracticeAttempt> {
  const { data, error } = await supabase
    .from("practice_attempts")
    .insert({
      user_id: userId,
      session_id: payload.sessionId,
      source_video_id: payload.sourceVideoId,
      source_sentence: payload.sourceSentence,
      mode: payload.mode,
      response_text: payload.responseText,
      recording_url: payload.recordingUrl,
      coaching_summary: payload.coachingSummary ?? null,
      attempt_metadata: payload.attemptMetadata ?? {},
    })
    .select(
      "id, session_id, source_video_id, source_sentence, mode, response_text, recording_url, coaching_summary, attempt_metadata, created_at",
    )
    .single();

  if (error) throw error;

  return {
    id: data.id,
    session_id: data.session_id,
    source_video_id: data.source_video_id,
    source_sentence: data.source_sentence,
    mode: data.mode as PracticeMode,
    response_text: data.response_text || undefined,
    recording_url: data.recording_url || undefined,
    coaching_summary:
      (data.coaching_summary as PracticeCoachingSummary | null) ?? null,
    attempt_metadata:
      (data.attempt_metadata as Record<string, unknown> | undefined) ?? {},
    created_at: data.created_at,
  };
}

export async function savePlaybookEntry(
  userId: string,
  payload: {
    sessionId: string;
    sourceVideoId: string;
    sourceSentence: string;
    practiceMode: PracticeMode;
    userRewrite: string;
    attemptMetadata?: Record<string, unknown>;
  },
): Promise<PlaybookEntry> {
  const { data, error } = await supabase
    .from("playbook_entries")
    .insert({
      user_id: userId,
      session_id: payload.sessionId,
      source_video_id: payload.sourceVideoId,
      source_sentence: payload.sourceSentence,
      practice_mode: payload.practiceMode,
      user_rewrite: payload.userRewrite,
      attempt_metadata: payload.attemptMetadata ?? {},
    })
    .select(
      "id, session_id, source_video_id, source_sentence, practice_mode, user_rewrite, attempt_metadata, mastery_status, created_at, updated_at",
    )
    .single();

  if (error) throw error;

  return mapPlaybookEntry(data);
}

export async function fetchPlaybookEntries(
  userId: string,
): Promise<PlaybookEntry[]> {
  const { data, error } = await supabase
    .from("playbook_entries")
    .select(
      "id, user_id, session_id, source_video_id, source_sentence, practice_mode, user_rewrite, attempt_metadata, mastery_status, created_at, updated_at",
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) throw error;

  return (data ?? []).map(mapPlaybookEntry);
}

export async function updatePlaybookEntryMastery(
  userId: string,
  entryId: string,
  masteryStatus: PlaybookMasteryStatus,
): Promise<void> {
  const { error } = await supabase
    .from("playbook_entries")
    .update({
      mastery_status: masteryStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", entryId);

  if (error) throw error;
}

export async function deletePlaybookEntry(
  userId: string,
  entryId: string,
): Promise<void> {
  const { error } = await supabase
    .from("playbook_entries")
    .delete()
    .eq("user_id", userId)
    .eq("id", entryId);

  if (error) throw error;
}

// --- Card Comments ---

export async function fetchCardComments(
  userId: string,
): Promise<CardComment[]> {
  const { data, error } = await supabase
    .from("card_comments")
    .select("id, target_type, target_id, body, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []).map(mapCardCommentRow);
}

export async function createCardComment(
  userId: string,
  payload: {
    targetType: CardCommentTargetType;
    targetId: string;
    body: string;
  },
): Promise<CardComment> {
  const { data, error } = await supabase
    .from("card_comments")
    .insert({
      user_id: userId,
      target_type: payload.targetType,
      target_id: payload.targetId,
      body: payload.body,
    })
    .select("id, target_type, target_id, body, created_at, updated_at")
    .single();

  if (error) throw error;
  return mapCardCommentRow(data);
}

export async function updateCardComment(
  userId: string,
  commentId: string,
  body: string,
): Promise<CardComment> {
  const { data, error } = await supabase
    .from("card_comments")
    .update({
      body,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId)
    .eq("id", commentId)
    .select("id, target_type, target_id, body, created_at, updated_at")
    .single();

  if (error) throw error;
  return mapCardCommentRow(data);
}

export async function deleteCardComment(
  userId: string,
  commentId: string,
): Promise<void> {
  const { error } = await supabase
    .from("card_comments")
    .delete()
    .eq("user_id", userId)
    .eq("id", commentId);

  if (error) throw error;
}

export async function deleteCardCommentsByTarget(
  userId: string,
  targetId: string,
): Promise<void> {
  const { error } = await supabase
    .from("card_comments")
    .delete()
    .eq("user_id", userId)
    .eq("target_id", targetId);

  if (error) throw error;
}

function mapCardCommentRow(row: {
  id: string;
  target_type: string;
  target_id: string;
  body: string;
  created_at: string;
  updated_at: string;
}): CardComment {
  return {
    id: row.id,
    targetType: row.target_type as CardCommentTargetType,
    targetId: row.target_id,
    body: row.body,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapPlaybookEntry(item: {
  id: string;
  session_id: string;
  source_video_id: string;
  source_sentence: string;
  practice_mode: string;
  user_rewrite: string;
  attempt_metadata?: Record<string, unknown> | null;
  mastery_status: string;
  created_at: string;
  updated_at: string;
}): PlaybookEntry {
  return {
    id: item.id,
    session_id: item.session_id,
    source_video_id: item.source_video_id,
    source_sentence: item.source_sentence,
    practice_mode: item.practice_mode as PracticeMode,
    user_rewrite: item.user_rewrite,
    attempt_metadata:
      (item.attempt_metadata as Record<string, unknown> | undefined) ?? {},
    mastery_status: item.mastery_status as PlaybookMasteryStatus,
    created_at: item.created_at,
    updated_at: item.updated_at,
  };
}
