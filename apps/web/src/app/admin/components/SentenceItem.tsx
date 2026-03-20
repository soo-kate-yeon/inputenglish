import type { Sentence } from "@inputenglish/shared";
import { useEffect, useRef } from "react";

interface SentenceItemProps {
  sentence: Sentence;
  index: number;
  onUpdateTime: (
    id: string,
    field: "startTime" | "endTime",
    value: number,
  ) => void;
  onUpdateText: (
    id: string,
    field: "text" | "translation",
    value: string,
  ) => void;
  onDelete: (index: number) => void;
  onSplit: (index: number, cursorPosition: number) => void;
  onMergeWithPrevious: (index: number) => void;
  onPlayFrom: (time: number) => void;
}

export function SentenceItem({
  sentence,
  index,
  onUpdateTime,
  onUpdateText,
  onDelete,
  onSplit,
  onMergeWithPrevious,
  onPlayFrom,
}: SentenceItemProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-resize textarea on mount and when text changes
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height =
        textareaRef.current.scrollHeight + "px";
    }
  }, [sentence.text]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "]") {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      onSplit(index, target.selectionStart);
    } else if (e.key === "[") {
      e.preventDefault();
      onMergeWithPrevious(index);
    }
  };

  const handlePlayClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onPlayFrom(sentence.startTime);
  };

  return (
    <div
      className="group cursor-pointer transition-all"
      style={{
        backgroundColor: "#ffffff",
        padding: "8px 12px",
        borderBottom: "1px solid #f0f0f0",
      }}
      onClick={handlePlayClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#fafafa";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "#ffffff";
      }}
    >
      <div className="flex items-start" style={{ gap: 8 }}>
        {/* Index + Time column */}
        <div
          className="shrink-0 flex flex-col items-end"
          style={{ width: 48, paddingTop: 2 }}
        >
          <span className="text-xs font-mono" style={{ color: "#a3a3a3" }}>
            #{index + 1}
          </span>
          <span className="text-[10px] font-mono" style={{ color: "#b45000" }}>
            {sentence.startTime.toFixed(1)}s
          </span>
        </div>

        {/* Content */}
        <div
          className="flex-1 min-w-0"
          style={{ gap: 4, display: "flex", flexDirection: "column" }}
        >
          <textarea
            ref={textareaRef}
            value={sentence.text}
            onChange={(e) => onUpdateText(sentence.id, "text", e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full bg-transparent text-sm font-medium focus:outline-none resize-none overflow-hidden"
            style={{
              color: "#0a0a0a",
              borderBottom: "1px solid transparent",
              paddingBottom: 2,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderBottomColor = "#e5e5e5";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderBottomColor = "transparent";
            }}
            placeholder="] to split, [ to merge"
          />
          <input
            value={sentence.translation || ""}
            onChange={(e) =>
              onUpdateText(sentence.id, "translation", e.target.value)
            }
            className="w-full bg-transparent text-xs focus:outline-none"
            style={{
              color: "#737373",
              borderBottom: "1px solid transparent",
              paddingBottom: 2,
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderBottomColor = "#e5e5e5";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderBottomColor = "transparent";
            }}
            placeholder="Korean translation"
          />

          {/* Time inputs - compact inline */}
          <div
            className="flex items-center text-[10px] font-mono"
            style={{ gap: 6, color: "#a3a3a3" }}
          >
            <input
              type="number"
              step="0.1"
              value={sentence.startTime}
              onChange={(e) =>
                onUpdateTime(
                  sentence.id,
                  "startTime",
                  parseFloat(e.target.value),
                )
              }
              className="w-12 text-right focus:outline-none bg-transparent"
              style={{ color: "#737373" }}
              onClick={(e) => e.stopPropagation()}
            />
            <span>-</span>
            <input
              type="number"
              step="0.1"
              value={sentence.endTime}
              onChange={(e) =>
                onUpdateTime(sentence.id, "endTime", parseFloat(e.target.value))
              }
              className="w-12 text-right focus:outline-none bg-transparent"
              style={{ color: "#737373" }}
              onClick={(e) => e.stopPropagation()}
            />
            <span style={{ color: "#d4d4d4" }}>|</span>
            <span>{(sentence.endTime - sentence.startTime).toFixed(1)}s</span>
          </div>
        </div>

        {/* Delete */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete(index);
          }}
          className="opacity-0 group-hover:opacity-100 shrink-0 transition-opacity"
          style={{ padding: 4, color: "#a3a3a3" }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "#ef4444";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "#a3a3a3";
          }}
          title="Delete sentence"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
