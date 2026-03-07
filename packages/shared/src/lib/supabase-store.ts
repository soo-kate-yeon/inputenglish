// @MX:ANCHOR: createSupabaseStore - platform-agnostic Supabase operations factory
// @MX:REASON: [AUTO] fan_in >= 3: used by app-store, study-store, and future mobile store; eliminates singleton client dependency
// @MX:SPEC: SPEC-MOBILE-001 - factory pattern for cross-platform shared code
import { SupabaseClient } from "@supabase/supabase-js";
import type {
  Session,
  AppHighlight,
  SavedSentence,
  AINote,
} from "../types/index";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function generateUuid(): string {
  if (
    typeof crypto !== "undefined" &&
    typeof crypto.randomUUID === "function"
  ) {
    return crypto.randomUUID();
  }

  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    const value = char === "x" ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}

function mapSavedSentenceRow(item: {
  id: string;
  video_id: string;
  sentence_id: string;
  sentence_text: string;
  start_time: number;
  end_time: number;
  created_at: string;
}): SavedSentence {
  return {
    id: item.id,
    videoId: item.video_id,
    sentenceId: item.sentence_id,
    sentenceText: item.sentence_text,
    startTime: item.start_time,
    endTime: item.end_time,
    createdAt: new Date(item.created_at).getTime(),
  };
}

function mapSessionRow(item: {
  id: string;
  video_id: string;
  progress: number;
  last_accessed_at: string;
  total_sentences: number;
  time_left: string;
  current_step: 1 | 2;
  current_sentence?: number;
}): Session {
  return {
    id: item.id,
    videoId: item.video_id,
    progress: item.progress,
    lastAccessedAt: new Date(item.last_accessed_at).getTime(),
    totalSentences: item.total_sentences,
    timeLeft: item.time_left,
    currentStep: item.current_step,
    currentSentence: item.current_sentence,
  };
}

function mapHighlightRow(item: {
  id: string;
  video_id: string;
  sentence_id: string;
  original_text: string;
  user_note?: string;
  created_at: string;
}): AppHighlight {
  return {
    id: item.id,
    videoId: item.video_id,
    sentenceId: item.sentence_id,
    originalText: item.original_text,
    userNote: item.user_note,
    createdAt: new Date(item.created_at).getTime(),
  };
}

function mapAINoteRow(item: {
  id: string;
  video_id: string;
  sentence_id: string;
  sentence_text: string;
  user_feedback: string[];
  ai_response: {
    analysis: string;
    tips: string;
    focusPoint: string;
  };
  created_at: string;
}): AINote {
  return {
    id: item.id,
    videoId: item.video_id,
    sentenceId: item.sentence_id,
    sentenceText: item.sentence_text,
    userFeedback: item.user_feedback,
    aiResponse: item.ai_response,
    createdAt: new Date(item.created_at).getTime(),
  };
}

