import type { Sentence } from "@shadowoo/shared";
import { SentenceItem } from "./SentenceItem";

interface SentenceListEditorProps {
  sentences: Sentence[];
  loading: boolean;
  rawScript: string;
  onParseScript: () => void;
  onAutoTranslate: () => void;
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
  onAutoTranslate,
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
      className="flex-1 rounded-2xl overflow-hidden flex flex-col relative"
      style={{
        backgroundColor: "#f0efeb",
        border: "1px solid #f0efeb",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        className="absolute top-0 left-0 text-xs font-bold rounded-br-lg z-10 flex items-center"
        style={{
          backgroundColor: "#dfdedb",
          color: "#22221f",
          padding: "4px 12px",
          gap: 8,
        }}
      >
        Step 2: Parsed Sentences ({sentences.length})
        <button
          onClick={onParseScript}
          disabled={loading || !rawScript.trim()}
          className="rounded uppercase tracking-wide transition-colors"
          style={{
            backgroundColor:
              loading || !rawScript.trim() ? "#b8b7b4" : "#3b3a38",
            color: "#ffffff",
            padding: "2px 8px",
            fontSize: 10,
            opacity: loading || !rawScript.trim() ? 0.5 : 1,
            cursor: loading || !rawScript.trim() ? "not-allowed" : "pointer",
          }}
          title="Parse raw script into sentences"
          onMouseEnter={(e) => {
            if (!loading && rawScript.trim()) {
              e.currentTarget.style.backgroundColor = "#22221f";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && rawScript.trim()) {
              e.currentTarget.style.backgroundColor = "#3b3a38";
            }
          }}
        >
          📝 Parse Script
        </button>
        <button
          onClick={onAutoTranslate}
          disabled={loading || sentences.length === 0}
          className="rounded uppercase tracking-wide transition-colors"
          style={{
            backgroundColor:
              loading || sentences.length === 0 ? "#b8b7b4" : "#b45000",
            color: "#ffffff",
            padding: "2px 8px",
            fontSize: 10,
            opacity: loading || sentences.length === 0 ? 0.5 : 1,
            cursor:
              loading || sentences.length === 0 ? "not-allowed" : "pointer",
          }}
          onMouseEnter={(e) => {
            if (!loading && sentences.length > 0) {
              e.currentTarget.style.backgroundColor = "#964100";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && sentences.length > 0) {
              e.currentTarget.style.backgroundColor = "#b45000";
            }
          }}
        >
          Auto Translate
        </button>
        <button
          onClick={onAnalyzeScenes}
          disabled={analyzingScenes || sentences.length < 5}
          className="rounded uppercase tracking-wide transition-colors"
          style={{
            backgroundColor:
              analyzingScenes || sentences.length < 5 ? "#b8b7b4" : "#8b5cf6",
            color: "#ffffff",
            padding: "2px 8px",
            fontSize: 10,
            opacity: analyzingScenes || sentences.length < 5 ? 0.5 : 1,
            cursor:
              analyzingScenes || sentences.length < 5
                ? "not-allowed"
                : "pointer",
          }}
          title="AI will analyze and recommend 3 key scenes for learning"
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
          {analyzingScenes ? "⏳ Analyzing..." : "🎯 AI Scene Analysis"}
        </button>
        <div className="flex-1" />
      </div>
      <div
        className="flex-1 overflow-y-auto"
        style={{ padding: "24px 16px 16px 16px", gap: 12 }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
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
        </div>
        {sentences.length === 0 && (
          <div
            className="text-center italic"
            style={{ color: "#908f8c", paddingTop: 24, paddingBottom: 24 }}
          >
            Parsed sentences will appear here...
          </div>
        )}
      </div>
    </div>
  );
}
