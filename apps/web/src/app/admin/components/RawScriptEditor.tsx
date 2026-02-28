interface RawScriptEditorProps {
  rawScript: string;
  loading: boolean;
  youtubeUrl: string;
  onChange: (value: string) => void;
  onFetchTranscript: () => void;
  onRefineScript: () => void;
  scriptRef: React.RefObject<HTMLTextAreaElement>;
}

export function RawScriptEditor({
  rawScript,
  loading,
  youtubeUrl,
  onChange,
  onFetchTranscript,
  onRefineScript,
  scriptRef,
}: RawScriptEditorProps) {
  return (
    <div
      className="h-full flex flex-col rounded-2xl overflow-hidden transition-colors relative"
      style={{
        backgroundColor: "#f0efeb",
        border: "1px solid #f0efeb",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div
        className="absolute top-0 left-0 text-xs font-bold rounded-br-lg z-10 flex items-center"
        style={{
          backgroundColor: "#fff2ec",
          color: "#552200",
          padding: "4px 12px",
          gap: 8,
        }}
      >
        Step 1: Raw Script
        <button
          onClick={onFetchTranscript}
          disabled={loading || !youtubeUrl}
          className="rounded uppercase tracking-wide transition-colors"
          style={{
            backgroundColor: loading || !youtubeUrl ? "#b8b7b4" : "#b45000",
            color: "#ffffff",
            padding: "2px 8px",
            fontSize: 10,
            opacity: loading || !youtubeUrl ? 0.5 : 1,
            cursor: loading || !youtubeUrl ? "not-allowed" : "pointer",
          }}
          title="Fetch transcript from YouTube"
          onMouseEnter={(e) => {
            if (!loading && youtubeUrl) {
              e.currentTarget.style.backgroundColor = "#964100";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && youtubeUrl) {
              e.currentTarget.style.backgroundColor = "#b45000";
            }
          }}
        >
          🎬 Fetch Transcript
        </button>
        <button
          onClick={onRefineScript}
          disabled={!rawScript.trim()}
          className="rounded uppercase tracking-wide transition-colors"
          style={{
            backgroundColor: "#ffffff",
            color: "#964100",
            padding: "2px 8px",
            fontSize: 10,
            border: "1px solid #ffc6a9",
            opacity: !rawScript.trim() ? 0.5 : 1,
            cursor: !rawScript.trim() ? "not-allowed" : "pointer",
          }}
          title="Clean up non-speech text like > or [Music]"
          onMouseEnter={(e) => {
            if (rawScript.trim()) {
              e.currentTarget.style.backgroundColor =
                "rgba(255, 255, 255, 0.8)";
            }
          }}
          onMouseLeave={(e) => {
            if (rawScript.trim()) {
              e.currentTarget.style.backgroundColor = "#ffffff";
            }
          }}
        >
          ✨ Refine Script
        </button>
      </div>
      <textarea
        ref={scriptRef}
        value={rawScript}
        onChange={(e) => onChange(e.target.value)}
        className="w-full h-full resize-none focus:outline-none text-lg leading-relaxed"
        style={{
          padding: "32px 24px 24px 24px",
          color: "#22221f",
          backgroundColor: "#ffffff",
        }}
        placeholder="Paste your full transcript here... Click where sentence ends and press ] to sync."
      />
    </div>
  );
}
