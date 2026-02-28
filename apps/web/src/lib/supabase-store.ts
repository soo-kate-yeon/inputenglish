import { createClient } from "@/utils/supabase/client";
import type { Session, Highlight, SavedSentence, AINote } from "./store";

const supabase = createClient();

// ==================== Sessions ====================

export async function saveSession(userId: string, session: Session) {
  const { error } = await supabase.from("sessions").upsert(
    {
      user_id: userId,
      video_id: session.videoId,
      progress: session.progress,
      last_accessed_at: new Date(session.lastAccessedAt).toISOString(),
      total_sentences: session.totalSentences,
      time_left: session.timeLeft,
      current_step: session.currentStep,
      current_sentence: session.currentSentence,
    },
    {
      onConflict: "user_id,video_id",
    },
  );

  if (error) {
    console.error("Error saving session:", error);
    throw error;
  }
}

export async function deleteSession(userId: string, videoId: string) {
  const { error } = await supabase
    .from("sessions")
    .delete()
    .eq("user_id", userId)
    .eq("video_id", videoId);

  if (error) {
    console.error("Error deleting session:", error);
    throw error;
  }
}

export async function loadSessions(
  userId: string,
): Promise<Record<string, Session>> {
  const { data, error } = await supabase
    .from("sessions")
    .select("*")
    .eq("user_id", userId);

  if (error) {
    console.error("Error loading sessions:", error);
    return {};
  }

  const sessions: Record<string, Session> = {};
  data?.forEach((item) => {
    sessions[item.video_id] = {
      id: item.id,
      videoId: item.video_id,
      progress: item.progress,
      lastAccessedAt: new Date(item.last_accessed_at).getTime(),
      totalSentences: item.total_sentences,
      timeLeft: item.time_left,
      currentStep: item.current_step,
      currentSentence: item.current_sentence,
    };
  });

  return sessions;
}

// ==================== Highlights ====================

export async function saveHighlight(userId: string, highlight: Highlight) {
  const { error } = await supabase.from("highlights").insert({
    id: highlight.id,
    user_id: userId,
    video_id: highlight.videoId,
    sentence_id: highlight.sentenceId,
    original_text: highlight.originalText,
    user_note: highlight.userNote,
    created_at: new Date(highlight.createdAt).toISOString(),
  });

  if (error) {
    console.error("Error saving highlight:", error);
    throw error;
  }
}

export async function deleteHighlight(userId: string, highlightId: string) {
  const { error } = await supabase
    .from("highlights")
    .delete()
    .eq("user_id", userId)
    .eq("id", highlightId);

  if (error) {
    console.error("Error deleting highlight:", error);
    throw error;
  }
}

export async function loadHighlights(userId: string): Promise<Highlight[]> {
  const { data, error } = await supabase
    .from("highlights")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading highlights:", error);
    return [];
  }

  return (
    data?.map((item) => ({
      id: item.id,
      videoId: item.video_id,
      sentenceId: item.sentence_id,
      originalText: item.original_text,
      userNote: item.user_note,
      createdAt: new Date(item.created_at).getTime(),
    })) || []
  );
}

// ==================== Saved Sentences ====================

export async function saveSavedSentence(
  userId: string,
  sentence: SavedSentence,
) {
  const { error } = await supabase.from("saved_sentences").insert({
    id: sentence.id,
    user_id: userId,
    video_id: sentence.videoId,
    sentence_id: sentence.sentenceId,
    sentence_text: sentence.sentenceText,
    start_time: sentence.startTime,
    end_time: sentence.endTime,
    created_at: new Date(sentence.createdAt).toISOString(),
  });

  if (error) {
    console.error("Error saving sentence:", error);
    throw error;
  }
}

export async function deleteSavedSentence(userId: string, sentenceId: string) {
  const { error } = await supabase
    .from("saved_sentences")
    .delete()
    .eq("user_id", userId)
    .eq("id", sentenceId);

  if (error) {
    console.error("Error deleting saved sentence:", error);
    throw error;
  }
}

export async function loadSavedSentences(
  userId: string,
): Promise<SavedSentence[]> {
  const { data, error } = await supabase
    .from("saved_sentences")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading saved sentences:", error);
    return [];
  }

  return (
    data?.map((item) => ({
      id: item.id,
      videoId: item.video_id,
      sentenceId: item.sentence_id,
      sentenceText: item.sentence_text,
      startTime: item.start_time,
      endTime: item.end_time,
      createdAt: new Date(item.created_at).getTime(),
    })) || []
  );
}

// ==================== AI Notes ====================

export async function saveAINote(userId: string, note: AINote) {
  const { error } = await supabase.from("ai_notes").insert({
    id: note.id,
    user_id: userId,
    video_id: note.videoId,
    sentence_id: note.sentenceId,
    sentence_text: note.sentenceText,
    user_feedback: note.userFeedback,
    ai_response: note.aiResponse,
    created_at: new Date(note.createdAt).toISOString(),
  });

  if (error) {
    console.error("Error saving AI note:", error);
    throw error;
  }
}

export async function deleteAINote(userId: string, noteId: string) {
  const { error } = await supabase
    .from("ai_notes")
    .delete()
    .eq("user_id", userId)
    .eq("id", noteId);

  if (error) {
    console.error("Error deleting AI note:", error);
    throw error;
  }
}

export async function loadAINotes(userId: string): Promise<AINote[]> {
  const { data, error } = await supabase
    .from("ai_notes")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Error loading AI notes:", error);
    return [];
  }

  return (
    data?.map((item) => ({
      id: item.id,
      videoId: item.video_id,
      sentenceId: item.sentence_id,
      sentenceText: item.sentence_text,
      userFeedback: item.user_feedback,
      aiResponse: item.ai_response,
      createdAt: new Date(item.created_at).getTime(),
    })) || []
  );
}

// ==================== Load All Data ====================

export async function loadAllUserData(userId: string) {
  const [sessions, highlights, savedSentences, aiNotes] = await Promise.all([
    loadSessions(userId),
    loadHighlights(userId),
    loadSavedSentences(userId),
    loadAINotes(userId),
  ]);

  return {
    sessions,
    highlights,
    savedSentences,
    aiNotes,
  };
}
