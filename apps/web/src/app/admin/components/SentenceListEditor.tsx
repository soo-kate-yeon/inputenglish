import type { Sentence } from "@inputenglish/shared";
import { SentenceItem } from "./SentenceItem";

interface SentenceListEditorProps {
  sentences: Sentence[];
  loading: boolean;
  rawScript: string;
  onParseScript: () => void;
  onAnalyzeScenes: () => void;
  analyzingScenes: boolean;
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

export function SentenceListEditor({
  sentences,
  loading,
  rawScript,
  onParseScript,
  onAnalyzeScenes,
  analyzingScenes,
  onUpdateTime,
  onUpdateText,
  onDelete,
  onSplit,
  onMergeWithPrevious,
  onPlayFrom,
}: SentenceListEditorProps) {
  return (
    <div
      className="flex flex-col overflow-hidden min-h-0"
      style={{
        flex: 1,
        borderBottom: "1px solid #e5e5e5",
      }}
    >
      {/* Header bar */}
      <div
        className="shrink-0 flex items-center flex-wrap"
        style={{
          backgroundColor: "#fafafa",
          borderBottom: "1px solid #e5e5e5",
          padding: "6px 12px",
          gap: 8,
        }}
      >
        <span className="text-xs font-bold" style={{ color: "#0a0a0a" }}>
          Step 2: Parsed Sentences ({sentences.length})
        </span>
        <button
          onClick={onParseScript}
          disabled={loading || !rawScript.trim()}
          className="text-xs uppercase tracking-wide transition-colors"
          style={{
            backgroundColor:
              loading || !rawScript.trim() ? "#d4d4d4" : "#0a0a0a",
            color: "#ffffff",
            padding: "2px 8px",
            border: "none",
            cursor: loading || !rawScript.trim() ? "not-allowed" : "pointer",
          }}
          title="Parse raw script into sentences"
          onMouseEnter={(e) => {
            if (!loading && rawScript.trim()) {
              e.currentTarget.style.backgroundColor = "#404040";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && rawScript.trim()) {
              e.currentTarget.style.backgroundColor = "#0a0a0a";
            }
          }}
        >
          Parse Script
        </button>
        <button
          onClick={onAnalyzeScenes}
          disabled={analyzingScenes || sentences.length < 5}
          className="text-xs uppercase tracking-wide transition-colors"
          style={{
            backgroundColor:
              analyzingScenes || sentences.length < 5 ? "#d4d4d4" : "#8b5cf6",
            color: "#ffffff",
            padding: "2px 8px",
            border: "none",
            cursor:
              analyzingScenes || sentences.length < 5
                ? "not-allowed"
                : "pointer",
          }}
          title="AI가 세션으로 만들 가치가 높은 실무 말하기 장면 3개를 추천합니다"
          onMouseEnter={(e) => {
            if (!analyzingScenes && sentences.length >= 5) {
              e.currentTarget.style.backgroundColor = "#7c3aed";
            }
          }}
          onMouseLeave={(e) => {
            if (!analyzingScenes && sentences.length >= 5) {
              e.currentTarget.style.backgroundColor = "#8b5cf6";
            }
          }}
        >
          {analyzingScenes ? "분석 중..." : "AI 세션 장면 분석"}
        </button>
      </div>
      {/* Sentence list with internal scroll */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {sentences.map((s, idx) => (
          <SentenceItem
            key={s.id}
            sentence={s}
            index={idx}
            onUpdateTime={onUpdateTime}
            onUpdateText={onUpdateText}
            onDelete={onDelete}
            onSplit={onSplit}
            onMergeWithPrevious={onMergeWithPrevious}
            onPlayFrom={onPlayFrom}
          />
        ))}
        {sentences.length === 0 && (
          <div
            className="text-center italic text-xs"
            style={{ color: "#d4d4d4", padding: 24 }}
          >
            Parsed sentences will appear here...
          </div>
        )}
      </div>
    </div>
  );
}
