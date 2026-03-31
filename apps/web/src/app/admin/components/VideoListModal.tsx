import { useState } from "react";
import { Trash2 } from "lucide-react";

export interface ExistingSession {
  id: string;
  source_video_id: string;
  title: string;
  duration: number;
  difficulty?: string;
  order_index: number;
  created_at: string;
}

export interface ExistingVideo {
  video_id: string;
  title: string;
  created_at: string;
  sessions: ExistingSession[];
}

interface VideoListModalProps {
  show: boolean;
  videos: ExistingVideo[];
  onClose: () => void;
  onSelect: (videoId: string) => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function VideoListModal({
  show,
  videos,
  onClose,
  onSelect,
  onDeleteSession,
}: VideoListModalProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (!show) return null;

  const totalSessions = videos.reduce((sum, v) => sum + v.sessions.length, 0);

  const handleDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    if (!confirm("Delete this session? This cannot be undone.")) return;
    setDeletingId(sessionId);
    try {
      await onDeleteSession(sessionId);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-50"
      style={{ backgroundColor: "rgba(0,0,0,0.4)" }}
      onClick={onClose}
    >
      <div
        className="flex flex-col overflow-hidden"
        style={{
          backgroundColor: "#ffffff",
          border: "1px solid #e5e5e5",
          width: 640,
          maxHeight: "80vh",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="shrink-0 flex items-center justify-between"
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid #e5e5e5",
            backgroundColor: "#fafafa",
          }}
        >
          <span className="text-sm font-bold" style={{ color: "#0a0a0a" }}>
            Videos & Sessions ({videos.length} videos, {totalSessions} sessions)
          </span>
          <button
            onClick={onClose}
            style={{ color: "#a3a3a3", padding: 4 }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "#0a0a0a";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "#a3a3a3";
            }}
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {videos.length === 0 ? (
            <div
              className="text-center text-xs"
              style={{ padding: 32, color: "#a3a3a3" }}
            >
              No videos found.
            </div>
          ) : (
            videos.map((v) => (
              <div key={v.video_id}>
                {/* Video header row */}
                <button
                  onClick={() => {
                    if (
                      confirm("Load this video? Unsaved changes will be lost.")
                    ) {
                      onSelect(v.video_id);
                    }
                  }}
                  className="w-full text-left flex items-center justify-between transition-colors"
                  style={{
                    padding: "8px 16px",
                    borderBottom: "1px solid #f0f0f0",
                    backgroundColor: "#fafafa",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "#f0f0f0";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "#fafafa";
                  }}
                >
                  <div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: "#0a0a0a" }}
                    >
                      {v.title || v.video_id}
                    </div>
                    <div className="text-[10px]" style={{ color: "#a3a3a3" }}>
                      {new Date(v.created_at).toLocaleDateString()} ·{" "}
                      {v.sessions.length} sessions
                    </div>
                  </div>
                  <span
                    className="text-[10px] font-medium"
                    style={{ color: "#171717" }}
                  >
                    EDIT VIDEO
                  </span>
                </button>

                {/* Session rows */}
                {v.sessions.map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center group transition-colors"
                    style={{
                      padding: "6px 16px 6px 32px",
                      borderBottom: "1px solid #f5f5f5",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#fafafa";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <span
                      className="shrink-0 text-[10px] font-mono"
                      style={{ color: "#d4d4d4", width: 20 }}
                    >
                      └
                    </span>
                    <div className="flex-1 min-w-0">
                      <span className="text-xs" style={{ color: "#525252" }}>
                        {s.title}
                      </span>
                    </div>
                    <span
                      className="shrink-0 text-[10px] font-mono"
                      style={{ color: "#a3a3a3", marginRight: 8 }}
                    >
                      {formatDuration(Number(s.duration))}
                    </span>
                    {s.difficulty && (
                      <span
                        className="shrink-0 text-[9px] uppercase"
                        style={{
                          color: "#a3a3a3",
                          letterSpacing: 1,
                          marginRight: 8,
                        }}
                      >
                        {s.difficulty}
                      </span>
                    )}
                    <button
                      onClick={(e) => handleDelete(e, s.id)}
                      disabled={deletingId === s.id}
                      className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{
                        padding: 2,
                        color: "#d4d4d4",
                        cursor: deletingId === s.id ? "not-allowed" : "pointer",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#ef4444";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#d4d4d4";
                      }}
                    >
                      {deletingId === s.id ? (
                        <span className="text-[10px]">...</span>
                      ) : (
                        <Trash2 className="w-3 h-3" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
