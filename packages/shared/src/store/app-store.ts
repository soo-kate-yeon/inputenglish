// @MX:ANCHOR: createAppStore - platform-agnostic app state factory
// @MX:REASON: [AUTO] fan_in >= 3: used by web, mobile, and test contexts; removes direct Supabase client singleton
// @MX:SPEC: SPEC-MOBILE-001 - factory pattern for cross-platform state management
import { create } from "zustand";
import { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseStore } from "../lib/supabase-store";
import type {
  Video,
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

function normalizeSavedSentence(sentence: SavedSentence): SavedSentence {
  return UUID_PATTERN.test(sentence.id)
    ? sentence
    : { ...sentence, id: generateUuid() };
}

// Re-export domain types for consumers who import from this module
export type { Video, Session, AppHighlight, SavedSentence, AINote };

interface AppState {
  videos: Video[];
  sessions: Record<string, Session>; // Keyed by videoId
  highlights: AppHighlight[];
  savedSentences: SavedSentence[];
  aiNotes: AINote[];

  // Actions
  addSession: (session: Session) => void;
  updateSessionProgress: (videoId: string, progress: number) => void;
  updateSessionPosition: (
    videoId: string,
    step: 1 | 2,
    sentenceIndex?: number,
  ) => void;
  addHighlight: (highlight: AppHighlight) => Promise<void>;
  removeHighlight: (id: string) => Promise<void>;
  addSavedSentence: (sentence: SavedSentence) => Promise<void>;
  removeSavedSentence: (id: string) => Promise<void>;
  pendingSentenceOps: Array<
    { type: "add"; sentence: SavedSentence } | { type: "remove"; id: string }
  >;
  addAINote: (note: AINote) => void;
  removeAINote: (id: string) => void;
  removeSession: (
    videoId: string,
  ) => Promise<{ success: boolean; error?: unknown }>;
  getVideo: (videoId: string) => Video | undefined;

  // Supabase sync
  loadUserData: () => Promise<void>;
  syncPendingOps: (userId: string) => Promise<void>;
}

// Initial Mock Data
const INITIAL_VIDEOS: Video[] = [
  {
    id: "qp0HIF3SfI4",
    title: "How great leaders inspire action | Simon Sinek",
    thumbnailUrl: "https://img.youtube.com/vi/qp0HIF3SfI4/maxresdefault.jpg",
    duration: "18:04",
    description:
      'Simon Sinek has a simple but powerful model for inspirational leadership - starting with a golden circle and the question: "Why?"',
    sentenceCount: 58,
  },
];

// @MX:NOTE: [AUTO] createAppStore accepts a SupabaseClient and getCurrentUserId fn.
// On web: pass createClient() result; on mobile: pass Expo Supabase client.
export const createAppStore = (
  supabaseClient: SupabaseClient,
  getCurrentUserId: () => Promise<string | null>,
) => {
  const supabaseOps = createSupabaseStore(supabaseClient);

  return create<AppState>()((set, get) => ({
    videos: INITIAL_VIDEOS,
    sessions: {},
    highlights: [],
    savedSentences: [],
    aiNotes: [],
    pendingSentenceOps: [],

    addSession: async (session) => {
      const previousSession = get().sessions[session.videoId];

      set((state) => ({
        sessions: { ...state.sessions, [session.videoId]: session },
      }));

      const userId = await getCurrentUserId();
      if (userId) {
        try {
          const persistedSession = await supabaseOps.saveSession(
            userId,
            session,
          );
          set((state) => ({
            sessions: {
              ...state.sessions,
              [session.videoId]: persistedSession,
            },
          }));
        } catch (error) {
          console.error("[Store] Failed to save session:", error);
          set((state) => {
            const nextSessions = { ...state.sessions };
            if (previousSession) {
              nextSessions[session.videoId] = previousSession;
            } else {
              delete nextSessions[session.videoId];
            }
            return { sessions: nextSessions };
          });
        }
      }
    },

    updateSessionProgress: async (videoId, progress) => {
      const session = get().sessions[videoId];
      if (!session) return;

      const updatedSession = {
        ...session,
        progress,
        lastAccessedAt: Date.now(),
      };
      set((state) => ({
        sessions: {
          ...state.sessions,
          [videoId]: updatedSession,
        },
      }));

      const userId = await getCurrentUserId();
      if (userId) {
        try {
          const persistedSession = await supabaseOps.saveSession(
            userId,
            updatedSession,
          );
          set((state) => ({
            sessions: {
              ...state.sessions,
              [videoId]: persistedSession,
            },
          }));
        } catch (error) {
          console.error("[Store] Failed to update session progress:", error);
          set((state) => ({
            sessions: {
              ...state.sessions,
              [videoId]: session,
            },
          }));
        }
      }
    },

    updateSessionPosition: async (videoId, step, sentenceIndex) => {
      const session = get().sessions[videoId];
      if (!session) return;

      console.log(
        `Session updated - Video: ${videoId}, Step: ${step}, Sentence: ${sentenceIndex ?? "N/A"}`,
      );

      const updatedSession = {
        ...session,
        currentStep: step,
        currentSentence: sentenceIndex,
        lastAccessedAt: Date.now(),
      };

      set((state) => ({
        sessions: {
          ...state.sessions,
          [videoId]: updatedSession,
        },
      }));

      const userId = await getCurrentUserId();
      if (userId) {
        try {
          const persistedSession = await supabaseOps.saveSession(
            userId,
            updatedSession,
          );
          set((state) => ({
            sessions: {
              ...state.sessions,
              [videoId]: persistedSession,
            },
          }));
        } catch (error) {
          console.error("[Store] Failed to update session position:", error);
          set((state) => ({
            sessions: {
              ...state.sessions,
              [videoId]: session,
            },
          }));
        }
      }
    },

    addHighlight: async (highlight) => {
      set((state) => ({
        highlights: [...state.highlights, highlight],
      }));

      const userId = await getCurrentUserId();
      if (userId) {
        try {
          const persistedHighlight = await supabaseOps.saveHighlight(
            userId,
            highlight,
          );
          set((state) => ({
            highlights: state.highlights.map((item) =>
              item.id === highlight.id ? persistedHighlight : item,
            ),
          }));
        } catch (error) {
          console.error("[Store] Failed to save highlight:", error);
          set((state) => ({
            highlights: state.highlights.filter(
              (item) => item.id !== highlight.id,
            ),
          }));
        }
      }
    },

    removeHighlight: async (id: string) => {
      const targetHighlight = get().highlights.find((h) => h.id === id);

      set((state) => ({
        highlights: state.highlights.filter((h) => h.id !== id),
      }));

      const userId = await getCurrentUserId();
      if (userId && targetHighlight) {
        try {
          await supabaseOps.deleteHighlight(userId, id);
        } catch (error) {
          console.error("[Store] Failed to delete highlight:", error);
          set((state) => ({
            highlights: [...state.highlights, targetHighlight].sort(
              (a, b) => b.createdAt - a.createdAt,
            ),
          }));
        }
      }
    },

    addSavedSentence: async (sentence) => {
      const normalizedSentence = normalizeSavedSentence(sentence);

      set((state) => ({
        savedSentences: state.savedSentences.some(
          (saved) =>
            saved.videoId === normalizedSentence.videoId &&
            saved.sentenceId === normalizedSentence.sentenceId,
        )
          ? state.savedSentences
          : [...state.savedSentences, normalizedSentence],
      }));

      const userId = await getCurrentUserId();
      if (userId) {
        try {
          const persistedSentence = await supabaseOps.saveSavedSentence(
            userId,
            normalizedSentence,
          );
          set((state) => ({
            savedSentences: state.savedSentences.map((saved) =>
              saved.videoId === normalizedSentence.videoId &&
              saved.sentenceId === normalizedSentence.sentenceId
                ? persistedSentence
                : saved,
            ),
          }));
        } catch (error) {
          console.error("[Store] Failed to save saved sentence:", error);
          set((state) => ({
            savedSentences: state.savedSentences.filter(
              (saved) =>
                !(
                  saved.videoId === normalizedSentence.videoId &&
                  saved.sentenceId === normalizedSentence.sentenceId
                ),
            ),
          }));
        }
      }
    },

    removeSavedSentence: async (id: string) => {
      const targetSentence = get().savedSentences.find((s) => s.id === id);

      set((state) => ({
        savedSentences: state.savedSentences.filter((s) => s.id !== id),
      }));

      const userId = await getCurrentUserId();
      if (userId && targetSentence) {
        try {
          await supabaseOps.deleteSavedSentence(userId, targetSentence);
        } catch (error) {
          console.error("[Store] Failed to delete saved sentence:", error);
          set((state) => ({
            savedSentences: [...state.savedSentences, targetSentence].sort(
              (a, b) => b.createdAt - a.createdAt,
            ),
          }));
        }
      }
    },

    addAINote: async (note) => {
      set((state) => ({
        aiNotes: [...state.aiNotes, note],
      }));

      const userId = await getCurrentUserId();
      if (userId) {
        try {
          const persistedNote = await supabaseOps.saveAINote(userId, note);
          set((state) => ({
            aiNotes: state.aiNotes.map((item) =>
              item.id === note.id ? persistedNote : item,
            ),
          }));
        } catch (error) {
          console.error("[Store] Failed to save AI note:", error);
          set((state) => ({
            aiNotes: state.aiNotes.filter((item) => item.id !== note.id),
          }));
        }
      }
    },

    removeAINote: async (id) => {
      const targetNote = get().aiNotes.find((n) => n.id === id);

      set((state) => ({
        aiNotes: state.aiNotes.filter((n) => n.id !== id),
      }));

      const userId = await getCurrentUserId();
      if (userId && targetNote) {
        try {
          await supabaseOps.deleteAINote(userId, id);
        } catch (error) {
          console.error("[Store] Failed to delete AI note:", error);
          set((state) => ({
            aiNotes: [...state.aiNotes, targetNote].sort(
              (a, b) => b.createdAt - a.createdAt,
            ),
          }));
        }
      }
    },

    getVideo: (videoId) => get().videos.find((v) => v.id === videoId),

    removeSession: async (videoId) => {
      try {
        const userId = await getCurrentUserId();
        if (userId) {
          await supabaseOps.deleteSession(userId, videoId);
        }
        // Update local state after successful DB deletion
        set((state) => {
          const { [videoId]: _, ...remainingSessions } = state.sessions;
          return { sessions: remainingSessions };
        });
        return { success: true };
      } catch (error) {
        console.error(`[Store] Failed to delete session ${videoId}:`, error);
        return { success: false, error };
      }
    },

    syncPendingOps: async (userId: string) => {
      const pending = get().pendingSentenceOps;
      if (pending.length === 0) return;

      const failed: typeof pending = [];
      for (const op of pending) {
        try {
          if (op.type === "add") {
            await supabaseOps.saveSavedSentence(userId, op.sentence);
          } else {
            const targetSentence = get().savedSentences.find(
              (sentence) => sentence.id === op.id,
            );
            if (!targetSentence) {
              continue;
            }
            await supabaseOps.deleteSavedSentence(userId, targetSentence);
          }
        } catch {
          failed.push(op);
        }
      }
      set({ pendingSentenceOps: failed });
    },

    loadUserData: async () => {
      const userId = await getCurrentUserId();
      if (!userId) {
        console.warn("[Store] loadUserData skipped: no userId");
        return;
      }

      // Flush pending offline ops before loading fresh data
      await get().syncPendingOps(userId);

      const data = await supabaseOps.loadAllUserData(userId);
      console.log("[Store] loadUserData result:", {
        userId,
        sessionCount: Object.keys(data.sessions).length,
        highlightCount: data.highlights.length,
        savedSentenceCount: data.savedSentences.length,
        aiNoteCount: data.aiNotes.length,
        savedSentences: data.savedSentences,
      });
      set({
        sessions: data.sessions,
        highlights: data.highlights,
        savedSentences: data.savedSentences,
        aiNotes: data.aiNotes,
      });
    },
  }));
};

export type AppStore = ReturnType<typeof createAppStore>;
