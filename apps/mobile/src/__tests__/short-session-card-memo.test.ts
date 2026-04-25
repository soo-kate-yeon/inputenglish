/**
 * Reproduction test for the shorts-tab subtitle bug.
 *
 * Bug: When the home tab's stale-while-revalidate fetched a fresh CuratedVideo
 * containing newly added Korean translations, ShortSessionCard's React.memo
 * predicate (`arePropsEqual`) only compared `prev.video?.video_id ===
 * next.video?.video_id`. video_id never changes during revalidation, so the
 * memo skipped the re-render and the new translations were never displayed —
 * even though the regular study screen (which fetches fresh data on mount)
 * showed them correctly for the same session.
 *
 * The fix is to compare the video object by reference, since the parent
 * always allocates a new object on revalidation.
 */
import type { CuratedVideo, Sentence } from "@inputenglish/shared";
import type { SessionListItem } from "@/lib/api";
import { arePropsEqual } from "@/components/shorts/short-session-card-memo";

type ShortSessionCardPropsLike = Parameters<typeof arePropsEqual>[0];

function makeSentence(overrides: Partial<Sentence> = {}): Sentence {
  return {
    id: "s1",
    text: "Hello world",
    startTime: 0,
    endTime: 2,
    highlights: [],
    ...overrides,
  };
}

function makeVideo(transcript: Sentence[]): CuratedVideo {
  return {
    id: "video-row-1",
    video_id: "youtube-abc",
    title: "Test video",
    snippet_start_time: 0,
    snippet_end_time: 60,
    snippet_duration: 60,
    transcript,
    source_url: "https://www.youtube.com/watch?v=youtube-abc",
    attribution: "Test",
    created_at: "2026-04-01T00:00:00Z",
  };
}

function makeProps(
  video: CuratedVideo | null,
  overrides: Partial<ShortSessionCardPropsLike> = {},
): ShortSessionCardPropsLike {
  return {
    session: {
      id: "session-1",
      source_video_id: "youtube-abc",
    } as SessionListItem,
    isActive: true,
    shouldLoad: true,
    topOverlayInset: 0,
    bottomOverlayInset: 0,
    video,
    videoState: { status: "loaded", error: null },
    onRetryVideoLoad: jest.fn(),
    navigationRequest: null,
    onActiveSentenceChange: undefined,
    ...overrides,
  };
}

describe("ShortSessionCard arePropsEqual", () => {
  it("returns false when stale-while-revalidate replaces video with one containing new translations", () => {
    const stale = makeVideo([
      makeSentence({ id: "s1", text: "Hello", translation: undefined }),
    ]);
    const fresh = makeVideo([
      makeSentence({ id: "s1", text: "Hello", translation: "안녕" }),
    ]);

    expect(stale.video_id).toBe(fresh.video_id);

    const prev = makeProps(stale);
    const next = makeProps(fresh);

    expect(arePropsEqual(prev, next)).toBe(false);
  });

  it("returns true when video reference is unchanged so no extra renders happen", () => {
    const video = makeVideo([makeSentence()]);
    expect(arePropsEqual(makeProps(video), makeProps(video))).toBe(true);
  });

  it("returns false when the session changes", () => {
    const video = makeVideo([makeSentence()]);
    const prev = makeProps(video);
    const next = makeProps(video, {
      session: {
        id: "session-2",
        source_video_id: "youtube-abc",
      } as SessionListItem,
    });
    expect(arePropsEqual(prev, next)).toBe(false);
  });

  it("returns false when isActive flips", () => {
    const video = makeVideo([makeSentence()]);
    const prev = makeProps(video, { isActive: true });
    const next = makeProps(video, { isActive: false });
    expect(arePropsEqual(prev, next)).toBe(false);
  });
});
