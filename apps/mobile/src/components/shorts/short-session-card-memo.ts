import type { CuratedVideo } from "@inputenglish/shared";
import type { SessionListItem } from "@/lib/api";

export interface MemoComparableProps {
  session: Pick<SessionListItem, "id">;
  isActive: boolean;
  shouldLoad: boolean;
  topOverlayInset?: number;
  bottomOverlayInset?: number;
  video: CuratedVideo | null;
  videoState: {
    status: "idle" | "loading" | "loaded" | "error";
    error?: string | null;
  };
  navigationRequest?: { nonce: number } | null;
}

export function arePropsEqual<T extends MemoComparableProps>(
  prev: T,
  next: T,
): boolean {
  return (
    prev.session.id === next.session.id &&
    prev.isActive === next.isActive &&
    prev.shouldLoad === next.shouldLoad &&
    // Reference equality so stale-while-revalidate updates (e.g. newly added
    // translations on the same video_id) actually re-render the card.
    prev.video === next.video &&
    prev.videoState.status === next.videoState.status &&
    prev.videoState.error === next.videoState.error &&
    prev.navigationRequest?.nonce === next.navigationRequest?.nonce &&
    prev.topOverlayInset === next.topOverlayInset &&
    prev.bottomOverlayInset === next.bottomOverlayInset
  );
}
