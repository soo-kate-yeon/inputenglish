import type {
  LearningGoalMode,
  LearningLevelBand,
  LearningProfile,
} from "@inputenglish/shared";
import storage from "./mmkv";
import { supabase } from "./supabase";

const PROFILE_SELECT =
  "id, level_band, goal_mode, focus_tags, preferred_speakers, preferred_situations, preferred_video_categories, onboarding_completed_at, updated_at" as const;

function profileCacheKey(userId: string) {
  return `learning-profile:${userId}`;
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function mapRowToLearningProfile(row: any): LearningProfile {
  return {
    user_id: row.id,
    level_band: (row.level_band as LearningLevelBand | null) ?? null,
    goal_mode: (row.goal_mode as LearningGoalMode | null) ?? null,
    focus_tags: normalizeStringArray(row.focus_tags),
    preferred_speakers: normalizeStringArray(row.preferred_speakers),
    preferred_situations: normalizeStringArray(row.preferred_situations),
    preferred_video_categories: normalizeStringArray(
      row.preferred_video_categories,
    ),
    onboarding_completed_at: row.onboarding_completed_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

export function readCachedLearningProfile(
  userId: string,
): LearningProfile | null {
  const raw = storage.getString(profileCacheKey(userId));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw);
    return mapRowToLearningProfile({ id: userId, ...parsed });
  } catch (error) {
    console.warn("[LearningProfile] Failed to parse cached profile:", error);
    storage.delete(profileCacheKey(userId));
    return null;
  }
}

export function writeCachedLearningProfile(profile: LearningProfile) {
  storage.set(profileCacheKey(profile.user_id), JSON.stringify(profile));
}

export function clearCachedLearningProfile(userId: string) {
  storage.delete(profileCacheKey(userId));
}

export async function fetchLearningProfile(
  userId: string,
): Promise<LearningProfile> {
  const { data, error } = await supabase
    .from("users")
    .upsert({ id: userId }, { onConflict: "id" })
    .select(PROFILE_SELECT)
    .single();

  if (error) throw error;

  const profile = mapRowToLearningProfile(data);
  writeCachedLearningProfile(profile);
  return profile;
}

export async function updateLearningProfile(
  userId: string,
  patch: Partial<Omit<LearningProfile, "user_id">>,
): Promise<LearningProfile> {
  const payload = {
    id: userId,
    ...(patch.level_band !== undefined ? { level_band: patch.level_band } : {}),
    ...(patch.goal_mode !== undefined ? { goal_mode: patch.goal_mode } : {}),
    ...(patch.focus_tags !== undefined ? { focus_tags: patch.focus_tags } : {}),
    ...(patch.preferred_speakers !== undefined
      ? { preferred_speakers: patch.preferred_speakers }
      : {}),
    ...(patch.preferred_situations !== undefined
      ? { preferred_situations: patch.preferred_situations }
      : {}),
    ...(patch.preferred_video_categories !== undefined
      ? { preferred_video_categories: patch.preferred_video_categories }
      : {}),
    ...(patch.onboarding_completed_at !== undefined
      ? { onboarding_completed_at: patch.onboarding_completed_at }
      : {}),
  };

  const { data, error } = await supabase
    .from("users")
    .upsert(payload, { onConflict: "id" })
    .select(PROFILE_SELECT)
    .single();

  if (error) throw error;

  const profile = mapRowToLearningProfile(data);
  writeCachedLearningProfile(profile);
  return profile;
}
