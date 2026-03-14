import { useState, useMemo, useEffect } from "react";
import type {
  Sentence,
  SceneRecommendation,
  LearningSession,
  SessionContext,
  SessionRoleRelevance,
  SessionSourceType,
  SessionSpeakingFunction,
} from "@shadowoo/shared";
import {
  SESSION_ROLE_RELEVANCE,
  SESSION_SOURCE_TYPES,
  SESSION_SPEAKING_FUNCTIONS,
} from "@shadowoo/shared";
import { Check, Plus, Trash2, Clock, Edit2, Sparkles } from "lucide-react";

const SOURCE_TYPE_LABELS: Record<SessionSourceType, string> = {
  keynote: "Keynote",
  demo: "Demo",
  "earnings-call": "Earnings Call",
  podcast: "Podcast",
  interview: "Interview",
  panel: "Panel",
};

const SPEAKING_FUNCTION_LABELS: Record<SessionSpeakingFunction, string> = {
  persuade: "Persuade",
  "explain-metric": "Explain Metric",
  summarize: "Summarize",
  hedge: "Hedge",
  disagree: "Disagree",
  propose: "Propose",
  "answer-question": "Answer Question",
};

const ROLE_LABELS: Record<SessionRoleRelevance, string> = {
  engineer: "Engineer",
  pm: "PM",
  designer: "Designer",
  founder: "Founder",
  marketer: "Marketer",
};

