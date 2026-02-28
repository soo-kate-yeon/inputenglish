"use client";

import { useState, useRef, useEffect } from "react";
import { X } from "lucide-react";
import type { Sentence } from "@shadowoo/shared";
import { CommentPopover } from "./CommentPopover";
import LoopToggle from "./LoopToggle";
import SaveToggle from "./SaveToggle";
import { useStore } from "@/lib/store";

export interface Highlight {
  id: string;
  text: string;
  comment: string;
}

interface ScriptLineProps {
  sentence: Sentence;
  index: number;
  videoId: string;
  isActive: boolean;
  isLooping: boolean;
  highlights: Highlight[];
  onAddHighlight: (sentenceId: string, text: string, comment: string) => void;
  onSeek: (startTime: number) => void;
  onLoopToggle: (sentenceId: string, isLooping: boolean) => void;
  onRemoveHighlight?: (id: string) => void;
}

export function ScriptLine({
  sentence,
  index,
  videoId,
  isActive,
  isLooping,
  highlights,
  onAddHighlight,
  onSeek,
  onLoopToggle,
  onRemoveHighlight,
}: ScriptLineProps) {
  const [selection, setSelection] = useState<{ text: string } | null>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // Store actions for saved sentences
  const savedSentences = useStore((state) => state.savedSentences);
  const addSavedSentence = useStore((state) => state.addSavedSentence);
  const removeSavedSentence = useStore((state) => state.removeSavedSentence);

  // Check if this sentence is saved
  const isSaved = savedSentences.some((s) => s.sentenceId === sentence.id);

  // Close popover when active state changes
  useEffect(() => {
    if (!isActive) {
      setSelection(null);
    }
  }, [isActive]);

  const handleMouseUp = () => {
    const sel = window.getSelection();
    const text = sel?.toString().trim();

    if (text && text.length > 0) {
      if (
        activeRef.current &&
        sel?.anchorNode &&
        activeRef.current.contains(sel.anchorNode)
      ) {
        setSelection({ text });
      }
    }
  };

  const handleCommentSubmit = (comment: string) => {
    if (selection) {
      onAddHighlight(sentence.id, selection.text, comment);
      setSelection(null);
      window.getSelection()?.removeAllRanges();
    }
  };

  const handleSaveToggle = (sentenceId: string, shouldSave: boolean) => {
    if (shouldSave) {
      addSavedSentence({
        id: crypto.randomUUID(),
        videoId: videoId,
        sentenceId: sentence.id,
        sentenceText: sentence.text,
        startTime: sentence.startTime,
        endTime: sentence.endTime,
        createdAt: Date.now(),
      });
    } else {
      const savedSentence = savedSentences.find(
        (s) => s.sentenceId === sentenceId,
      );
      if (savedSentence) {
        removeSavedSentence(savedSentence.id);
      }
    }
  };

  // Helper to render text with highlights
  const renderTextWithHighlights = (originalText: string) => {
    if (highlights.length === 0) return originalText;

    let parts = [originalText];

    highlights.forEach((h) => {
      const newParts: any[] = [];
      parts.forEach((part) => {
        if (typeof part === "string" && part.includes(h.text)) {
          const split = part.split(h.text);
          for (let i = 0; i < split.length; i++) {
            newParts.push(split[i]);
            if (i < split.length - 1) {
              newParts.push(
                <span
                  key={`${h.id}-${i}`}
                  className="transition-colors"
                  style={{
                    backgroundColor: "#ffe3c3",
                    borderRadius: 2,
                    padding: "0 2px",
                  }}
                >
                  {h.text}
                </span>,
              );
            }
          }
        } else {
          newParts.push(part);
        }
      });
      parts = newParts;
    });

    return <>{parts}</>;
  };

  return (
    <div ref={activeRef} className="relative">
      {/* Script Line */}
      <div className="relative group">
        <div className="flex items-start" style={{ gap: 12 }}>
          <span
            className="font-mono shrink-0 transition-colors"
            style={{
              fontSize: 12,
              lineHeight: 1.7,
              width: 24,
              marginTop: 4,
              color: isActive ? "#743100" : "#908f8c",
              fontWeight: isActive ? 700 : 500,
            }}
          >
            {index + 1}
          </span>
          <div className="flex-1 min-w-0">
            <p
              onMouseUp={handleMouseUp}
              onClick={() => {
                if (!selection) {
                  onSeek(sentence.startTime);
                }
              }}
              className="cursor-pointer transition-colors select-text"
              style={{
                fontSize: 16,
                lineHeight: 1.64,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? "#0c0b09" : "#72716e",
              }}
              onMouseEnter={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#565552";
                }
              }}
              onMouseLeave={(e) => {
                if (!isActive) {
                  e.currentTarget.style.color = "#72716e";
                }
              }}
            >
              {selection ? (
                <>
                  {sentence.text.split(selection.text).map((part, i, arr) => (
                    <span key={i}>
                      {part}
                      {i < arr.length - 1 && (
                        <span
                          style={{
                            backgroundColor: "#ffe3c3",
                            borderRadius: 2,
                            padding: "0 2px",
                          }}
                        >
                          {selection.text}
                        </span>
                      )}
                    </span>
                  ))}
                </>
              ) : (
                renderTextWithHighlights(sentence.text)
              )}
            </p>

            {/* Inline Comments */}
            {highlights.length > 0 && (
              <div
                className="flex flex-col"
                style={{
                  marginTop: 8,
                  gap: 6,
                }}
              >
                {highlights.map((highlight) => (
                  <div
                    key={highlight.id}
                    className="group/comment flex items-start"
                    style={{
                      gap: 8,
                      paddingLeft: 12,
                      borderLeft: "2px solid #ffc6a9",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          color: "#b45000",
                        }}
                      >
                        {highlight.text}
                      </span>
                      <span
                        style={{
                          fontSize: 14,
                          color: "#908f8c",
                          marginLeft: 8,
                        }}
                      >
                        {highlight.comment}
                      </span>
                    </div>
                    {onRemoveHighlight && (
                      <button
                        onClick={() => onRemoveHighlight(highlight.id)}
                        className="shrink-0 opacity-0 group-hover/comment:opacity-100 transition-opacity"
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 4,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: "#908f8c",
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.color = "#cf1e29")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color = "#908f8c")
                        }
                        title="삭제"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Comment Popover for new selections */}
            {selection && (
              <CommentPopover
                onSubmit={handleCommentSubmit}
                onClose={() => setSelection(null)}
              />
            )}
          </div>
          <div
            className={`flex transition-opacity ${isLooping || isSaved ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
            style={{ gap: 8, marginTop: 2 }}
          >
            <LoopToggle
              sentenceId={sentence.id}
              isLooping={isLooping}
              onToggle={onLoopToggle}
            />
            <SaveToggle
              sentenceId={sentence.id}
              isSaved={isSaved}
              onToggle={handleSaveToggle}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
