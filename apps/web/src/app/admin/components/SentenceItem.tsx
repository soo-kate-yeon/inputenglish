import type { Sentence } from "@shadowoo/shared";
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
      className="rounded-xl group cursor-pointer transition-all"
      style={{
        backgroundColor: "#ffffff",
        padding: 16,
        border: "1px solid #f0efeb",
      }}
      onClick={handlePlayClick}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = "#dfdedb";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = "#f0efeb";
      }}
    >
      <div className="flex gap-4 items-start">
        <span className="text-xs font-mono text-secondary-400 mt-1.5 w-6">
          #{index + 1}
        </span>
        <div className="flex-1 space-y-3">
          {/* Textarea for Wrapping - Press ] to split, [ to merge */}
          <textarea
            ref={textareaRef}
            value={sentence.text}
            onChange={(e) => onUpdateText(sentence.id, "text", e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            className="w-full bg-transparent font-medium text-md text-secondary-900 focus:outline-none border-b border-transparent focus:border-secondary-300 pb-1 resize-none overflow-hidden"
            placeholder="Original Sentence (] to split, [ to merge)"
          />
          <input
            value={sentence.translation || ""}
            onChange={(e) =>
              onUpdateText(sentence.id, "translation", e.target.value)
            }
            className="w-full bg-transparent text-sm text-secondary-600 focus:outline-none border-b border-secondary-200 focus:border-primary-300 pb-1 placeholder:text-secondary-300"
            placeholder="Korean Translation (Click 'Auto Translate' above)"
          />

          <div className="flex gap-4 text-xs font-mono text-secondary-500 items-center">
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-secondary-200">
              <span>Start</span>
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
                className="w-14 text-right focus:outline-none focus:text-primary-600 font-bold"
              />
            </div>
            <div className="text-secondary-300">→</div>
            <div className="flex items-center gap-1.5 bg-white px-2 py-1 rounded border border-secondary-200">
              <span>End</span>
              <input
                type="number"
                step="0.1"
                value={sentence.endTime}
                onChange={(e) =>
                  onUpdateTime(
                    sentence.id,
                    "endTime",
                    parseFloat(e.target.value),
                  )
                }
                className="w-14 text-right focus:outline-none focus:text-primary-600 font-bold"
              />
            </div>
            <div className="text-secondary-300 ml-2">
              Dur: {(sentence.endTime - sentence.startTime).toFixed(2)}s
            </div>
          </div>
        </div>
        <button
          onClick={() => onDelete(index)}
          className="opacity-0 group-hover:opacity-100 p-2 text-secondary-400 hover:text-error hover:bg-error/10 rounded-lg transition-all"
          title="Delete sentence"
        >
          ✕
        </button>
      </div>
    </div>
  );
}
