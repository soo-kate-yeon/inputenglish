import type {
  Genre,
  LearningGoalMode,
  LearningLevelBand,
  LearningProfile,
  PremiumExpressionCard,
  PremiumSession,
  SessionSourceType,
  SpeakingSituation,
} from "@inputenglish/shared";
import { selectDailyPremiumSession } from "@inputenglish/shared";
import { createAdminClient } from "@/utils/supabase/server";
import {
  hydratePremiumSession,
  mapPremiumArticleRow,
  premiumExpressionCardBaseSchema,
} from "./session-schema";

const PREMIUM_SESSION_SELECT =
  "id, slug, source_video_id, source_url, title, subtitle, description, thumbnail_url, channel_name, speaker_name, source_type, genre, speaking_situations, interest_tags, difficulty_level, duration_seconds, segment_start_time, segment_end_time, transcript, article, delivery_analysis, roleplay, status, reviewed, published_on, published_at, created_at, updated_at";
const USER_PROFILE_SELECT =
  "id, level_band, goal_mode, focus_tags, preferred_speakers, preferred_situations, preferred_source_types, preferred_genres, onboarding_completed_at, updated_at";

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapUserProfile(row: Record<string, unknown>): LearningProfile {
  return {
    user_id: String(row.id),
    level_band: (row.level_band as LearningLevelBand | null) ?? null,
    goal_mode: (row.goal_mode as LearningGoalMode | null) ?? null,
    focus_tags: normalizeStringArray(row.focus_tags),
    preferred_speakers: normalizeStringArray(row.preferred_speakers),
    preferred_situations: normalizeStringArray(
      row.preferred_situations,
    ) as SpeakingSituation[],
    preferred_source_types: normalizeStringArray(
      row.preferred_source_types,
    ) as SessionSourceType[],
    preferred_genres: normalizeStringArray(row.preferred_genres) as Genre[],
    onboarding_completed_at:
      (row.onboarding_completed_at as string | null) ?? null,
    updated_at: (row.updated_at as string | null) ?? null,
  };
}

function hasCurationPreferences(profile: LearningProfile): boolean {
  return Boolean(
    profile.level_band ||
    profile.goal_mode ||
    profile.focus_tags.length > 0 ||
    profile.preferred_speakers.length > 0 ||
    profile.preferred_situations.length > 0 ||
    profile.preferred_source_types.length > 0 ||
    profile.preferred_genres.length > 0,
  );
}

function mapExpressionRow(row: Record<string, unknown>): PremiumExpressionCard {
  const parsed = premiumExpressionCardBaseSchema.parse({
    id: String(row.id),
    session_id: String(row.session_id),
    source_sentence_id: (row.source_sentence_id as string | null) ?? null,
    order_index: Number(row.order_index ?? 0),
    depth: row.depth,
    expression: row.expression,
    source_line: row.source_line,
    timestamp: row.timestamp,
    natural_meaning_ko: row.natural_meaning_ko,
    story: row.story,
    pronunciation: row.pronunciation,
    variations: row.variations,
    saved_atoms: row.saved_atoms,
    reviewed: row.reviewed,
  });

  return parsed as PremiumExpressionCard;
}

async function fetchCards(sessionId: string): Promise<PremiumExpressionCard[]> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("premium_expression_cards")
    .select("*")
    .eq("session_id", sessionId)
    .order("order_index", { ascending: true });

  if (error) throw error;
  return (data ?? []).map((row) => mapExpressionRow(row));
}

async function fetchArticle(sessionId: string) {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("premium_articles")
    .select("*")
    .eq("session_id", sessionId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapPremiumArticleRow(data) : null;
}

export async function fetchPublishedPremiumSessionById(
  sessionId: string,
): Promise<PremiumSession | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("premium_sessions")
    .select(PREMIUM_SESSION_SELECT)
    .eq("id", sessionId)
    .eq("status", "published")
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const id = String(data.id);
  const [cards, article] = await Promise.all([
    fetchCards(id),
    fetchArticle(id),
  ]);
  return hydratePremiumSession(data, cards, article);
}

export async function fetchTodayPremiumSession(): Promise<PremiumSession | null> {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("premium_sessions")
    .select(PREMIUM_SESSION_SELECT)
    .eq("status", "published")
    .lte("published_on", today)
    .order("published_on", { ascending: false, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  const id = String(data.id);
  const [cards, article] = await Promise.all([
    fetchCards(id),
    fetchArticle(id),
  ]);
  return hydratePremiumSession(data, cards, article);
}

async function fetchPublishedPremiumSessions(
  limit = 20,
): Promise<PremiumSession[]> {
  const today = new Date().toISOString().slice(0, 10);
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("premium_sessions")
    .select(PREMIUM_SESSION_SELECT)
    .eq("status", "published")
    .lte("published_on", today)
    .order("published_on", { ascending: false, nullsFirst: false })
    .order("published_at", { ascending: false, nullsFirst: false })
    .limit(limit);

  if (error) throw error;

  return Promise.all(
    (data ?? []).map(async (row) => {
      const id = String(row.id);
      const [cards, article] = await Promise.all([
        fetchCards(id),
        fetchArticle(id),
      ]);
      return hydratePremiumSession(row, cards, article);
    }),
  );
}

async function fetchUserProfile(
  userId: string,
): Promise<LearningProfile | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("users")
    .select(USER_PROFILE_SELECT)
    .eq("id", userId)
    .maybeSingle();

  if (error) throw error;
  return data ? mapUserProfile(data) : null;
}

export async function fetchTodayPremiumSessionForUser(
  userId: string,
): Promise<PremiumSession | null> {
  const profile = await fetchUserProfile(userId);
  if (!profile || !hasCurationPreferences(profile)) {
    return fetchTodayPremiumSession();
  }

  const sessions = await fetchPublishedPremiumSessions();
  return selectDailyPremiumSession(sessions, profile) ?? sessions[0] ?? null;
}
