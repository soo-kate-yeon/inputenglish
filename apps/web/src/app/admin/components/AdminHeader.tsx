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
      className="shrink-0 flex justify-between items-center rounded-xl"
      style={{
        height: 80,
        backgroundColor: "#f0efeb",
        padding: "0 24px",
        border: "1px solid #f0efeb",
        boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
      }}
    >
      <div>
        <div className="flex items-center" style={{ gap: 12 }}>
          <h1
            className="font-bold"
            style={{ fontSize: 20, color: "#0c0b09", lineHeight: 1.46 }}
          >
            Sync Editor & Translator
          </h1>
          <button
            onClick={onLoadExisting}
            className="text-md rounded transition-colors"
            style={{
              backgroundColor: "#ffffff",
              color: "#565552",
              padding: "4px 8px",
              border: "1px solid #f0efeb",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f0efeb";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "#ffffff";
            }}
          >
            📂 Load Existing
          </button>
        </div>
        <div
          className="flex text-xs items-center mt-1"
          style={{ gap: 16, color: "#565552" }}
        >
          <span>Video: {youtubeUrl || "None"}</span>
        </div>
      </div>
      <div className="flex items-center" style={{ gap: 16 }}>
        <input
          className="rounded-lg text-sm"
          style={{
            padding: "8px 12px",
            border: "1px solid #f0efeb",
            backgroundColor: "#ffffff",
            width: 256,
          }}
          value={youtubeUrl}
          onChange={(e) => onYoutubeUrlChange(e.target.value)}
          placeholder="YouTube URL..."
        />
        <input
          className="rounded-lg text-sm"
          style={{
            padding: "8px 12px",
            border: "1px solid #f0efeb",
            backgroundColor: "#ffffff",
            width: 320,
          }}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="Video Title..."
        />
        <select
          className="rounded-lg text-sm"
          style={{
            padding: "8px 12px",
            border: "1px solid #f0efeb",
            backgroundColor: "#ffffff",
          }}
          value={difficulty}
          onChange={(e) => onDifficultyChange(e.target.value as any)}
        >
          <option value="beginner">Beginner</option>
          <option value="intermediate">Intermediate</option>
          <option value="advanced">Advanced</option>
        </select>
        <button
          onClick={onSave}
          disabled={loading || sentencesCount === 0}
          className="font-bold rounded-lg text-sm transition-colors"
          style={{
            backgroundColor:
              loading || sentencesCount === 0 ? "#b8b7b4" : "#b45000",
            color: "#ffffff",
            padding: "8px 24px",
            opacity: loading || sentencesCount === 0 ? 0.5 : 1,
            cursor: loading || sentencesCount === 0 ? "not-allowed" : "pointer",
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
