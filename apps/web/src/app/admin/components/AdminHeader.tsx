interface AdminHeaderProps {
  youtubeUrl: string;
  title: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  tags: string;
  loading: boolean;
  sentencesCount: number;
  onYoutubeUrlChange: (url: string) => void;
  onTitleChange: (title: string) => void;
  onDifficultyChange: (
    difficulty: "beginner" | "intermediate" | "advanced",
  ) => void;
  onTagsChange: (tags: string) => void;
  onSave: () => void;
  onLoadExisting: () => void;
}

export function AdminHeader({
  youtubeUrl,
  title,
  difficulty,
  tags,
  loading,
  sentencesCount,
  onYoutubeUrlChange,
  onTitleChange,
  onDifficultyChange,
  onTagsChange,
  onSave,
  onLoadExisting,
}: AdminHeaderProps) {
  return (
    <div
      className="shrink-0 flex justify-between items-center"
      style={{
        height: 56,
        backgroundColor: "#ffffff",
        padding: "0 16px",
        borderBottom: "1px solid #e5e5e5",
      }}
    >
      <div className="flex items-center" style={{ gap: 12 }}>
        <h1
          className="font-bold"
          style={{ fontSize: 14, color: "#0a0a0a", letterSpacing: "0.02em" }}
        >
          Sync Editor
        </h1>
        <button
          onClick={onLoadExisting}
          className="text-xs transition-colors"
          style={{
            backgroundColor: "#ffffff",
            color: "#737373",
            padding: "4px 10px",
            border: "1px solid #e5e5e5",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#fafafa";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "#ffffff";
          }}
        >
          Load Existing
        </button>
      </div>
      <div className="flex items-center" style={{ gap: 10 }}>
        <input
          className="text-sm"
          style={{
            padding: "6px 10px",
            border: "1px solid #e5e5e5",
            backgroundColor: "#ffffff",
            width: 240,
            outline: "none",
            color: "#0a0a0a",
          }}
          value={youtubeUrl}
          onChange={(e) => onYoutubeUrlChange(e.target.value)}
          placeholder="YouTube URL..."
        />
        <input
          className="text-sm"
          style={{
            padding: "6px 10px",
            border: "1px solid #e5e5e5",
            backgroundColor: "#ffffff",
            width: 300,
            outline: "none",
            color: "#0a0a0a",
          }}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Video Title..."
        />
        <select
          className="text-sm"
          style={{
            padding: "6px 10px",
            border: "1px solid #e5e5e5",
            backgroundColor: "#ffffff",
            outline: "none",
            color: "#0a0a0a",
          }}
          value={difficulty}
          onChange={(e) =>
            onDifficultyChange(
              e.target.value as "beginner" | "intermediate" | "advanced",
            )
          }
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <button
          onClick={onSave}
          disabled={loading || sentencesCount === 0}
          className="font-bold text-sm transition-colors"
          style={{
            backgroundColor:
              loading || sentencesCount === 0 ? "#d4d4d4" : "#b45000",
            color: "#ffffff",
            padding: "6px 20px",
            cursor: loading || sentencesCount === 0 ? "not-allowed" : "pointer",
            border: "none",
          }}
          onMouseEnter={(e) => {
            if (!loading && sentencesCount > 0) {
              e.currentTarget.style.backgroundColor = "#964100";
            }
          }}
          onMouseLeave={(e) => {
            if (!loading && sentencesCount > 0) {
              e.currentTarget.style.backgroundColor = "#b45000";
            }
          }}
        >
          {loading ? "Processing..." : "Save & Publish"}
        </button>
      </div>
    </div>
  );
}
