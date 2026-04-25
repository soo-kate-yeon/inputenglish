import type { Sentence } from "@inputenglish/shared";
import { SentenceItem } from "./SentenceItem";

type SelectionTarget = "shortform" | "longform";

interface SentenceListEditorProps {
  sentences: Sentence[];
  loading: boolean;
  rawScript: string;
  highlightedSentenceIds?: Set<string>;
  selectionTarget: SelectionTarget;
  shortformSelectedSentenceIds?: Set<string>;
  longformSelectedSentenceIds?: Set<string>;
  onSelectionTargetChange: (target: SelectionTarget) => void;
  onSentenceSelect?: (id: string) => void;
  onParseScript: () => void;
  onAnalyzeScenes: () => void;
  analyzingScenes: boolean;
  onAnalyzeShortsOnly?: () => void;
  analyzingShortsOnly?: boolean;
  onTranslateSelected?: (sentenceIds: string[]) => Promise<void>;
  translating?: boolean;
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
  highlightedSentenceIds,
  selectionTarget,
  shortformSelectedSentenceIds,
  longformSelectedSentenceIds,
  onSelectionTargetChange,
  onSentenceSelect,
  onParseScript,
  onAnalyzeScenes,
  analyzingScenes,
  onAnalyzeShortsOnly,
  analyzingShortsOnly = false,
  onTranslateSelected,
  translating = false,
  onUpdateTime,
  onUpdateText,
  onDelete,
  onSplit,
  onMergeWithPrevious,
  onPlayFrom,
}: SentenceListEditorProps) {
  const activeSelectedSentenceIds =
    selectionTarget === "longform"
      ? longformSelectedSentenceIds
      : shortformSelectedSentenceIds;
  const activeSelectionCount = activeSelectedSentenceIds?.size ?? 0;
  const activeSelectionLabel = selectionTarget === "longform" ? "롱폼" : "쇼츠";

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
        <div className="flex items-center" style={{ gap: 4 }}>
          {(
            [
              [
                "shortform",
                "쇼츠 선택",
                shortformSelectedSentenceIds?.size ?? 0,
              ],
              ["longform", "롱폼 선택", longformSelectedSentenceIds?.size ?? 0],
            ] as const
          ).map(([target, label, count]) => {
            const active = selectionTarget === target;
            return (
              <button
                key={target}
                type="button"
                onClick={() => onSelectionTargetChange(target)}
                className="text-xs transition-colors"
                style={{
                  padding: "2px 8px",
                  border: active ? "1px solid #0a0a0a" : "1px solid #d4d4d4",
                  backgroundColor: active ? "#0a0a0a" : "#ffffff",
                  color: active ? "#ffffff" : "#525252",
                  cursor: "pointer",
                }}
              >
                {label} ({count})
              </button>
            );
          })}
        </div>
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
          disabled={
            analyzingScenes || analyzingShortsOnly || sentences.length < 20
          }
          className="text-xs uppercase tracking-wide transition-colors"
          style={{
            backgroundColor:
              analyzingScenes || analyzingShortsOnly || sentences.length < 20
                ? "#d4d4d4"
                : "#8b5cf6",
            color: "#ffffff",
            padding: "2px 8px",
            border: "none",
            cursor:
              analyzingScenes || analyzingShortsOnly || sentences.length < 20
                ? "not-allowed"
                : "pointer",
          }}
          title="AI가 롱폼 1개와 포인트 쇼츠 3~4개를 추천합니다"
          onMouseEnter={(e) => {
            if (
              !analyzingScenes &&
              !analyzingShortsOnly &&
              sentences.length >= 20
            ) {
              e.currentTarget.style.backgroundColor = "#7c3aed";
            }
          }}
          onMouseLeave={(e) => {
            if (
              !analyzingScenes &&
              !analyzingShortsOnly &&
              sentences.length >= 20
            ) {
              e.currentTarget.style.backgroundColor = "#8b5cf6";
            }
          }}
        >
          {analyzingScenes ? "분석 중..." : "AI 롱폼/쇼츠 분석"}
        </button>
        {onAnalyzeShortsOnly && (
          <button
            onClick={onAnalyzeShortsOnly}
            disabled={
              analyzingShortsOnly || analyzingScenes || sentences.length < 20
            }
            className="text-xs uppercase tracking-wide transition-colors"
            style={{
              backgroundColor:
                analyzingShortsOnly || analyzingScenes || sentences.length < 20
                  ? "#d4d4d4"
                  : "#0891b2",
              color: "#ffffff",
              padding: "2px 8px",
              border: "none",
              cursor:
                analyzingShortsOnly || analyzingScenes || sentences.length < 20
                  ? "not-allowed"
                  : "pointer",
            }}
            title="AI가 롱폼 없이 숏폼 2~3개만 추천합니다"
            onMouseEnter={(e) => {
              if (
                !analyzingShortsOnly &&
                !analyzingScenes &&
                sentences.length >= 20
              ) {
                e.currentTarget.style.backgroundColor = "#0e7490";
              }
            }}
            onMouseLeave={(e) => {
              if (
                !analyzingShortsOnly &&
                !analyzingScenes &&
                sentences.length >= 20
              ) {
                e.currentTarget.style.backgroundColor = "#0891b2";
              }
            }}
          >
            {analyzingShortsOnly ? "분석 중..." : "AI 숏폼만 분석"}
          </button>
        )}
        {onTranslateSelected && (
          <button
            onClick={() => {
              const ids =
                activeSelectedSentenceIds && activeSelectedSentenceIds.size > 0
                  ? Array.from(activeSelectedSentenceIds)
                  : sentences.map((s) => s.id);
              onTranslateSelected(ids);
            }}
            disabled={translating || sentences.length === 0}
            className="text-xs uppercase tracking-wide transition-colors"
            style={{
              backgroundColor:
                translating || sentences.length === 0 ? "#d4d4d4" : "#059669",
              color: "#ffffff",
              padding: "2px 8px",
              border: "none",
              cursor:
                translating || sentences.length === 0
                  ? "not-allowed"
                  : "pointer",
            }}
            title={
              activeSelectionCount > 0
                ? `선택된 ${activeSelectionCount}개 ${activeSelectionLabel} 문장을 한국어로 번역`
                : `${activeSelectionLabel} 선택이 없어서 전체 문장을 한국어로 번역`
            }
            onMouseEnter={(e) => {
              if (!translating && sentences.length > 0) {
                e.currentTarget.style.backgroundColor = "#047857";
              }
            }}
            onMouseLeave={(e) => {
              if (!translating && sentences.length > 0) {
                e.currentTarget.style.backgroundColor = "#059669";
              }
            }}
          >
            {translating
              ? "번역 중..."
              : activeSelectionCount > 0
                ? `${activeSelectionLabel} ${activeSelectionCount}개 번역`
                : "전체 번역"}
          </button>
        )}
      </div>
      {/* Sentence list with internal scroll */}
      <div className="flex-1 overflow-y-auto" style={{ minHeight: 0 }}>
        {sentences.map((s, idx) => (
          <SentenceItem
            key={s.id}
            sentence={s}
            index={idx}
            highlighted={highlightedSentenceIds?.has(s.id)}
            selected={activeSelectedSentenceIds?.has(s.id)}
            onSelect={onSentenceSelect}
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