// @MX:NOTE: [AUTO] Factory returns all Supabase DB operations with injected client.
// Web uses createClient() from @supabase/ssr; mobile uses its own client.
export const createSupabaseStore = (client: SupabaseClient) => ({
  async ensureUserProfile(userId: string): Promise<void> {
    const { error } = await client
      .from("users")
      .upsert({ id: userId }, { onConflict: "id" });

    if (error) {
      console.error("Error ensuring user profile:", error);
      throw error;
    }
  },

  // ==================== Sessions ====================

  async saveSession(userId: string, session: Session): Promise<Session> {
    await this.ensureUserProfile(userId);

    const { data, error } = await client
      .from("sessions")
      .upsert(
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
      )
      .select("*")
      .single();

    if (error) {
      console.error("Error saving session:", error);
      throw error;
    }

    return mapSessionRow(data);
  },

  async deleteSession(userId: string, videoId: string): Promise<void> {
    const { error } = await client
      .from("sessions")
      .delete()
      .eq("user_id", userId)
      .eq("video_id", videoId);

    if (error) {
      console.error("Error deleting session:", error);
      throw error;
    }
  },

  async loadSessions(userId: string): Promise<Record<string, Session>> {
    const { data, error } = await client
      .from("sessions")
      .select("*")
      .eq("user_id", userId);

    if (error) {
      console.error("Error loading sessions:", error);
      return {};
    }

    const sessions: Record<string, Session> = {};
    data?.forEach((item) => {
      sessions[item.video_id] = mapSessionRow(item);
    });

    return sessions;
  },

  // ==================== Highlights ====================

  async saveHighlight(
    userId: string,
    highlight: AppHighlight,
  ): Promise<AppHighlight> {
    await this.ensureUserProfile(userId);

    const { data, error } = await client
      .from("highlights")
      .insert({
        id: UUID_PATTERN.test(highlight.id) ? highlight.id : generateUuid(),
        user_id: userId,
        video_id: highlight.videoId,
        sentence_id: highlight.sentenceId,
        original_text: highlight.originalText,
        user_note: highlight.userNote,
        created_at: new Date(highlight.createdAt).toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error saving highlight:", error);
      throw error;
    }

    return mapHighlightRow(data);
  },

  async deleteHighlight(userId: string, highlightId: string): Promise<void> {
    const { error } = await client
      .from("highlights")
      .delete()
      .eq("user_id", userId)
      .eq("id", highlightId);

    if (error) {
      console.error("Error deleting highlight:", error);
      throw error;
    }
  },

  async loadHighlights(userId: string): Promise<AppHighlight[]> {
    const { data, error } = await client
      .from("highlights")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading highlights:", error);
      return [];
    }

    return data?.map(mapHighlightRow) || [];
  },

  // ==================== Saved Sentences ====================

  async saveSavedSentence(
    userId: string,
    sentence: SavedSentence,
  ): Promise<SavedSentence> {
    await this.ensureUserProfile(userId);
    const payload = {
      user_id: userId,
      video_id: sentence.videoId,
      sentence_id: sentence.sentenceId,
      sentence_text: sentence.sentenceText,
      start_time: sentence.startTime,
      end_time: sentence.endTime,
      created_at: new Date(sentence.createdAt).toISOString(),
    };

    const { data: existingRow, error: existingError } = await client
      .from("saved_sentences")
      .select("*")
      .eq("user_id", userId)
      .eq("video_id", sentence.videoId)
      .eq("sentence_id", sentence.sentenceId)
      .maybeSingle();

    if (existingError) {
      console.error("Error checking existing saved sentence:", existingError);
      throw existingError;
    }

    if (existingRow) {
      const { data, error } = await client
        .from("saved_sentences")
        .update(payload)
        .eq("id", existingRow.id)
        .select("*")
        .single();

      if (error) {
        console.error("Error updating sentence:", error);
        throw error;
      }

      return mapSavedSentenceRow(data);
    }

    const { data, error } = await client
      .from("saved_sentences")
      .insert(payload)
      .select("*")
      .single();

    if (error) {
      console.error("Error saving sentence:", error);
      throw error;
    }

    return mapSavedSentenceRow(data);
  },

  async deleteSavedSentence(
    userId: string,
    sentence: Pick<SavedSentence, "id" | "videoId" | "sentenceId">,
  ): Promise<void> {
    const { error } = await client
      .from("saved_sentences")
      .delete()
      .eq("user_id", userId)
      .eq("video_id", sentence.videoId)
      .eq("sentence_id", sentence.sentenceId);

    if (error) {
      console.error("Error deleting saved sentence:", error);
      throw error;
    }
  },

  async loadSavedSentences(userId: string): Promise<SavedSentence[]> {
    const { data, error } = await client
      .from("saved_sentences")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading saved sentences:", error);
      return [];
    }

    return data?.map(mapSavedSentenceRow) || [];
  },

  // ==================== AI Notes ====================

  async saveAINote(userId: string, note: AINote): Promise<AINote> {
    await this.ensureUserProfile(userId);

    const { data, error } = await client
      .from("ai_notes")
      .insert({
        id: UUID_PATTERN.test(note.id) ? note.id : generateUuid(),
        user_id: userId,
        video_id: note.videoId,
        sentence_id: note.sentenceId,
        sentence_text: note.sentenceText,
        user_feedback: note.userFeedback,
        ai_response: note.aiResponse,
        created_at: new Date(note.createdAt).toISOString(),
      })
      .select("*")
      .single();

    if (error) {
      console.error("Error saving AI note:", error);
      throw error;
    }

    return mapAINoteRow(data);
  },

  async deleteAINote(userId: string, noteId: string): Promise<void> {
    const { error } = await client
      .from("ai_notes")
      .delete()
      .eq("user_id", userId)
      .eq("id", noteId);

    if (error) {
      console.error("Error deleting AI note:", error);
      throw error;
    }
  },

  async loadAINotes(userId: string): Promise<AINote[]> {
    const { data, error } = await client
      .from("ai_notes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading AI notes:", error);
      return [];
    }

    return data?.map(mapAINoteRow) || [];
  },

  // ==================== Load All Data ====================

  async loadAllUserData(userId: string) {
    await this.ensureUserProfile(userId);

    const [sessions, highlights, savedSentences, aiNotes] = await Promise.all([
      this.loadSessions(userId),
      this.loadHighlights(userId),
      this.loadSavedSentences(userId),
      this.loadAINotes(userId),
    ]);

    return {
      sessions,
      highlights,
      savedSentences,
      aiNotes,
    };
  },
});

export type SupabaseStore = ReturnType<typeof createSupabaseStore>;
