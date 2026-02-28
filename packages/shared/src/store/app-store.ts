// @MX:ANCHOR: createAppStore - platform-agnostic app state factory
// @MX:REASON: [AUTO] fan_in >= 3: used by web, mobile, and test contexts; removes direct Supabase client singleton
// @MX:SPEC: SPEC-MOBILE-001 - factory pattern for cross-platform state management
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseStore } from "../lib/supabase-store";
import type { Video, Session, AppHighlight, SavedSentence, AINote } from '../types/index';

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
  addHighlight: (highlight: AppHighlight) => void;
  removeHighlight: (id: string) => void;
  addSavedSentence: (sentence: SavedSentence) => void;
  removeSavedSentence: (id: string) => void;
  addAINote: (note: AINote) => void;
  removeAINote: (id: string) => void;
  removeSession: (
    videoId: string,
  ) => Promise<{ success: boolean; error?: unknown }>;
  getVideo: (videoId: string) => Video | undefined;

  // Supabase sync
  loadUserData: () => Promise<void>;
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

  return create<AppState>()(
    persist(
      (set, get) => ({
        videos: INITIAL_VIDEOS,
        sessions: {},
        highlights: [],
        savedSentences: [],
        aiNotes: [],

        addSession: async (session) => {
          set((state) => ({
            sessions: { ...state.sessions, [session.videoId]: session },
          }));

          const userId = await getCurrentUserId();
          if (userId) {
            await supabaseOps.saveSession(userId, session);
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
            await supabaseOps.saveSession(userId, updatedSession);
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
            await supabaseOps.saveSession(userId, updatedSession);
          }
        },

        addHighlight: async (highlight) => {
          set((state) => ({
            highlights: [...state.highlights, highlight],
          }));

          const userId = await getCurrentUserId();
          if (userId) {
            await supabaseOps.saveHighlight(userId, highlight);
          }
        },

        removeHighlight: async (id: string) => {
          set((state) => ({
            highlights: state.highlights.filter((h) => h.id !== id),
          }));

          const userId = await getCurrentUserId();
          if (userId) {
            await supabaseOps.deleteHighlight(userId, id);
          }
        },

        addSavedSentence: async (sentence) => {
          set((state) => ({
            savedSentences: [...state.savedSentences, sentence],
          }));

          const userId = await getCurrentUserId();
          if (userId) {
            await supabaseOps.saveSavedSentence(userId, sentence);
          }
        },

        removeSavedSentence: async (id: string) => {
          set((state) => ({
            savedSentences: state.savedSentences.filter((s) => s.id !== id),
          }));

          const userId = await getCurrentUserId();
          if (userId) {
            await supabaseOps.deleteSavedSentence(userId, id);
          }
        },

        addAINote: async (note) => {
          set((state) => ({
            aiNotes: [...state.aiNotes, note],
          }));

          const userId = await getCurrentUserId();
          if (userId) {
            await supabaseOps.saveAINote(userId, note);
          }
        },

        removeAINote: async (id) => {
          set((state) => ({
            aiNotes: state.aiNotes.filter((n) => n.id !== id),
          }));

          const userId = await getCurrentUserId();
          if (userId) {
            await supabaseOps.deleteAINote(userId, id);
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
            console.error(
              `[Store] Failed to delete session ${videoId}:`,
              error,
            );
            return { success: false, error };
          }
        },

        loadUserData: async () => {
          const userId = await getCurrentUserId();
          if (!userId) return;

          const data = await supabaseOps.loadAllUserData(userId);
          set({
            sessions: data.sessions,
            highlights: data.highlights,
            savedSentences: data.savedSentences,
            aiNotes: data.aiNotes,
          });
        },
      }),
      {
        name: "shadowoo-app-v1",
      },
    ),
  );
};

export type AppStore = ReturnType<typeof createAppStore>;
