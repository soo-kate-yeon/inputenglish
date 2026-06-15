// @MX:ANCHOR: api - Mobile Supabase client for user-owned archive assets.
// Premium session content is read through the web premium API, not direct tables.
import { supabase } from "./supabase";
import type {
  CardComment,
  CardCommentTargetType,
  PlaybookEntry,
  PlaybookMasteryStatus,
  PracticeMode,
} from "@inputenglish/shared";

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
