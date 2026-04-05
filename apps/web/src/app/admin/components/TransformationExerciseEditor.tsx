"use client";
// @MX:NOTE: [AUTO] Admin editor for reviewing and saving AI-generated transformation exercises (SPEC-MOBILE-011).
import React, { useState } from "react";
import type {
  Sentence,
  TransformationExercise,
  DialogLine,
} from "@inputenglish/shared";

interface TransformationSet {
  target_pattern: string;
  pattern_type: string;
}

interface TransformationExerciseEditorProps {
  sessionId: string;
  sentences: Sentence[];
  onSaved?: (setId: string) => void;
}

function ExerciseAccordion({
  exercise,
  index,
  onChange,
}: {
  exercise: Partial<TransformationExercise>;
  index: number;
  onChange: (updated: Partial<TransformationExercise>) => void;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div
      style={{
        border: "1px solid #e5e5e5",
        marginBottom: 8,
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          background: "#fafafa",
          border: "none",
          cursor: "pointer",
          fontSize: 12,
          fontWeight: 600,
          color: "#171717",
        }}
      >
        <span>
          Page {exercise.page_order} — {exercise.exercise_type}
        </span>
        <span>{open ? "▲" : "▼"}</span>
      </button>

      {open && (
        <div
          style={{
            padding: 12,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {/* instruction_text */}
          <label
            style={{
              fontSize: 11,
              color: "#525252",
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            Instruction
            <input
              type="text"
              value={exercise.instruction_text ?? ""}
              onChange={(e) =>
                onChange({ ...exercise, instruction_text: e.target.value })
              }
              style={{
                padding: "4px 8px",
                border: "1px solid #e5e5e5",
                fontSize: 12,
              }}
            />
          </label>

          {/* source_korean (kr-to-en) */}
          {exercise.exercise_type === "kr-to-en" && (
            <label
              style={{
                fontSize: 11,
                color: "#525252",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              Korean Source
              <textarea
                value={exercise.source_korean ?? ""}
                onChange={(e) =>
                  onChange({ ...exercise, source_korean: e.target.value })
                }
                rows={2}
                style={{
                  padding: "4px 8px",
                  border: "1px solid #e5e5e5",
                  fontSize: 12,
                  resize: "vertical",
                }}
              />
            </label>
          )}

          {/* question_text (qa-response) */}
          {exercise.exercise_type === "qa-response" && (
            <label
              style={{
                fontSize: 11,
                color: "#525252",
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              Question
              <input
                type="text"
                value={exercise.question_text ?? ""}
                onChange={(e) =>
                  onChange({ ...exercise, question_text: e.target.value })
                }
                style={{
                  padding: "4px 8px",
                  border: "1px solid #e5e5e5",
                  fontSize: 12,
                }}
              />
            </label>
          )}

          {/* dialog_lines (dialog-completion) */}
          {exercise.exercise_type === "dialog-completion" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span style={{ fontSize: 11, color: "#525252", fontWeight: 600 }}>
                Dialog Lines
              </span>
              {(exercise.dialog_lines ?? []).map((line, lineIdx) => (
                <div
                  key={lineIdx}
                  style={{
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                    padding: "4px 8px",
                    background: line.is_blank ? "#fef9c3" : "#f9fafb",
                    border: "1px solid #e5e5e5",
                  }}
                >
                  <input
                    type="text"
                    value={line.speaker}
                    placeholder="Speaker"
                    onChange={(e) => {
                      const updated = [...(exercise.dialog_lines ?? [])];
                      updated[lineIdx] = {
                        ...updated[lineIdx],
                        speaker: e.target.value,
                      };
                      onChange({ ...exercise, dialog_lines: updated });
                    }}
                    style={{
                      width: 80,
                      padding: "2px 4px",
                      fontSize: 11,
                      border: "1px solid #e5e5e5",
                    }}
                  />
                  <input
                    type="text"
                    value={line.text}
                    placeholder="Text"
                    onChange={(e) => {
                      const updated = [...(exercise.dialog_lines ?? [])];
                      updated[lineIdx] = {
                        ...updated[lineIdx],
                        text: e.target.value,
                      };
                      onChange({ ...exercise, dialog_lines: updated });
                    }}
                    style={{
                      flex: 1,
                      padding: "2px 4px",
                      fontSize: 11,
                      border: "1px solid #e5e5e5",
                    }}
                  />
                  <label
                    style={{
                      fontSize: 10,
                      color: "#525252",
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    Blank
                    <input
                      type="checkbox"
                      checked={line.is_blank}
                      onChange={(e) => {
                        const updated = [...(exercise.dialog_lines ?? [])];
                        updated[lineIdx] = {
                          ...updated[lineIdx],
                          is_blank: e.target.checked,
                        };
                        onChange({ ...exercise, dialog_lines: updated });
                      }}
                    />
                  </label>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function TransformationExerciseEditor({
  sessionId,
  sentences,
  onSaved,
}: TransformationExerciseEditorProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [generatedSet, setGeneratedSet] = useState<TransformationSet | null>(
    null,
  );
  const [exercises, setExercises] = useState<Partial<TransformationExercise>[]>(
    [],
  );
  const [error, setError] = useState<string | null>(null);
  const [savedMessage, setSavedMessage] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setError(null);
    setSavedMessage(null);

    try {
      const response = await fetch("/api/admin/generate-transformation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, sentences }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Generation failed");
      }

      const data = (await response.json()) as {
        set: TransformationSet;
        exercises: Partial<TransformationExercise>[];
      };
      setGeneratedSet(data.set);
      setExercises(data.exercises);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!generatedSet || exercises.length === 0) return;
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/admin/save-transformation-set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, set: generatedSet, exercises }),
      });

      if (!response.ok) {
        const body = (await response.json()) as { error?: string };
        throw new Error(body.error ?? "Save failed");
      }

      const data = (await response.json()) as { setId: string };
      setSavedMessage(`저장 완료 (ID: ${data.setId})`);
      onSaved?.(data.setId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "8px 12px",
          borderBottom: "1px solid #e5e5e5",
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 700, color: "#171717" }}>
          변형 연습 생성
        </span>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={isGenerating || sentences.length === 0}
          style={{
            padding: "6px 14px",
            fontSize: 11,
            fontWeight: 600,
            border: "none",
            backgroundColor: isGenerating ? "#d4d4d4" : "#171717",
            color: "#ffffff",
            cursor: isGenerating ? "not-allowed" : "pointer",
          }}
        >
          {isGenerating ? "AI 생성 중..." : "AI로 생성"}
        </button>
      </div>

      {error && (
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#dc2626",
            fontSize: 12,
          }}
        >
          {error}
        </div>
      )}

      {savedMessage && (
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#f0fdf4",
            border: "1px solid #bbf7d0",
            color: "#16a34a",
            fontSize: 12,
          }}
        >
          {savedMessage}
        </div>
      )}

      {/* Generated set metadata */}
      {generatedSet && (
        <div
          style={{
            padding: "8px 12px",
            backgroundColor: "#f9fafb",
            border: "1px solid #e5e5e5",
            fontSize: 11,
            color: "#525252",
          }}
        >
          <strong>Pattern:</strong> {generatedSet.target_pattern}{" "}
          <span style={{ color: "#737373" }}>
            ({generatedSet.pattern_type})
          </span>
        </div>
      )}

      {/* Exercise accordions */}
      {exercises.length > 0 && (
        <div style={{ padding: "0 12px" }}>
          {exercises.map((ex, i) => (
            <ExerciseAccordion
              key={i}
              exercise={ex}
              index={i}
              onChange={(updated) => {
                const copy = [...exercises];
                copy[i] = updated;
                setExercises(copy);
              }}
            />
          ))}
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            style={{
              marginTop: 12,
              width: "100%",
              padding: "8px 0",
              fontSize: 12,
              fontWeight: 600,
              border: "1px solid #171717",
              backgroundColor: isSaving ? "#f5f5f5" : "#171717",
              color: isSaving ? "#525252" : "#ffffff",
              cursor: isSaving ? "not-allowed" : "pointer",
            }}
          >
            {isSaving ? "저장 중..." : "저장하기"}
          </button>
        </div>
      )}
    </div>
  );
}
