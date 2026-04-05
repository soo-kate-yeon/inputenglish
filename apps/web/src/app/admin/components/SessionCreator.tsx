import React, { useState, useMemo, useEffect } from "react";
import type {
  Sentence,
  SceneRecommendation,
  LearningSession,
  SessionContext,
  KeyVocabularyEntry,
  SessionRoleRelevance,
  SessionSourceType,
  SessionSpeakingFunction,
} from "@inputenglish/shared";
import { SESSION_SOURCE_TYPES } from "@inputenglish/shared";
import { Check, Plus, Trash2, Clock, Edit2, Sparkles } from "lucide-react";
import { TransformationExerciseEditor } from "./TransformationExerciseEditor";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const SOURCE_TYPE_LABELS: Record<SessionSourceType, string> = {
  keynote: "키노트",
  demo: "데모",
  "earnings-call": "실적 발표",
  podcast: "팟캐스트",
  interview: "인터뷰",
  panel: "패널 토크",
};

const SPEAKING_FUNCTION_LABELS: Record<SessionSpeakingFunction, string> = {
  persuade: "설득하기",
  "explain-metric": "지표 설명",
  summarize: "핵심 요약",
  hedge: "조심스럽게 말하기",
  disagree: "부드럽게 반대하기",
  propose: "제안하기",
  "answer-question": "질문 답변",
  "buy-time": "생각할 시간 벌기",
  clarify: "확인/되묻기",
  recover: "말 실수 수습",
  "build-rapport": "관계 형성/스몰토크",
  redirect: "주제 전환",
};

function createEmptyContext(): SessionContext {
  return {
    reusable_scenarios: [],
    key_vocabulary: [],
    grammar_rhetoric_note: "",
    expected_takeaway: "",
    generated_by: "manual",
  };
}

function arrayToMultiline(value: string[]): string {
  return value.join("\n");
}

function multilineToArray(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function vocabToMultiline(items: (string | KeyVocabularyEntry)[]): string {
  return items
    .map((item) => {
      if (typeof item === "string") return item;
      const parts = [item.expression || ""];
      if (item.example) parts.push(item.example);
      if (item.translation) parts.push(item.translation);
      return parts.join(" — ");
    })
    .join("\n");
}

function multilineToVocab(value: string): (string | KeyVocabularyEntry)[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(" — ").map((p) => p.trim());
      if (parts.length < 2) return line;
      return {
        expression: parts[0],
        example: parts[1] || "",
        translation: parts[2] || "",
      };
    });
}

interface SessionCreatorProps {
  sentences: Sentence[];
  videoId: string;
  videoTitle?: string;
  onSessionsChange: (sessions: LearningSession[]) => void;
  initialSessions?: LearningSession[];
  suggestedScenes?: SceneRecommendation[];
  onTranslateSelected?: (sentenceIds: string[]) => Promise<void>;
}

