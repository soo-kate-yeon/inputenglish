import YouTubePlayer from "@/components/YouTubePlayer";

interface VideoPlayerPanelProps {
  videoId: string | null;
  onReady: (player: YT.Player) => void;
  onTimeUpdate: (time: number) => void;
}

export function VideoPlayerPanel({
  videoId,
  onReady,
  onTimeUpdate,
}: VideoPlayerPanelProps) {
  return (
    <div
      className="relative w-full shrink-0"
      style={{
        aspectRatio: "16 / 9",
        backgroundColor: "#000000",
        borderBottom: "1px solid #e5e5e5",
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
          className="w-full h-full flex items-center justify-center text-sm"
          style={{ color: "#737373" }}
        >
          Enter URL to load video
        </div>
      )}
    </div>
  );
}
