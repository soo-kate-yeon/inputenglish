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

  async saveSession(userId: string, session: Session): Promise<void> {
    await this.ensureUserProfile(userId);

    const { error } = await client.from("sessions").upsert(
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
  },

  // ==================== Highlights ====================

  async saveHighlight(userId: string, highlight: AppHighlight): Promise<void> {
    await this.ensureUserProfile(userId);

    const { error } = await client.from("highlights").insert({
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
  },

  // ==================== Saved Sentences ====================

  async saveSavedSentence(
    userId: string,
    sentence: SavedSentence,
  ): Promise<void> {
    await this.ensureUserProfile(userId);

    const { error } = await client.from("saved_sentences").insert({
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
  },

  async deleteSavedSentence(userId: string, sentenceId: string): Promise<void> {
    const { error } = await client
      .from("saved_sentences")
      .delete()
      .eq("user_id", userId)
      .eq("id", sentenceId);

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
  },

  // ==================== AI Notes ====================

  async saveAINote(userId: string, note: AINote): Promise<void> {
    await this.ensureUserProfile(userId);

    const { error } = await client.from("ai_notes").insert({
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
  },

  // ==================== Load All Data ====================

  async loadAllUserData(userId: string) {
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
