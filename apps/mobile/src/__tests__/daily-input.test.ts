const mockFetchLearningSessions = jest.fn();
const mockFetchSessionsByIds = jest.fn();
const mockFetchCuratedVideo = jest.fn();
const mockFetchTransformationSet = jest.fn();
const mockGetRecentSessionIds = jest.fn();
const mockGetString = jest.fn();
const mockSet = jest.fn();
const mockDelete = jest.fn();

jest.mock("../lib/api", () => ({
  fetchLearningSessions: (...args: unknown[]) =>
    mockFetchLearningSessions(...args),
  fetchSessionsByIds: (...args: unknown[]) => mockFetchSessionsByIds(...args),
  fetchCuratedVideo: (...args: unknown[]) => mockFetchCuratedVideo(...args),
}));

jest.mock("../lib/transformation-api", () => ({
  fetchTransformationSet: (...args: unknown[]) =>
    mockFetchTransformationSet(...args),
}));

jest.mock("../lib/recent-sessions", () => ({
  getRecentSessionIds: () => mockGetRecentSessionIds(),
}));

jest.mock("../lib/mmkv", () => ({
  __esModule: true,
  default: {
    getString: (...args: unknown[]) => mockGetString(...args),
    set: (...args: unknown[]) => mockSet(...args),
    delete: (...args: unknown[]) => mockDelete(...args),
  },
}));

describe("daily input queue", () => {
  beforeEach(() => {
    jest.resetModules();
    mockFetchLearningSessions.mockReset();
    mockFetchSessionsByIds.mockReset();
    mockFetchCuratedVideo.mockReset();
    mockFetchTransformationSet.mockReset();
    mockGetRecentSessionIds.mockReset();
    mockGetString.mockReset();
    mockSet.mockReset();
    mockDelete.mockReset();
    mockGetRecentSessionIds.mockReturnValue([]);
    mockFetchSessionsByIds.mockResolvedValue([]);
    mockGetString.mockReturnValue(undefined);
  });

  it("keeps pronunciation queue session-only and ranks exact speaker matches first", async () => {
    mockFetchLearningSessions.mockResolvedValue([
      {
        id: "session-no-anchor",
        source_video_id: "video-no-anchor",
        title: "Michelle Obama Interview",
        order_index: 2,
        source_type: "interview",
        sentence_ids: [],
        primary_speaker_name: "Michelle Obama",
        speaker_names: ["Michelle Obama"],
      },
      {
        id: "session-match",
        source_video_id: "video-match",
        title: "Michelle Obama Keynote",
        order_index: 1,
        source_type: "public-speech",
        sentence_ids: ["sentence-match"],
        primary_speaker_name: "Michelle Obama",
        speaker_names: ["Michelle Obama"],
      },
      {
        id: "session-fallback",
        source_video_id: "video-fallback",
        title: "General Talk",
        order_index: 3,
        source_type: "podcast",
        sentence_ids: ["sentence-fallback"],
        primary_speaker_name: "Someone Else",
        speaker_names: ["Someone Else"],
      },
    ]);

    mockFetchCuratedVideo.mockImplementation(async (videoId: string) => ({
      video_id: videoId,
      transcript: [
        {
          id:
            videoId === "video-match"
              ? "sentence-match"
              : videoId === "video-fallback"
                ? "sentence-fallback"
                : "sentence-missing",
          text:
            videoId === "video-match"
              ? "Michelle anchor line."
              : videoId === "video-fallback"
                ? "Fallback line."
                : "Missing anchor line.",
          translation:
            videoId === "video-match"
              ? "미셸 오바마 문장"
              : videoId === "video-fallback"
                ? "일반 문장"
                : "매칭 안 되는 문장",
          startTime: 1,
          endTime: 4,
          highlights: [],
        },
      ],
    }));

    const { getDailyInputQueue } = require("../lib/daily-input");
    const queue = await getDailyInputQueue({
      user_id: "user-1",
      level_band: "conversation",
      goal_mode: "pronunciation",
      focus_tags: [],
      preferred_speakers: ["Michelle Obama"],
      preferred_situations: [],
      preferred_video_categories: [],
      onboarding_completed_at: "2026-04-19T00:00:00.000Z",
    });

    expect(queue.map((item: { sessionId: string }) => item.sessionId)).toEqual([
      "session-match",
      "session-fallback",
    ]);
    expect(queue[0].translation).toBe("미셸 오바마 문장");
  });

  it("ranks exact expression category and situation matches above general sessions", async () => {
    mockFetchLearningSessions.mockResolvedValue([
      {
        id: "session-general",
        source_video_id: "video-general",
        title: "Business podcast",
        order_index: 2,
        source_type: "podcast",
        genre: "business",
        sentence_ids: ["sentence-general"],
        video_categories: [],
        speaking_situations: [],
      },
      {
        id: "session-perfect-match",
        source_video_id: "video-perfect",
        title: "Celebrity interview",
        order_index: 1,
        source_type: "interview",
        genre: "art",
        sentence_ids: ["sentence-perfect"],
        video_categories: ["셀럽 인터뷰"],
        speaking_situations: ["학교/업무"],
      },
    ]);

    mockFetchTransformationSet.mockImplementation(async (sessionId: string) =>
      sessionId === "session-perfect-match"
        ? {
            id: "set-perfect",
            session_id: "session-perfect-match",
            source_sentence_ids: ["sentence-perfect"],
            exercises: [],
          }
        : {
            id: "set-general",
            session_id: "session-general",
            source_sentence_ids: ["sentence-general"],
            exercises: [],
          },
    );

    mockFetchCuratedVideo.mockImplementation(async (videoId: string) => ({
      video_id: videoId,
      transcript: [
        {
          id:
            videoId === "video-perfect"
              ? "sentence-perfect"
              : "sentence-general",
          text:
            videoId === "video-perfect"
              ? "Let me walk you through the launch."
              : "Here is a general update.",
          translation:
            videoId === "video-perfect"
              ? "출시 내용을 설명드릴게요."
              : "일반 업데이트입니다.",
          startTime: 0,
          endTime: 3,
          highlights: [],
        },
      ],
    }));

    const { getDailyInputQueue } = require("../lib/daily-input");
    const queue = await getDailyInputQueue({
      user_id: "user-1",
      level_band: "conversation",
      goal_mode: "expression",
      focus_tags: [],
      preferred_speakers: [],
      preferred_situations: ["학교/업무"],
      preferred_video_categories: ["셀럽 인터뷰"],
      onboarding_completed_at: "2026-04-19T00:00:00.000Z",
    });

    expect(queue[0].sessionId).toBe("session-perfect-match");
    expect(queue[1].sessionId).toBe("session-general");
  });
});
