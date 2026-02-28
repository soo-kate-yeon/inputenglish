import YouTubePlayer from "@/components/YouTubePlayer";

interface VideoPlayerPanelProps {
  videoId: string | null;
  currentTime: number;
  lastSyncTime: number;
  onReady: (player: YT.Player) => void;
  onTimeUpdate: (time: number) => void;
}

export function VideoPlayerPanel({
  videoId,
  currentTime,
  lastSyncTime,
  onReady,
  onTimeUpdate,
}: VideoPlayerPanelProps) {
  return (
    <div className="w-full flex flex-col" style={{ gap: 16 }}>
      <div
        className="relative w-full aspect-video rounded-2xl overflow-hidden shrink-0"
        style={{
          backgroundColor: "#000000",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          border: "1px solid rgba(12, 11, 9, 0.1)",
        }}
      >
        {videoId ? (
          <YouTubePlayer
            videoId={videoId}
            className="w-full h-full"
            onReady={onReady}
            onTimeUpdate={onTimeUpdate}
            showNativeControls={true}
          />
        ) : (
          <div
            className="w-full h-full flex items-center justify-center"
            style={{ color: "#565552" }}
          >
            Enter URL to load video
          </div>
        )}
      </div>

      <div
        className="rounded-2xl flex-1 overflow-y-auto"
        style={{
          backgroundColor: "#f0efeb",
          padding: 24,
          boxShadow: "0 1px 2px rgba(0, 0, 0, 0.1)",
          border: "1px solid #f0efeb",
        }}
      >
        <h3 className="font-bold mb-3" style={{ color: "#0c0b09" }}>
          How to Sync
        </h3>
        <ul
          className="text-sm mb-6 list-disc"
          style={{ paddingLeft: 16, color: "#565552", lineHeight: 1.8 }}
        >
          <li style={{ marginBottom: 8 }}>
            <strong>Paste script</strong> into the top-right editor.
          </li>
          <li style={{ marginBottom: 8 }}>
            Play video. Click in the text where the sentence ends.
          </li>
          <li style={{ marginBottom: 8 }}>
            Press{" "}
            <kbd
              className="rounded font-bold"
              style={{
                backgroundColor: "#fff2ec",
                color: "#743100",
                padding: "2px 6px",
              }}
            >
              ]
            </kbd>{" "}
            key.
          </li>
          <li>
            Use <strong>Auto Translate</strong> to fill Korean meanings.
          </li>
        </ul>

        <div
          className="rounded-xl"
          style={{
            backgroundColor: "#ffffff",
            padding: 16,
            border: "1px solid #dfdedb",
          }}
        >
          <div
            className="flex justify-between text-sm"
            style={{ marginBottom: 8 }}
          >
            <span style={{ color: "#565552" }}>Current Time</span>
            <span
              className="font-mono font-bold text-lg"
              style={{ color: "#964100" }}
            >
              {currentTime.toFixed(2)}s
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span style={{ color: "#565552" }}>Last Sync Time</span>
            <span className="font-mono" style={{ color: "#3b3a38" }}>
              {lastSyncTime.toFixed(2)}s
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
