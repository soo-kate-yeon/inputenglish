// @MX:ANCHOR: createStudyStore - platform-agnostic study session state factory
// @MX:REASON: [AUTO] fan_in >= 3: used by web, mobile, and test contexts; injects storage for cross-platform persistence
// @MX:SPEC: SPEC-MOBILE-001 - factory pattern with injectable storage for cross-platform support
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { StateStorage } from 'zustand/middleware';
import { StudySession, Sentence, Highlight } from '../types/index';

interface StudyStoreState {
    sessions: StudySession[];
    currentSession: StudySession | null;

    // Session management
    createSession: (videoId: string, videoTitle: string, sentences: Sentence[]) => void;
    setCurrentSession: (sessionId: string) => void;
    updateSessionPhase: (sessionId: string, phase: StudySession['currentPhase']) => void;
    completeSession: (sessionId: string) => void;

    // Sentence management
    addNoteToSentence: (sessionId: string, sentenceId: string, tags: string[], aiTip?: string) => void;
    addHighlightToSentence: (sessionId: string, sentenceId: string, highlight: Highlight) => void;
    updateHighlightCaption: (sessionId: string, sentenceId: string, highlightId: string, caption: string) => void;
    removeHighlight: (sessionId: string, sentenceId: string, highlightId: string) => void;
}

// @MX:NOTE: [AUTO] storage param defaults to localStorage for web; pass AsyncStorage for React Native.
// Pass undefined in tests to use in-memory storage.
export const createStudyStore = (storage?: StateStorage) => create<StudyStoreState>()(
    persist(
        (set) => ({
            sessions: [],
            currentSession: null,

            createSession: (videoId, videoTitle, sentences) => {
                const newSession: StudySession = {
                    id: crypto.randomUUID(),
                    videoId,
                    videoTitle,
                    sentences,
                    createdAt: new Date(),
                    updatedAt: new Date(),
                    currentPhase: 'blind',
                    isCompleted: false,
                };

                set((state) => ({
                    sessions: [...state.sessions, newSession],
                    currentSession: newSession,
                }));
            },

            setCurrentSession: (sessionId) => {
                set((state) => ({
                    currentSession: state.sessions.find((s) => s.id === sessionId) || null,
                }));
            },

            updateSessionPhase: (sessionId, phase) => {
                set((state) => ({
                    sessions: state.sessions.map((s) =>
                        s.id === sessionId
                            ? { ...s, currentPhase: phase, updatedAt: new Date() }
                            : s
                    ),
                    currentSession:
                        state.currentSession?.id === sessionId
                            ? { ...state.currentSession, currentPhase: phase, updatedAt: new Date() }
                            : state.currentSession,
                }));
            },

            completeSession: (sessionId) => {
                set((state) => ({
                    sessions: state.sessions.map((s) =>
                        s.id === sessionId
                            ? { ...s, isCompleted: true, updatedAt: new Date() }
                            : s
                    ),
                }));
            },

            addNoteToSentence: (sessionId, sentenceId, tags, aiTip) => {
                set((state) => ({
                    sessions: state.sessions.map((session) =>
                        session.id === sessionId
                            ? {
                                ...session,
                                sentences: session.sentences.map((sentence) =>
                                    sentence.id === sentenceId
                                        ? {
                                            ...sentence,
                                            notes: {
                                                difficultyTags: tags,
                                                aiTip,
                                            },
                                        }
                                        : sentence
                                ),
                                updatedAt: new Date(),
                            }
                            : session
                    ),
                    currentSession:
                        state.currentSession?.id === sessionId
                            ? {
                                ...state.currentSession,
                                sentences: state.currentSession.sentences.map((sentence) =>
                                    sentence.id === sentenceId
                                        ? {
                                            ...sentence,
                                            notes: {
                                                difficultyTags: tags,
                                                aiTip,
                                            },
                                        }
                                        : sentence
                                ),
                                updatedAt: new Date(),
                            }
                            : state.currentSession,
                }));
            },

            addHighlightToSentence: (sessionId, sentenceId, highlight) => {
                set((state) => ({
                    sessions: state.sessions.map((session) =>
                        session.id === sessionId
                            ? {
                                ...session,
                                sentences: session.sentences.map((sentence) =>
                                    sentence.id === sentenceId
                                        ? {
                                            ...sentence,
                                            highlights: [...sentence.highlights, highlight],
                                        }
                                        : sentence
                                ),
                                updatedAt: new Date(),
                            }
                            : session
                    ),
                    currentSession:
                        state.currentSession?.id === sessionId
                            ? {
                                ...state.currentSession,
                                sentences: state.currentSession.sentences.map((sentence) =>
                                    sentence.id === sentenceId
                                        ? {
                                            ...sentence,
                                            highlights: [...sentence.highlights, highlight],
                                        }
                                        : sentence
                                ),
                                updatedAt: new Date(),
                            }
                            : state.currentSession,
                }));
            },

            updateHighlightCaption: (sessionId, sentenceId, highlightId, caption) => {
                set((state) => ({
                    sessions: state.sessions.map((session) =>
                        session.id === sessionId
                            ? {
                                ...session,
                                sentences: session.sentences.map((sentence) =>
                                    sentence.id === sentenceId
                                        ? {
                                            ...sentence,
                                            highlights: sentence.highlights.map((h) =>
                                                h.id === highlightId ? { ...h, caption } : h
                                            ),
                                        }
                                        : sentence
                                ),
                                updatedAt: new Date(),
                            }
                            : session
                    ),
                    currentSession:
                        state.currentSession?.id === sessionId
                            ? {
                                ...state.currentSession,
                                sentences: state.currentSession.sentences.map((sentence) =>
                                    sentence.id === sentenceId
                                        ? {
                                            ...sentence,
                                            highlights: sentence.highlights.map((h) =>
                                                h.id === highlightId ? { ...h, caption } : h
                                            ),
                                        }
                                        : sentence
                                ),
                                updatedAt: new Date(),
                            }
                            : state.currentSession,
                }));
            },

            removeHighlight: (sessionId, sentenceId, highlightId) => {
                set((state) => ({
                    sessions: state.sessions.map((session) =>
                        session.id === sessionId
                            ? {
                                ...session,
                                sentences: session.sentences.map((sentence) =>
                                    sentence.id === sentenceId
                                        ? {
                                            ...sentence,
                                            highlights: sentence.highlights.filter((h) => h.id !== highlightId),
                                        }
                                        : sentence
                                ),
                                updatedAt: new Date(),
                            }
                            : session
                    ),
                    currentSession:
                        state.currentSession?.id === sessionId
                            ? {
                                ...state.currentSession,
                                sentences: state.currentSession.sentences.map((sentence) =>
                                    sentence.id === sentenceId
                                        ? {
                                            ...sentence,
                                            highlights: sentence.highlights.filter((h) => h.id !== highlightId),
                                        }
                                        : sentence
                                ),
                                updatedAt: new Date(),
                            }
                            : state.currentSession,
                }));
            },
        }),
        {
            name: 'shadowoo-study-v1',
            storage: storage ? createJSONStorage(() => storage) : undefined,
        }
    )
);

export type StudyStore = ReturnType<typeof createStudyStore>;
