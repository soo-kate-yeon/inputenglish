interface RawScriptEditorProps {
  rawScript: string;
  loading: boolean;
  youtubeUrl: string;
  onChange: (value: string) => void;
  onFetchTranscript: () => void;
  onRefineScript: () => void;
  scriptRef: React.RefObject<HTMLTextAreaElement>;
  startTime?: string;
  endTime?: string;
  onStartTimeChange?: (value: string) => void;
  onEndTimeChange?: (value: string) => void;
}

export function RawScriptEditor({
  rawScript,
  loading,
  youtubeUrl,
  onChange,
  onFetchTranscript,
  onRefineScript,
  scriptRef,
  startTime = "",
  endTime = "",
  onStartTimeChange,
  onEndTimeChange,
}: RawScriptEditorProps) {
  return (
    <div
      className="flex-1 flex flex-col overflow-hidden min-h-0"
      style={{
        borderTop: "1px solid #e5e5e5",
      }}
    >
      {/* Header bar */}
      <div
        className="shrink-0 flex items-center"
        style={{
          backgroundColor: "#fafafa",
          borderBottom: "1px solid #e5e5e5",
          padding: "6px 12px",
          gap: 8,
        }}
      >
        <span className="text-xs font-bold" style={{ color: "#0a0a0a" }}>
          Step 1: Raw Script
        </span>
        <button
          onClick={onFetchTranscript}
          disabled={loading || !youtubeUrl}
          className="text-xs uppercase tracking-wide transition-colors"
          style={{
            backgroundColor: loading || !youtubeUrl ? "#d4d4d4" : "#171717",
            color: "#ffffff",
            padding: "2px 8px",
            border: "none",
            cursor: loading || !youtubeUrl ? "not-allowed" : "pointer",
          }}
          title="Fetch transcript from YouTube"
          onMouseEnter={(e) => {
            if (!loading && youtubeUrl) {
              e.currentTarget.style.backgroundColor = "#404040";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && youtubeUrl) {
              e.currentTarget.style.backgroundColor = "#171717";
            }
          }}
        >
          Fetch Transcript
        </button>
        <button
          onClick={onRefineScript}
          disabled={!rawScript.trim()}
          className="text-xs uppercase tracking-wide transition-colors"
          style={{
            backgroundColor: "#ffffff",
            color: "#171717",
            padding: "2px 8px",
            border: "1px solid #e5e5e5",
            cursor: !rawScript.trim() ? "not-allowed" : "pointer",
            opacity: !rawScript.trim() ? 0.5 : 1,
          }}
          title="Clean up non-speech text like > or [Music]"
          onMouseEnter={(e) => {
            if (rawScript.trim()) {
              e.currentTarget.style.backgroundColor = "#fafafa";
            }
          }}
          onMouseLeave={(e) => {
            if (rawScript.trim()) {
              e.currentTarget.style.backgroundColor = "#ffffff";
            }
          }}
        >
          Refine Script
        </button>
        <div
          style={{
            marginLeft: "auto",
            display: "flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          <input
            type="text"
            value={startTime}
            onChange={(e) => onStartTimeChange?.(e.target.value)}
            placeholder="from 0:00"
            className="text-xs"
            style={{
              width: 64,
              padding: "2px 4px",
              border: "1px solid #e5e5e5",
              color: "#0a0a0a",
              backgroundColor: "#fff",
            }}
            title="Start time (mm:ss or hh:mm:ss)"
          />
          <span className="text-xs" style={{ color: "#737373" }}>
            ~
          </span>
          <input
            type="text"
            value={endTime}
            onChange={(e) => onEndTimeChange?.(e.target.value)}
            placeholder="to end"
            className="text-xs"
            style={{
              width: 64,
              padding: "2px 4px",
              border: "1px solid #e5e5e5",
              color: "#0a0a0a",
              backgroundColor: "#fff",
            }}
            title="End time (mm:ss or hh:mm:ss)"
          />
        </div>
      </div>
      {/* Textarea fills remaining space */}
      <textarea
        ref={scriptRef}
        value={rawScript}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 w-full resize-none focus:outline-none text-sm leading-relaxed"
        style={{
          padding: "12px 16px",
          color: "#0a0a0a",
          backgroundColor: "#ffffff",
          minHeight: 0,
        }}
        placeholder="Paste your full transcript here... Click where sentence ends and press ] to sync."
      />
    </div>
  );
}