function createEmptyContext(): SessionContext {
  return {
    strategic_intent: "",
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

interface SessionCreatorProps {
  sentences: Sentence[];
  videoId: string;
  onSessionsChange: (sessions: LearningSession[]) => void;
  initialSessions?: LearningSession[];
  suggestedScenes?: SceneRecommendation[];
}

export function SessionCreator({
  sentences,
  videoId,
  onSessionsChange,
  initialSessions = [],
  suggestedScenes = [],
}: SessionCreatorProps) {
  // Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [lastClickedId, setLastClickedId] = useState<string | null>(null);

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [difficulty, setDifficulty] = useState<
    "beginner" | "intermediate" | "advanced"
  >("intermediate");
  const [sourceType, setSourceType] = useState<SessionSourceType>("podcast");
  const [speakingFunction, setSpeakingFunction] =
    useState<SessionSpeakingFunction>("summarize");
  const [roleRelevance, setRoleRelevance] = useState<SessionRoleRelevance[]>([
    "pm",
  ]);
  const [premiumRequired, setPremiumRequired] = useState(true);
  const [context, setContext] = useState<SessionContext>(createEmptyContext());
  const [isAutofilling, setIsAutofilling] = useState(false);
  const [isGeneratingContext, setIsGeneratingContext] = useState(false);

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

  const handleCreateSession = () => {
    if (!title.trim() || sortedSelectedSentences.length === 0) return;

    const newSession: LearningSession = {
      id: crypto.randomUUID(), // Temp ID
      source_video_id: videoId,
      title,
      description,
      start_time: sortedSelectedSentences[0].startTime,
      end_time:
        sortedSelectedSentences[sortedSelectedSentences.length - 1].endTime,
      duration: selectionDuration,
      sentence_ids: sortedSelectedSentences.map((s) => s.id),
      difficulty,
      order_index: createdSessions.length,
      source_type: sourceType,
      speaking_function: speakingFunction,
      role_relevance: roleRelevance,
      premium_required: premiumRequired,
      created_at: new Date().toISOString(),
      sentences: sortedSelectedSentences, // Store for preview
      context: {
        ...context,
        speaking_function: speakingFunction,
      },
    };

    setCreatedSessions([...createdSessions, newSession]);

    // Reset form
    setTitle("");
    setDescription("");
    setSourceType("podcast");
    setSpeakingFunction("summarize");
    setRoleRelevance(["pm"]);
    setPremiumRequired(true);
    setContext(createEmptyContext());
    setSelectedIds(new Set());
    setLastClickedId(null);
  };

  const handleDeleteSession = (sessionId: string) => {
    setCreatedSessions((prev) => prev.filter((s) => s.id !== sessionId));
  };

  const handleLoadSession = (session: LearningSession) => {
    // Load session back into form for editing (conceptually delete and re-create)
    setTitle(session.title);
    setDescription(session.description || "");
    setDifficulty(session.difficulty || "intermediate");
    setSourceType(session.source_type || "podcast");
    setSpeakingFunction(session.speaking_function || "summarize");
    setRoleRelevance(session.role_relevance || ["pm"]);
    setPremiumRequired(session.premium_required ?? true);
    setContext(session.context ?? createEmptyContext());
    setSelectedIds(new Set(session.sentence_ids));
    setCreatedSessions((prev) => prev.filter((s) => s.id !== session.id));
  };

  const handleUseSuggestion = (scene: SceneRecommendation) => {
    setTitle(scene.title);
    setDescription(scene.reason);
    // Select sentences from startIndex to endIndex
    const sceneIds = sentences
      .slice(scene.startIndex, scene.endIndex + 1)
      .map((s) => s.id);
    setSelectedIds(new Set(sceneIds));
  };

  const handleUseAllSuggestions = () => {
    // Auto-create sessions from all AI suggestions
    const newSessions = suggestedScenes.map((scene, idx) => {
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
        order_index: createdSessions.length + idx,
        source_type: "podcast" as const,
        speaking_function: "summarize" as const,
        role_relevance: ["pm"] as SessionRoleRelevance[],
        premium_required: true,
        created_at: new Date().toISOString(),
        sentences: sceneSentences,
        context: null,
      };
    });
    setCreatedSessions([...createdSessions, ...newSessions]);
  };

  const handleAutofill = async () => {
    if (sortedSelectedSentences.length === 0) return;

    setIsAutofilling(true);
    try {
      const response = await fetch("/api/admin/autofill-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ sentences: sortedSelectedSentences }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Autofill error details:", errorData);
        throw new Error(
          errorData.error || "Failed to autofill session details",
        );
      }

      const data = await response.json();
      setTitle(data.title);
      setDescription(data.description);
      setSourceType(data.sourceType || "podcast");
      setSpeakingFunction(data.speakingFunction || "summarize");
      setRoleRelevance(data.roleRelevance || ["pm"]);
      setPremiumRequired(Boolean(data.premiumRequired));
      setContext((prev) => ({
        ...prev,
        speaking_function: data.speakingFunction || "summarize",
      }));
    } catch (error) {
      console.error("Autofill error:", error);
      alert("AI 자동 완성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsAutofilling(false);
    }
  };

  const toggleRole = (role: SessionRoleRelevance) => {
    setRoleRelevance((prev) =>
      prev.includes(role)
        ? prev.filter((item) => item !== role)
        : [...prev, role],
    );
  };

  const handleGenerateContext = async () => {
    if (!title.trim() || sortedSelectedSentences.length === 0) return;

    setIsGeneratingContext(true);
    try {
      const response = await fetch("/api/admin/generate-session-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          title,
          description,
          speakingFunction,
          sentences: sortedSelectedSentences,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate context");
      }

      const data = (await response.json()) as SessionContext;
      setContext(data);
      if (data.speaking_function) {
        setSpeakingFunction(data.speaking_function);
      }
    } catch (error) {
      console.error("Context generation error:", error);
      alert("프리러닝 컨텍스트 생성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsGeneratingContext(false);
    }
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
        <span className="text-xs font-bold" style={{ color: "#0a0a0a" }}>
          Step 3: Create Sessions
        </span>
        <span className="text-xs" style={{ color: "#737373" }}>
          {createdSessions.length} sessions created
        </span>
      </div>

      {/* AI Suggestions Banner */}
      {suggestedScenes.length > 0 && (
        <div className="shrink-0" style={{ padding: "8px 12px 0 12px" }}>
          <div
            style={{
              backgroundColor: "#f5f3ff",
              border: "1px solid #ddd6fe",
              padding: 12,
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-5 h-5 text-purple-600" />
                  <h3 className="font-semibold text-purple-900">
                    AI Recommended Scenes
                  </h3>
                </div>
                <p className="text-sm text-purple-700 mb-3">
                  Based on analysis, these {suggestedScenes.length} scenes are
                  ideal for English learning practice.
                </p>
                <div className="space-y-2">
                  {suggestedScenes.map((scene, idx) => (
                    <div
                      key={idx}
                      className="bg-white/60 rounded-lg p-3 border border-purple-100"
                    >
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-medium text-sm text-purple-900">
                          {scene.title}
                        </h4>
                        <button
                          onClick={() => handleUseSuggestion(scene)}
                          className="text-xs bg-purple-600 hover:bg-purple-700 text-white px-2 py-1 rounded transition-colors"
                        >
                          Use This
                        </button>
                      </div>
                      <p className="text-xs text-purple-600 mb-2">
                        {scene.reason}
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {scene.learningPoints.map((point, pidx) => (
                          <span
                            key={pidx}
                            className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded"
                          >
                            {point}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={handleUseAllSuggestions}
                className="shrink-0 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 shadow-md"
              >
                <Sparkles className="w-4 h-4" />
                Create All 3
              </button>
            </div>
          </div>
        </div>
      )}

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
                    backgroundColor: isSelected ? "#fff7ed" : "transparent",
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
                        backgroundColor: isSelected ? "#b45000" : "transparent",
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
            <span
              className="text-[10px] font-mono font-medium"
              style={{ color: "#b45000" }}
            >
              {Math.floor(selectionDuration / 60)}:
              {String(Math.floor(selectionDuration % 60)).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Right: Form + Sessions List */}
        <div className="flex flex-col overflow-hidden" style={{ flex: 1 }}>
          {/* New Session Form */}
          <div
            className="shrink-0 flex flex-col"
            style={{
              padding: 12,
              borderBottom: "1px solid #e5e5e5",
              gap: 8,
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: "#0a0a0a" }}>
                New Session
              </span>
              <button
                onClick={handleAutofill}
                disabled={isAutofilling || selectedIds.size === 0}
                className="flex items-center transition-colors"
                style={{
                  gap: 4,
                  padding: "2px 8px",
                  backgroundColor:
                    isAutofilling || selectedIds.size === 0
                      ? "#d4d4d4"
                      : "#8b5cf6",
                  color: "#ffffff",
                  fontSize: 10,
                  border: "none",
                  cursor:
                    isAutofilling || selectedIds.size === 0
                      ? "not-allowed"
                      : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (!isAutofilling && selectedIds.size > 0)
                    e.currentTarget.style.backgroundColor = "#7c3aed";
                }}
                onMouseLeave={(e) => {
                  if (!isAutofilling && selectedIds.size > 0)
                    e.currentTarget.style.backgroundColor = "#8b5cf6";
                }}
              >
                <Sparkles className="w-3 h-3" />
                {isAutofilling ? "..." : "AI Autofill"}
              </button>
            </div>

            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Session title"
              className="w-full text-sm focus:outline-none"
              style={{
                padding: "6px 8px",
                border: "1px solid #e5e5e5",
                color: "#0a0a0a",
              }}
            />
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Description (optional)"
              rows={3}
              className="w-full text-xs focus:outline-none resize-none"
              style={{
                padding: "6px 8px",
                border: "1px solid #e5e5e5",
                color: "#525252",
              }}
            />

            <div className="grid grid-cols-2" style={{ gap: 8 }}>
              <select
                value={sourceType}
                onChange={(e) =>
                  setSourceType(e.target.value as SessionSourceType)
                }
                className="text-xs focus:outline-none"
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
              <select
                value={speakingFunction}
                onChange={(e) => {
                  const next = e.target.value as SessionSpeakingFunction;
                  setSpeakingFunction(next);
                  setContext((prev) => ({
                    ...prev,
                    speaking_function: next,
                  }));
                }}
                className="text-xs focus:outline-none"
                style={{
                  padding: "6px 8px",
                  border: "1px solid #e5e5e5",
                  color: "#525252",
                }}
              >
                {SESSION_SPEAKING_FUNCTIONS.map((value) => (
                  <option key={value} value={value}>
                    {SPEAKING_FUNCTION_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gap: 6, display: "flex", flexDirection: "column" }}>
              <span
                className="text-[10px] font-bold uppercase tracking-wider"
                style={{ color: "#737373" }}
              >
                Role Relevance
              </span>
              <div className="flex flex-wrap" style={{ gap: 6 }}>
                {SESSION_ROLE_RELEVANCE.map((role) => {
                  const selected = roleRelevance.includes(role);
                  return (
                    <button
                      key={role}
                      type="button"
                      onClick={() => toggleRole(role)}
                      style={{
                        padding: "4px 8px",
                        border: `1px solid ${selected ? "#0a0a0a" : "#e5e5e5"}`,
                        backgroundColor: selected ? "#0a0a0a" : "#ffffff",
                        color: selected ? "#ffffff" : "#525252",
                        fontSize: 10,
                        cursor: "pointer",
                      }}
                    >
                      {ROLE_LABELS[role]}
                    </button>
                  );
                })}
              </div>
            </div>

            <label
              className="flex items-center justify-between text-xs"
              style={{
                border: "1px solid #e5e5e5",
                padding: "6px 8px",
                color: "#525252",
              }}
            >
              <span>Premium context required</span>
              <input
                type="checkbox"
                checked={premiumRequired}
                onChange={(e) => setPremiumRequired(e.target.checked)}
              />
            </label>

            <div
              className="flex flex-col"
              style={{
                padding: 10,
                border: "1px solid #e5e5e5",
                backgroundColor: "#fcfcfc",
                gap: 8,
              }}
            >
              <div className="flex items-center justify-between">
                <span
                  className="text-[10px] font-bold uppercase tracking-wider"
                  style={{ color: "#737373" }}
                >
                  Professional Context
                </span>
                <button
                  type="button"
                  onClick={handleGenerateContext}
                  disabled={
                    isGeneratingContext ||
                    sortedSelectedSentences.length === 0 ||
                    !title.trim()
                  }
                  style={{
                    padding: "3px 8px",
                    border: "none",
                    backgroundColor:
                      isGeneratingContext ||
                      sortedSelectedSentences.length === 0 ||
                      !title.trim()
                        ? "#d4d4d4"
                        : "#2563eb",
                    color: "#ffffff",
                    fontSize: 10,
                    cursor:
                      isGeneratingContext ||
                      sortedSelectedSentences.length === 0 ||
                      !title.trim()
                        ? "not-allowed"
                        : "pointer",
                  }}
                >
                  {isGeneratingContext ? "..." : "Generate Context"}
                </button>
              </div>

              <textarea
                value={context.strategic_intent}
                onChange={(e) =>
                  setContext((prev) => ({
                    ...prev,
                    strategic_intent: e.target.value,
                  }))
                }
                placeholder="Strategic intent"
                rows={2}
                className="w-full text-xs focus:outline-none resize-none"
                style={{
                  padding: "6px 8px",
                  border: "1px solid #e5e5e5",
                  color: "#525252",
                }}
              />

              <textarea
                value={context.expected_takeaway}
                onChange={(e) =>
                  setContext((prev) => ({
                    ...prev,
                    expected_takeaway: e.target.value,
                  }))
                }
                placeholder="Expected takeaway"
                rows={2}
                className="w-full text-xs focus:outline-none resize-none"
                style={{
                  padding: "6px 8px",
                  border: "1px solid #e5e5e5",
                  color: "#525252",
                }}
              />

              <textarea
                value={context.grammar_rhetoric_note}
                onChange={(e) =>
                  setContext((prev) => ({
                    ...prev,
                    grammar_rhetoric_note: e.target.value,
                  }))
                }
                placeholder="Grammar / rhetoric note"
                rows={2}
                className="w-full text-xs focus:outline-none resize-none"
                style={{
                  padding: "6px 8px",
                  border: "1px solid #e5e5e5",
                  color: "#525252",
                }}
              />

              <textarea
                value={arrayToMultiline(context.reusable_scenarios)}
                onChange={(e) =>
                  setContext((prev) => ({
                    ...prev,
                    reusable_scenarios: multilineToArray(e.target.value),
                  }))
                }
                placeholder="Reusable scenarios (one per line)"
                rows={3}
                className="w-full text-xs focus:outline-none resize-none"
                style={{
                  padding: "6px 8px",
                  border: "1px solid #e5e5e5",
                  color: "#525252",
                }}
              />

              <textarea
                value={arrayToMultiline(context.key_vocabulary)}
                onChange={(e) =>
                  setContext((prev) => ({
                    ...prev,
                    key_vocabulary: multilineToArray(e.target.value),
                  }))
                }
                placeholder="Key vocabulary (one per line)"
                rows={3}
                className="w-full text-xs focus:outline-none resize-none"
                style={{
                  padding: "6px 8px",
                  border: "1px solid #e5e5e5",
                  color: "#525252",
                }}
              />
            </div>

            <div className="flex items-center" style={{ gap: 8 }}>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(
                    e.target.value as "beginner" | "intermediate" | "advanced",
                  )
                }
                className="text-xs focus:outline-none"
                style={{
                  padding: "3px 6px",
                  border: "1px solid #e5e5e5",
                  color: "#525252",
                  flex: 1,
                }}
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
              <span
                className="text-[10px] font-mono"
                style={{ color: "#a3a3a3" }}
              >
                <Clock className="w-3 h-3 inline mr-1" />
                {Math.floor(selectionDuration / 60)}:
                {String(Math.floor(selectionDuration % 60)).padStart(2, "0")}
              </span>
              <button
                onClick={handleCreateSession}
                disabled={!title || selectedIds.size === 0}
                className="flex items-center transition-colors"
                style={{
                  gap: 4,
                  padding: "3px 12px",
                  backgroundColor:
                    !title || selectedIds.size === 0 ? "#d4d4d4" : "#0a0a0a",
                  color: "#ffffff",
                  fontSize: 11,
                  fontWeight: 500,
                  border: "none",
                  cursor:
                    !title || selectedIds.size === 0
                      ? "not-allowed"
                      : "pointer",
                }}
                onMouseEnter={(e) => {
                  if (title && selectedIds.size > 0)
                    e.currentTarget.style.backgroundColor = "#404040";
                }}
                onMouseLeave={(e) => {
                  if (title && selectedIds.size > 0)
                    e.currentTarget.style.backgroundColor = "#0a0a0a";
                }}
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
          </div>

          {/* Created Sessions List */}
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
                      onClick={() => handleLoadSession(session)}
                      style={{ padding: 2, color: "#a3a3a3" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#b45000";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#a3a3a3";
                      }}
                    >
                      <Edit2 className="w-3 h-3" />
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
    </div>
  );
}