export function SessionCreator({
  sentences,
  videoId,
  videoTitle,
  onSessionsChange,
  initialSessions = [],
  suggestedScenes = [],
  onTranslateSelected,
}: SessionCreatorProps) {
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  const [isSuggestionModalOpen, setIsSuggestionModalOpen] = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);

  // Edit Sheet State
  const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<LearningSession | null>(
    null,
  );
  const [editTab, setEditTab] = useState<"context" | "transformation">(
    "context",
  );
  const [editTitle, setEditTitle] = useState("");
  const [editSubtitle, setEditSubtitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDifficulty, setEditDifficulty] = useState<
    "beginner" | "intermediate" | "advanced"
  >("intermediate");
  const [editSourceType, setEditSourceType] =
    useState<SessionSourceType>("podcast");
  const [editSpeakingFunction, setEditSpeakingFunction] =
    useState<SessionSpeakingFunction>("summarize");
  const [editRoleRelevance, setEditRoleRelevance] = useState<
    SessionRoleRelevance[]
  >(["pm"]);
  const [editPremiumRequired, setEditPremiumRequired] = useState(true);
  const [editContext, setEditContext] =
    useState<SessionContext>(createEmptyContext());
  const [isEditGeneratingContext, setIsEditGeneratingContext] = useState(false);
  const [isEditAutofilling, setIsEditAutofilling] = useState(false);

  // List State
  const [createdSessions, setCreatedSessions] =
    useState<LearningSession[]>(initialSessions);

  // Effect to notify parent
  useEffect(() => {
    onSessionsChange(createdSessions);
  }, [createdSessions, onSessionsChange]);

  // Sync with initialSessions when they change (e.g., when loading existing video)
  useEffect(() => {
    if (initialSessions.length > 0 && createdSessions.length === 0) {
      setCreatedSessions(initialSessions);
      console.log(
        `📥 Loaded ${initialSessions.length} sessions into SessionCreator`,
      );
    }
  }, [initialSessions]);

  useEffect(() => {
    if (suggestedScenes.length > 0) {
      setIsSuggestionModalOpen(true);
    }
  }, [suggestedScenes.length]);

  // Auto-sync sessions when sentences are edited in Step2
  useEffect(() => {
    if (createdSessions.length === 0) return;

    // Update each session's sentence content to reflect current state
    const updatedSessions = createdSessions.map((session) => {
      // Map sentence_ids to current sentence objects
      const currentSentences = session.sentence_ids
        .map((id) => sentences.find((s) => s.id === id))
        .filter((s): s is Sentence => s !== undefined);

      // Skip if no sentences found (shouldn't happen)
      if (currentSentences.length === 0) return session;

      // Recalculate times based on updated sentences
      const startTime = currentSentences[0].startTime;
      const endTime = currentSentences[currentSentences.length - 1].endTime;
      const duration = endTime - startTime;

      return {
        ...session,
        sentences: currentSentences,
        start_time: startTime,
        end_time: endTime,
        duration,
      };
    });

    // Only update if something actually changed
    const hasChanges = updatedSessions.some((updated, idx) => {
      const original = createdSessions[idx];
      return (
        updated.start_time !== original.start_time ||
        updated.end_time !== original.end_time ||
        JSON.stringify(updated.sentences) !== JSON.stringify(original.sentences)
      );
    });

    if (hasChanges) {
      setCreatedSessions(updatedSessions);
    }
  }, [sentences]); // Trigger when sentences array changes

  // Derived State
  const sortedSelectedSentences = useMemo(() => {
    if (selectedIds.size === 0) return [];
    // Filter and sort based on original order in 'sentences' array
    return sentences
      .filter((s) => selectedIds.has(s.id))
      .sort((a, b) => a.startTime - b.startTime);
  }, [sentences, selectedIds]);

  const selectionDuration = useMemo(() => {
    if (sortedSelectedSentences.length === 0) return 0;
    const start = sortedSelectedSentences[0].startTime;
    const end =
      sortedSelectedSentences[sortedSelectedSentences.length - 1].endTime;
    return Math.max(0, end - start);
  }, [sortedSelectedSentences]);

  // Handlers
  const handleSentenceClick = (sentenceId: string, e: React.MouseEvent) => {
    if (e.shiftKey && lastClickedId) {
      // Range selection
      const currentIndex = sentences.findIndex((s) => s.id === sentenceId);
      const lastIndex = sentences.findIndex((s) => s.id === lastClickedId);

      if (currentIndex === -1 || lastIndex === -1) return;

      const start = Math.min(currentIndex, lastIndex);
      const end = Math.max(currentIndex, lastIndex);

      const newSelected = new Set(selectedIds);
      // If ctrl/cmd is NOT held, we might want to keep existing?
      // Standard behavior: Shift adds to selection or defines range.
      // Let's make Shift+Click add the range.
      for (let i = start; i <= end; i++) {
        newSelected.add(sentences[i].id);
      }
      setSelectedIds(newSelected);
    } else if (e.metaKey || e.ctrlKey) {
      // Toggle individual
      const newSelected = new Set(selectedIds);
      if (newSelected.has(sentenceId)) {
        newSelected.delete(sentenceId);
      } else {
        newSelected.add(sentenceId);
      }
      setSelectedIds(newSelected);
      setLastClickedId(sentenceId);
    } else {
      // Single select (and clear others? usually yes for file explorers,
      // but for this multi-select builder, maybe toggle or start new?)
      // Let's implement: Click = Toggle, but keep others?
      // User requested "shift+click으로 선택하면".
      // Usually, simple click selects just one and clears others.
      // Ctrl+click toggles.
      // Let's stick to standard: Click = Select Only This; Ctrl+Click = Toggle; Shift+Click = Range

      const newSelected = new Set<string>();
      newSelected.add(sentenceId);
      setSelectedIds(newSelected);
      setLastClickedId(sentenceId);
    }
  };

  const handleDeleteSession = (sessionId: string) => {
    setCreatedSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleOpenEditSheet = (
    session: LearningSession,
    tab: "context" | "transformation" = "context",
  ) => {
    setEditingSession(session);
    setEditTitle(session.title);
    setEditSubtitle(session.subtitle || "");
    setEditDescription(session.description || "");
    setEditDifficulty(session.difficulty || "intermediate");
    setEditSourceType(session.source_type || "podcast");
    setEditSpeakingFunction(session.speaking_function || "summarize");
    setEditRoleRelevance(session.role_relevance || ["pm"]);
    setEditPremiumRequired(session.premium_required ?? true);
    setEditContext(session.context ?? createEmptyContext());
    setEditTab(tab);
    setIsEditSheetOpen(true);
  };

  const handleSaveEditSession = () => {
    if (!editingSession) return;
    setCreatedSessions((prev) =>
      prev.map((s) =>
        s.id === editingSession.id
          ? {
              ...s,
              title: editTitle,
              subtitle: editSubtitle,
              description: editDescription,
              difficulty: editDifficulty,
              source_type: editSourceType,
              speaking_function: editSpeakingFunction,
              role_relevance: editRoleRelevance,
              premium_required: editPremiumRequired,
              context: {
                ...editContext,
                speaking_function: editSpeakingFunction,
              },
            }
          : s,
      ),
    );
    setIsEditSheetOpen(false);
  };

  const handleCreateAndEditSession = () => {
    if (sortedSelectedSentences.length === 0) return;

    const newSession: LearningSession = {
      id: crypto.randomUUID(),
      source_video_id: videoId,
      title: "",
      description: "",
      start_time: sortedSelectedSentences[0].startTime,
      end_time:
        sortedSelectedSentences[sortedSelectedSentences.length - 1].endTime,
      duration: selectionDuration,
      sentence_ids: sortedSelectedSentences.map((s) => s.id),
      difficulty: "intermediate",
      order_index: createdSessions.length,
      source_type: "podcast",
      speaking_function: "summarize",
      role_relevance: ["pm"],
      premium_required: true,
      created_at: new Date().toISOString(),
      sentences: sortedSelectedSentences,
      context: null,
    };

    setCreatedSessions((prev) => [...prev, newSession]);
    setSelectedIds(new Set());
    setLastClickedId(null);
    handleOpenEditSheet(newSession);
  };

  const handleAutofillEdit = async () => {
    if (!editingSession) return;
    const sessionSentences = sentences.filter((s) =>
      editingSession.sentence_ids.includes(s.id),
    );
    if (sessionSentences.length === 0) return;

    setIsEditAutofilling(true);
    try {
      const response = await fetch("/api/admin/autofill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sentences: sessionSentences, videoTitle }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.error || "Failed to autofill session details",
        );
      }

      const data = await response.json();
      setEditTitle(data.title);
      setEditSubtitle(data.subtitle || "");
      setEditDescription(data.description);
      setEditSourceType(data.sourceType || "podcast");
      setEditSpeakingFunction(data.speakingFunction || "summarize");
      setEditRoleRelevance(data.roleRelevance || ["pm"]);
      setEditPremiumRequired(Boolean(data.premiumRequired));
    } catch (error) {
      console.error("Autofill error:", error);
      alert("AI 자동 완성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsEditAutofilling(false);
    }
  };

  const handleGenerateEditContext = async () => {
    if (!editingSession || !editTitle.trim()) return;
    const sessionSentences = sentences.filter((s) =>
      editingSession.sentence_ids.includes(s.id),
    );
    if (sessionSentences.length === 0) return;

    setIsEditGeneratingContext(true);
    try {
      const response = await fetch("/api/admin/generate-session-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          speakingFunction: editSpeakingFunction,
          sentences: sessionSentences,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate context");
      }

      const data = (await response.json()) as SessionContext;
      setEditContext(data);
      if (data.speaking_function) {
        setEditSpeakingFunction(data.speaking_function);
      }
    } catch (error) {
      console.error("Context generation error:", error);
      alert("프리러닝 컨텍스트 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsEditGeneratingContext(false);
    }
  };

  const buildSuggestedSession = (
    scene: SceneRecommendation,
    orderIndex: number,
  ): LearningSession => {
    const sceneSentences = sentences.slice(
      scene.startIndex,
      scene.endIndex + 1,
    );

    return {
      id: crypto.randomUUID(),
      source_video_id: videoId,
      title: scene.title,
      description: scene.reason,
      start_time: sceneSentences[0].startTime,
      end_time: sceneSentences[sceneSentences.length - 1].endTime,
      duration: scene.estimatedDuration,
      sentence_ids: sceneSentences.map((s) => s.id),
      difficulty: "intermediate" as const,
      order_index: orderIndex,
      source_type: "podcast" as const,
      speaking_function: "summarize" as const,
      role_relevance: ["pm"] as SessionRoleRelevance[],
      premium_required: true,
      created_at: new Date().toISOString(),
      sentences: sceneSentences,
      context: null,
    };
  };

  const handleUseSuggestion = (scene: SceneRecommendation) => {
    const newSession = buildSuggestedSession(scene, createdSessions.length);
    setCreatedSessions((prev) => [...prev, newSession]);
    setIsSuggestionModalOpen(false);
    handleOpenEditSheet(newSession);
  };

  const handleCreateSuggestion = (scene: SceneRecommendation) => {
    setCreatedSessions((prev) => [
      ...prev,
      buildSuggestedSession(scene, prev.length),
    ]);
    setIsSuggestionModalOpen(false);
  };

  const handleUseAllSuggestions = () => {
    const newSessions = suggestedScenes.map((scene, idx) =>
      buildSuggestedSession(scene, createdSessions.length + idx),
    );
    setCreatedSessions([...createdSessions, ...newSessions]);
    setIsSuggestionModalOpen(false);
  };

  return (
    <div
      className="flex flex-col flex-1 overflow-hidden min-h-0"
      style={{
        backgroundColor: "#fafafa",
        gap: 0,
      }}
    >
      {/* Header */}
      <div
        className="shrink-0 flex items-center justify-between"
        style={{
          backgroundColor: "#fafafa",
          borderBottom: "1px solid #e5e5e5",
          padding: "6px 12px",
        }}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: "#0a0a0a" }}>
            Step 3: 세션 만들기
          </span>
          {suggestedScenes.length > 0 ? (
            <button
              type="button"
              onClick={() => setIsSuggestionModalOpen(true)}
              className="flex items-center"
              style={{
                gap: 4,
                padding: "2px 8px",
                border: "1px solid #ddd6fe",
                backgroundColor: "#f5f3ff",
                color: "#6d28d9",
                fontSize: 10,
                cursor: "pointer",
              }}
            >
              <Sparkles className="w-3 h-3" />
              AI 추천 장면 보기 ({suggestedScenes.length})
            </button>
          ) : null}
        </div>
        <span className="text-xs" style={{ color: "#737373" }}>
          {createdSessions.length}개 생성됨
        </span>
      </div>

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Sentence Selector */}
        <div
          className="flex flex-col overflow-hidden"
          style={{
            flex: 1,
            backgroundColor: "#ffffff",
            borderRight: "1px solid #e5e5e5",
          }}
        >
          <div
            className="shrink-0 flex justify-between items-center"
            style={{ padding: "4px 12px", borderBottom: "1px solid #f0f0f0" }}
          >
            <span className="text-xs font-medium" style={{ color: "#0a0a0a" }}>
              Transcript ({sentences.length})
            </span>
            <span className="text-[10px]" style={{ color: "#a3a3a3" }}>
              Shift+Click range
            </span>
          </div>
          <div className="flex-1 overflow-y-auto select-none">
            {sentences.map((s) => {
              const isSelected = selectedIds.has(s.id);
              return (
                <div
                  key={s.id}
                  onClick={(e) => handleSentenceClick(s.id, e)}
                  className="flex items-start cursor-pointer transition-colors"
                  style={{
                    padding: "6px 12px",
                    gap: 8,
                    backgroundColor: isSelected ? "#fafafa" : "transparent",
                    borderBottom: "1px solid #f5f5f5",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.backgroundColor = "#fafafa";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {/* Checkbox */}
                  <div
                    className="shrink-0 flex items-center"
                    style={{ paddingTop: 2 }}
                  >
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        border: isSelected ? "none" : "1px solid #d4d4d4",
                        backgroundColor: isSelected ? "#171717" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {isSelected && <Check className="w-3 h-3 text-white" />}
                    </div>
                  </div>
                  {/* Time */}
                  <span
                    className="shrink-0 text-[10px] font-mono"
                    style={{ color: "#a3a3a3", width: 32, paddingTop: 3 }}
                  >
                    {Math.floor(s.startTime / 60)}:
                    {String(Math.floor(s.startTime % 60)).padStart(2, "0")}
                  </span>
                  {/* Text */}
                  <span
                    className="flex-1 text-xs"
                    style={{
                      color: isSelected ? "#0a0a0a" : "#525252",
                      fontWeight: isSelected ? 500 : 400,
                      lineHeight: 1.5,
                    }}
                  >
                    {s.text}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Footer */}
          <div
            className="shrink-0 flex justify-between items-center"
            style={{
              padding: "4px 12px",
              borderTop: "1px solid #e5e5e5",
              backgroundColor: "#fafafa",
            }}
          >
            <span className="text-[10px]" style={{ color: "#737373" }}>
              {selectedIds.size} selected
            </span>
            {onTranslateSelected && selectedIds.size > 0 && (
              <button
                onClick={async () => {
                  setIsTranslating(true);
                  try {
                    await onTranslateSelected(Array.from(selectedIds));
                  } finally {
                    setIsTranslating(false);
                  }
                }}
                disabled={isTranslating}
                className="text-[10px] uppercase tracking-wide"
                style={{
                  backgroundColor: isTranslating ? "#d4d4d4" : "#171717",
                  color: "#fff",
                  padding: "1px 6px",
                  border: "none",
                  cursor: isTranslating ? "not-allowed" : "pointer",
                }}
              >
                {isTranslating ? "Translating..." : "Translate"}
              </button>
            )}
            <span
              className="text-[10px] font-mono font-medium"
              style={{ color: "#171717" }}
            >
              {Math.floor(selectionDuration / 60)}:
              {String(Math.floor(selectionDuration % 60)).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Right: Sessions List */}
        <div className="flex flex-col overflow-hidden" style={{ flex: 1 }}>
          {/* Create Session Bar */}
          <div
            className="shrink-0 flex items-center justify-between"
            style={{
              padding: "6px 12px",
              borderBottom: "1px solid #e5e5e5",
              backgroundColor: selectedIds.size > 0 ? "#fafafa" : "#ffffff",
              minHeight: 36,
            }}
          >
            {selectedIds.size > 0 ? (
              <>
                <span className="text-xs" style={{ color: "#525252" }}>
                  <span style={{ fontWeight: 600, color: "#0a0a0a" }}>
                    {selectedIds.size}문장
                  </span>{" "}
                  선택됨
                  <span
                    className="font-mono ml-2"
                    style={{ color: "#a3a3a3", fontSize: 10 }}
                  >
                    <Clock className="w-3 h-3 inline mr-1" />
                    {Math.floor(selectionDuration / 60)}:
                    {String(Math.floor(selectionDuration % 60)).padStart(
                      2,
                      "0",
                    )}
                  </span>
                </span>
                <button
                  onClick={handleCreateAndEditSession}
                  className="flex items-center"
                  style={{
                    gap: 4,
                    padding: "3px 10px",
                    backgroundColor: "#0a0a0a",
                    color: "#ffffff",
                    fontSize: 11,
                    fontWeight: 600,
                    border: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#404040";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#0a0a0a";
                  }}
                >
                  <Plus className="w-3 h-3" />
                  세션 만들기
                </button>
              </>
            ) : (
              <span className="text-[11px]" style={{ color: "#a3a3a3" }}>
                왼쪽에서 문장을 선택하면 세션을 만들 수 있습니다
              </span>
            )}
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto">
            <div
              className="shrink-0 flex items-center"
              style={{ padding: "4px 12px", borderBottom: "1px solid #f0f0f0" }}
            >
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "#a3a3a3" }}
              >
                Sessions ({createdSessions.length})
              </span>
            </div>
            {createdSessions.length === 0 ? (
              <div
                className="flex items-center justify-center"
                style={{ padding: 24, color: "#d4d4d4" }}
              >
                <p className="text-xs">No sessions yet</p>
              </div>
            ) : (
              createdSessions.map((session, idx) => (
                <div
                  key={session.id}
                  className="flex items-start group transition-colors"
                  style={{
                    padding: "8px 12px",
                    borderBottom: "1px solid #f5f5f5",
                    gap: 8,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#fafafa";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    className="shrink-0 text-[10px] font-mono"
                    style={{ color: "#a3a3a3", paddingTop: 2 }}
                  >
                    #{idx + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-xs font-medium truncate"
                      style={{ color: "#0a0a0a" }}
                    >
                      {session.title}
                    </div>
                    {session.subtitle ? (
                      <div
                        className="text-[10px] truncate"
                        style={{ color: "#6d28d9", marginTop: 1 }}
                      >
                        {session.subtitle}
                      </div>
                    ) : null}
                    <div
                      className="flex items-center text-[10px]"
                      style={{ gap: 6, color: "#a3a3a3", marginTop: 2 }}
                    >
                      <span className="font-mono">
                        {Math.floor(session.duration / 60)}:
                        {String(Math.floor(session.duration % 60)).padStart(
                          2,
                          "0",
                        )}
                      </span>
                      <span>{session.sentence_ids.length} sent.</span>
                      <span className="capitalize">{session.difficulty}</span>
                      {session.source_type ? (
                        <span>{SOURCE_TYPE_LABELS[session.source_type]}</span>
                      ) : null}
                      {session.speaking_function ? (
                        <span>
                          {SPEAKING_FUNCTION_LABELS[session.speaking_function]}
                        </span>
                      ) : null}
                      {session.premium_required ? <span>Premium</span> : null}
                      {session.context ? <span>Context</span> : null}
                    </div>
                  </div>
                  <div
                    className="flex items-center shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    style={{ gap: 2 }}
                  >
                    <button
                      onClick={() => handleOpenEditSheet(session)}
                      title="세션 편집하기"
                      style={{
                        padding: "2px 8px",
                        color: "#525252",
                        fontSize: 10,
                        fontWeight: 600,
                        border: "1px solid #e5e5e5",
                        backgroundColor: "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        gap: 3,
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor = "#f5f5f5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "#ffffff";
                      }}
                    >
                      <Edit2 className="w-3 h-3" />
                      세션 편집하기
                    </button>
                    <button
                      onClick={() => handleDeleteSession(session.id)}
                      style={{ padding: 2, color: "#a3a3a3" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#ef4444";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#a3a3a3";
                      }}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Session Edit Sheet */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent
          side="right"
          className="w-full max-w-[800px] gap-0 border-l border-[#e5e5e5] bg-white p-0 sm:max-w-[800px] flex flex-col"
        >
          <SheetHeader className="shrink-0 border-b border-[#e5e5e5] px-6 py-4">
            <SheetTitle className="text-sm font-bold text-[#0a0a0a]">
              {editTitle || "세션 편집하기"}
            </SheetTitle>
            <SheetDescription className="text-xs text-[#737373]">
              프리러닝 컨텍스트와 변형문제를 설정합니다.
            </SheetDescription>
          </SheetHeader>

          {/* Tab Menu */}
          <div
            className="shrink-0 flex"
            style={{ borderBottom: "1px solid #e5e5e5" }}
          >
            {(["context", "transformation"] as const).map((tab) => {
              const label =
                tab === "context" ? "프리러닝 컨텍스트" : "변형문제 생성";
              const isActive = editTab === tab;
              return (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setEditTab(tab)}
                  style={{
                    padding: "10px 20px",
                    fontSize: 13,
                    fontWeight: isActive ? 600 : 400,
                    color: isActive ? "#0a0a0a" : "#737373",
                    backgroundColor: "transparent",
                    border: "none",
                    borderBottom: isActive
                      ? "2px solid #0a0a0a"
                      : "2px solid transparent",
                    cursor: "pointer",
                    transition: "all 0.1s",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {/* Tab: 프리러닝 컨텍스트 */}
          {editTab === "context" && editingSession && (
            <div
              className="flex-1 overflow-y-auto"
              style={{
                padding: 24,
                display: "flex",
                flexDirection: "column",
                gap: 20,
              }}
            >
              {/* 기본 정보 */}
              <div
                style={{ display: "flex", flexDirection: "column", gap: 12 }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#a3a3a3" }}
                  >
                    기본 정보
                  </span>
                  <button
                    type="button"
                    onClick={handleAutofillEdit}
                    disabled={isEditAutofilling}
                    className="flex items-center"
                    style={{
                      gap: 4,
                      padding: "3px 10px",
                      backgroundColor: isEditAutofilling
                        ? "#d4d4d4"
                        : "#8b5cf6",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 600,
                      border: "none",
                      cursor: isEditAutofilling ? "not-allowed" : "pointer",
                    }}
                  >
                    <Sparkles className="w-3 h-3" />
                    {isEditAutofilling ? "생성 중..." : "AI 자동 채우기"}
                  </button>
                </div>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  placeholder="세션 제목 (영상 제목에서 요약)"
                  className="w-full text-sm focus:outline-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#0a0a0a",
                    backgroundColor: "#ffffff",
                  }}
                />
                <input
                  type="text"
                  value={editSubtitle}
                  onChange={(e) => setEditSubtitle(e.target.value)}
                  placeholder="서브타이틀 (핵심 표현/패턴)"
                  className="w-full text-xs focus:outline-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                    backgroundColor: "#fafafa",
                  }}
                />
                <textarea
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  placeholder="세션 설명"
                  rows={2}
                  className="w-full text-sm focus:outline-none resize-none"
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #e5e5e5",
                    color: "#525252",
                    backgroundColor: "#ffffff",
                  }}
                />
                <div className="grid grid-cols-2" style={{ gap: 12 }}>
                  <label className="flex flex-col" style={{ gap: 4 }}>
                    <span className="text-xs" style={{ color: "#737373" }}>
                      콘텐츠 형식
                    </span>
                    <select
                      value={editSourceType}
                      onChange={(e) =>
                        setEditSourceType(e.target.value as SessionSourceType)
                      }
                      className="text-sm focus:outline-none"
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #e5e5e5",
                        color: "#525252",
                      }}
                    >
                      {SESSION_SOURCE_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {SOURCE_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex flex-col" style={{ gap: 4 }}>
                    <span className="text-xs" style={{ color: "#737373" }}>
                      난이도
                    </span>
                    <select
                      value={editDifficulty}
                      onChange={(e) =>
                        setEditDifficulty(
                          e.target.value as
                            | "beginner"
                            | "intermediate"
                            | "advanced",
                        )
                      }
                      className="text-sm focus:outline-none"
                      style={{
                        padding: "6px 8px",
                        border: "1px solid #e5e5e5",
                        color: "#525252",
                      }}
                    >
                      <option value="beginner">입문</option>
                      <option value="intermediate">중급</option>
                      <option value="advanced">고급</option>
                    </select>
                  </label>
                </div>
                <label
                  className="flex items-center justify-between text-sm"
                  style={{
                    border: "1px solid #e5e5e5",
                    padding: "8px 12px",
                    color: "#525252",
                  }}
                >
                  <span>프리미엄 브리프 잠금</span>
                  <input
                    type="checkbox"
                    checked={editPremiumRequired}
                    onChange={(e) => setEditPremiumRequired(e.target.checked)}
                  />
                </label>
              </div>

              {/* 프리러닝 컨텍스트 */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  padding: 16,
                  border: "1px solid #e5e5e5",
                  backgroundColor: "#fcfcfc",
                }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-bold uppercase tracking-wider"
                    style={{ color: "#737373" }}
                  >
                    프리러닝 컨텍스트
                  </span>
                  <button
                    type="button"
                    onClick={handleGenerateEditContext}
                    disabled={isEditGeneratingContext || !editTitle.trim()}
                    style={{
                      padding: "4px 12px",
                      border: "none",
                      backgroundColor:
                        isEditGeneratingContext || !editTitle.trim()
                          ? "#d4d4d4"
                          : "#2563eb",
                      color: "#ffffff",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor:
                        isEditGeneratingContext || !editTitle.trim()
                          ? "not-allowed"
                          : "pointer",
                    }}
                  >
                    {isEditGeneratingContext
                      ? "생성 중..."
                      : "AI 컨텍스트 생성"}
                  </button>
                </div>

                <label className="flex flex-col" style={{ gap: 6 }}>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#525252" }}
                  >
                    학습 기대 효과
                  </span>
                  <textarea
                    value={editContext.expected_takeaway}
                    onChange={(e) =>
                      setEditContext((prev) => ({
                        ...prev,
                        expected_takeaway: e.target.value,
                      }))
                    }
                    placeholder="학습 후 기대 효과를 적어주세요"
                    rows={3}
                    className="w-full text-sm focus:outline-none resize-none"
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e5e5",
                      color: "#525252",
                    }}
                  />
                </label>

                <label className="flex flex-col" style={{ gap: 6 }}>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#525252" }}
                  >
                    문법/수사 메모
                  </span>
                  <textarea
                    value={editContext.grammar_rhetoric_note}
                    onChange={(e) =>
                      setEditContext((prev) => ({
                        ...prev,
                        grammar_rhetoric_note: e.target.value,
                      }))
                    }
                    placeholder="문법/수사 메모"
                    rows={2}
                    className="w-full text-sm focus:outline-none resize-none"
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e5e5",
                      color: "#525252",
                    }}
                  />
                </label>

                <label className="flex flex-col" style={{ gap: 6 }}>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#525252" }}
                  >
                    재사용 가능한 상황
                  </span>
                  <textarea
                    value={arrayToMultiline(editContext.reusable_scenarios)}
                    onChange={(e) =>
                      setEditContext((prev) => ({
                        ...prev,
                        reusable_scenarios: multilineToArray(e.target.value),
                      }))
                    }
                    placeholder="한 줄에 하나씩 입력"
                    rows={4}
                    className="w-full text-sm focus:outline-none resize-none"
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e5e5",
                      color: "#525252",
                    }}
                  />
                </label>

                <label className="flex flex-col" style={{ gap: 6 }}>
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#525252" }}
                  >
                    핵심 표현
                  </span>
                  <textarea
                    value={vocabToMultiline(editContext.key_vocabulary)}
                    onChange={(e) =>
                      setEditContext((prev) => ({
                        ...prev,
                        key_vocabulary: multilineToVocab(e.target.value),
                      }))
                    }
                    placeholder="표현 — 예문 — 번역 (한 줄에 하나씩)"
                    rows={5}
                    className="w-full text-sm focus:outline-none resize-none"
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #e5e5e5",
                      color: "#525252",
                      fontFamily: "monospace",
                      fontSize: 12,
                    }}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Tab: 변형문제 생성 */}
          {editTab === "transformation" && editingSession && (
            <div className="flex-1 overflow-y-auto" style={{ padding: 0 }}>
              <TransformationExerciseEditor
                sessionId={editingSession.id}
                sentences={sentences.filter((s) =>
                  editingSession.sentence_ids.includes(s.id),
                )}
                onSaved={() => setIsEditSheetOpen(false)}
              />
            </div>
          )}

          {/* Footer */}
          {editTab === "context" && (
            <div
              className="shrink-0 flex items-center justify-end"
              style={{
                padding: "12px 24px",
                borderTop: "1px solid #e5e5e5",
                backgroundColor: "#fafafa",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={() => setIsEditSheetOpen(false)}
                style={{
                  padding: "6px 16px",
                  border: "1px solid #e5e5e5",
                  backgroundColor: "#ffffff",
                  color: "#525252",
                  fontSize: 13,
                  cursor: "pointer",
                }}
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleSaveEditSession}
                style={{
                  padding: "6px 16px",
                  border: "none",
                  backgroundColor: "#0a0a0a",
                  color: "#ffffff",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                저장
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <Sheet
        open={isSuggestionModalOpen}
        onOpenChange={setIsSuggestionModalOpen}
      >
        <SheetContent
          side="right"
          className="w-full max-w-[720px] gap-0 border-l border-[#e5e5e5] bg-white p-0 sm:max-w-[720px]"
        >
          <SheetHeader className="border-b border-[#e5e5e5] px-6 py-5">
            <SheetTitle className="flex items-center gap-2 text-[#0a0a0a]">
              <Sparkles className="h-4 w-4 text-purple-600" />
              AI 추천 장면
            </SheetTitle>
            <SheetDescription className="text-[#525252]">
              말하기 목적이 분명하고, 실무 세션으로 만들 가치가 높은 장면만
              골랐습니다.
            </SheetDescription>
          </SheetHeader>

          <div
            className="flex-1 overflow-y-auto"
            style={{
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            {suggestedScenes.length === 0 ? (
              <div
                className="text-sm"
                style={{
                  color: "#737373",
                  border: "1px dashed #d4d4d4",
                  padding: 16,
                }}
              >
                아직 추천 장면이 없습니다. 먼저 `AI 세션 장면 분석`을
                실행하세요.
              </div>
            ) : (
              suggestedScenes.map((scene, idx) => {
                const start = sentences[scene.startIndex]?.startTime ?? 0;
                const end = sentences[scene.endIndex]?.endTime ?? 0;

                return (
                  <div
                    key={`${scene.startIndex}-${scene.endIndex}-${idx}`}
                    style={{
                      border: "1px solid #ddd6fe",
                      backgroundColor: "#faf5ff",
                      padding: 16,
                      display: "flex",
                      flexDirection: "column",
                      gap: 12,
                    }}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: 6,
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="text-[10px] font-bold uppercase tracking-wider"
                            style={{ color: "#7c3aed" }}
                          >
                            Scene {idx + 1}
                          </span>
                          <span
                            className="text-[10px] font-mono"
                            style={{ color: "#737373" }}
                          >
                            {Math.floor(start / 60)}:
                            {String(Math.floor(start % 60)).padStart(2, "0")} -{" "}
                            {Math.floor(end / 60)}:
                            {String(Math.floor(end % 60)).padStart(2, "0")}
                          </span>
                        </div>
                        <h3
                          className="text-sm font-semibold"
                          style={{ color: "#0a0a0a" }}
                        >
                          {scene.title}
                        </h3>
                      </div>
                    </div>

                    <p
                      className="text-xs leading-5"
                      style={{ color: "#5b21b6" }}
                    >
                      {scene.reason}
                    </p>

                    <div className="flex flex-wrap gap-2">
                      {scene.learningPoints.map((point, pointIdx) => (
                        <span
                          key={`${scene.title}-${pointIdx}`}
                          style={{
                            border: "1px solid #e9d5ff",
                            backgroundColor: "#ffffff",
                            color: "#6d28d9",
                            fontSize: 11,
                            padding: "4px 8px",
                          }}
                        >
                          {point}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleUseSuggestion(scene)}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #7c3aed",
                          backgroundColor: "#ffffff",
                          color: "#6d28d9",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        세션 만들고 편집하기
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCreateSuggestion(scene)}
                        style={{
                          padding: "6px 10px",
                          border: "1px solid #6d28d9",
                          backgroundColor: "#6d28d9",
                          color: "#ffffff",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        바로 세션 만들기
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {suggestedScenes.length > 0 ? (
            <div
              className="shrink-0 flex items-center justify-between"
              style={{
                padding: 16,
                borderTop: "1px solid #e5e5e5",
                backgroundColor: "#fafafa",
              }}
            >
              <span className="text-xs" style={{ color: "#737373" }}>
                추천 장면을 하나씩 고르거나 한 번에 만들 수 있습니다.
              </span>
              <button
                type="button"
                onClick={handleUseAllSuggestions}
                className="flex items-center gap-2"
                style={{
                  padding: "8px 12px",
                  border: "none",
                  backgroundColor: "#6d28d9",
                  color: "#ffffff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Sparkles className="w-4 h-4" />
                추천 장면 모두 세션으로 만들기
              </button>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
