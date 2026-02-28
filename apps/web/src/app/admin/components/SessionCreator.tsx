import { useState, useMemo, useEffect } from "react";
import type { Sentence, SceneRecommendation, LearningSession } from "@shadowoo/shared";
import {
  Check,
  X,
  GripVertical,
  Plus,
  Trash2,
  Clock,
  Edit2,
  Sparkles,
} from "lucide-react";

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
  const [isAutofilling, setIsAutofilling] = useState(false);

  // List State
  const [createdSessions, setCreatedSessions] =
    useState<LearningSession[]>(initialSessions);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);

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
      created_at: new Date().toISOString(),
      sentences: sortedSelectedSentences, // Store for preview
    };

    setCreatedSessions([...createdSessions, newSession]);

    // Reset form
    setTitle("");
    setDescription("");
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
        created_at: new Date().toISOString(),
        sentences: sceneSentences,
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
    } catch (error) {
      console.error("Autofill error:", error);
      alert("AI 자동 완성에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsAutofilling(false);
    }
  };

  return (
    <div
      className="flex flex-col h-full rounded-2xl overflow-hidden"
      style={{
        backgroundColor: "#f0efeb",
        border: "1px solid #f0efeb",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
        padding: 24,
        gap: 24,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <span className="flex items-center justify-center w-4 h-4 rounded-full bg-primary-100 text-primary-700 text-xs">
            3
          </span>
          Create Learning Sessions
        </h2>
        <div className="text-sm text-secondary-500">
          {createdSessions.length} sessions created
        </div>
      </div>

      {/* AI Suggestions Banner */}
      {suggestedScenes.length > 0 && (
        <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 rounded-xl p-4">
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
      )}

      <div className="flex gap-6 h-full min-h-0">
        {/* Left: Sentence Selector */}
        <div
          className="w-1/2 flex flex-col rounded-xl overflow-hidden"
          style={{
            backgroundColor: "#ffffff",
            border: "1px solid #f0efeb",
            boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
            gap: 8,
          }}
        >
          <div className="p-3 border-b border-secondary-100 bg-secondary-50 flex justify-between items-center">
            <span className="font-medium text-sm">
              Transcript ({sentences.length})
            </span>
            <span className="text-xs text-secondary-400">
              Shift+Click to select range
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1 select-none">
            {sentences.map((s, i) => {
              const isSelected = selectedIds.has(s.id);
              return (
                <div
                  key={s.id}
                  onClick={(e) => handleSentenceClick(s.id, e)}
                  className={`
                                        group flex flex-col p-3 rounded-lg text-sm cursor-pointer transition-all border relative
                                        ${
                                          isSelected
                                            ? "bg-primary-50 border-primary-200 shadow-sm z-10"
                                            : "hover:bg-secondary-50 border-transparent hover:border-secondary-200"
                                        }
                                    `}
                  style={{ gap: 6 }}
                >
                  <div className="flex items-center justify-between">
                    <div className="text-xs font-mono text-secondary-400">
                      {Math.floor(s.startTime / 60)}:
                      {String(Math.floor(s.startTime % 60)).padStart(2, "0")}
                    </div>
                    {isSelected && (
                      <Check className="w-4 h-4 text-primary-500 shrink-0" />
                    )}
                  </div>
                  <div
                    className={`${isSelected ? "text-secondary-900 font-medium" : "text-secondary-600"}`}
                  >
                    {s.text}
                  </div>
                </div>
              );
            })}
          </div>
          {/* Selection Summary Footer */}
          <div className="p-3 border-t border-secondary-100 bg-secondary-50 flex justify-between items-center text-sm">
            <span className="text-secondary-600">
              {selectedIds.size} sentences selected
            </span>
            <span className="font-mono font-medium text-primary-700">
              Duration: {Math.floor(selectionDuration / 60)}:
              {String(Math.floor(selectionDuration % 60)).padStart(2, "0")}
            </span>
          </div>
        </div>

        {/* Right: Creator Form & List */}
        <div className="w-1/2 flex flex-col gap-6">
          {/* Creator Form */}
          <div
            className="rounded-xl flex flex-col"
            style={{
              backgroundColor: "#ffffff",
              padding: 20,
              border: "1px solid #f0efeb",
              boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
              gap: 16,
            }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-secondary-900">
                New Session Details
              </h3>
              <button
                onClick={handleAutofill}
                disabled={isAutofilling || selectedIds.size === 0}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-medium rounded-lg transition-all shadow-sm"
                title="AI가 선택한 문장을 분석해 제목과 설명을 자동 생성합니다"
              >
                <Sparkles className="w-3.5 h-3.5" />
                {isAutofilling ? "Generating..." : "AI Autofill"}
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-secondary-500 mb-1">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Introduction to Shadowing"
                  className="w-full px-3 py-2 rounded-lg border border-secondary-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-secondary-500 mb-1">
                  Description (Optional)
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="What will users learn in this session?"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-secondary-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm resize-none"
                />
              </div>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="block text-xs font-medium text-secondary-500 mb-1">
                    Difficulty
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-lg border border-secondary-200 focus:outline-none focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 transition-all text-sm"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="block text-xs font-medium text-secondary-500 mb-1">
                    Duration
                  </label>
                  <div className="px-3 py-2 rounded-lg bg-secondary-50 border border-secondary-200 text-secondary-500 text-sm font-mono flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    {Math.floor(selectionDuration / 60)}:
                    {String(Math.floor(selectionDuration % 60)).padStart(
                      2,
                      "0",
                    )}
                  </div>
                </div>
              </div>
            </div>

            <button
              onClick={handleCreateSession}
              disabled={!title || selectedIds.size === 0}
              className={`
                                w-full py-2.5 rounded-lg flex items-center justify-center gap-2 font-medium transition-all
                                ${
                                  !title || selectedIds.size === 0
                                    ? "bg-secondary-100 text-secondary-400 cursor-not-allowed"
                                    : "bg-black text-white hover:bg-neutral-800 shadow-md hover:shadow-lg active:scale-[0.99]"
                                }
                            `}
            >
              <Plus className="w-4 h-4" />
              Add Session
            </button>
          </div>

          {/* Created Sessions List */}
          <div className="flex-1 flex flex-col gap-3 overflow-y-auto">
            <label className="text-xs font-bold text-secondary-400 uppercase tracking-wider">
              Created Sessions ({createdSessions.length})
            </label>
            {createdSessions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-secondary-400 border-2 border-dashed border-secondary-200 rounded-xl">
                <p className="text-sm">No sessions created yet</p>
              </div>
            ) : (
              createdSessions.map((session, idx) => (
                <div
                  key={session.id}
                  className="rounded-xl flex group transition-colors"
                  style={{
                    backgroundColor: "#ffffff",
                    padding: 16,
                    border: "1px solid #f0efeb",
                    boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
                    gap: 16,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = "#ffc6a9";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#f0efeb";
                  }}
                >
                  <div className="flex flex-col items-center justify-center gap-1 text-secondary-300">
                    <span className="text-xs font-mono">#{idx + 1}</span>
                    <GripVertical className="w-4 h-4 cursor-move opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <h4 className="font-semibold text-secondary-900 truncate">
                        {session.title}
                      </h4>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleLoadSession(session)}
                          className="p-1.5 text-secondary-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteSession(session.id)}
                          className="p-1.5 text-secondary-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-xs text-secondary-500 line-clamp-1 mb-2">
                      {session.description || "No description"}
                    </p>
                    <div className="flex items-center gap-3 text-xs text-secondary-400">
                      <span className="flex items-center gap-1 bg-secondary-50 px-1.5 py-0.5 rounded text-secondary-600">
                        <Clock className="w-3 h-3" />
                        {Math.floor(session.duration / 60)}:
                        {String(Math.floor(session.duration % 60)).padStart(
                          2,
                          "0",
                        )}
                      </span>
                      <span>{session.sentence_ids.length} sentences</span>
                      <span className="capitalize">{session.difficulty}</span>
                    </div>
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
