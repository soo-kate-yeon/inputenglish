import type { ReadingPiece, VideoSegment } from "@inputenglish/shared";

/**
 * Dev/fixture CI session for SPEC-INPUT-001 — lets the v1.3 learning flow
 * (reading + segments + highlight question) be exercised without the web API.
 */

const readingPiece: ReadingPiece = {
  id: "rp-fixture-001",
  level: "B1",
  format: "noir",
  topic: "The Last Shipment",
  body: "The harbor was quiet when the final container arrived. Mara checked the manifest twice. Every bag of coffee had a story, and this one ended in a city that never paid its debts. She lit a cigarette and waited for a buyer who was already late. The fog rolled in slowly, swallowing the cranes one by one.",
  coveragePct: 96,
  validationStatus: "approved",
  sourceFacts: {},
  userId: null,
  createdAt: "2026-06-15T00:00:00.000Z",
};

const segmentOne: VideoSegment = {
  id: "seg-fixture-001",
  parentVideoId: "arj7oStGLkU",
  channelId: "ch-fixture-001",
  startTime: 30,
  endTime: 70,
  transcript: [
    { start: 30, end: 34, text: "Hello everyone and welcome back." },
    {
      start: 34,
      end: 40,
      text: "Today we are talking about how small habits form.",
    },
    { start: 40, end: 46, text: "The key idea is surprisingly simple." },
    {
      start: 46,
      end: 52,
      text: "You repeat an action until it feels automatic.",
    },
    {
      start: 52,
      end: 58,
      text: "And then the hard part takes care of itself.",
    },
    { start: 58, end: 64, text: "So let us look at a concrete example." },
    { start: 64, end: 70, text: "Imagine you want to read every single day." },
  ],
  wpm: 118,
  bandCoverage: {
    beginner: 0.62,
    basic: 0.24,
    conversation: 0.1,
    professional: 0.04,
  },
  topicTags: ["habits", "psychology"],
  selfContained: true,
  difficultyScore: 2,
  createdAt: "2026-06-15T00:00:00.000Z",
};

const segmentTwo: VideoSegment = {
  id: "seg-fixture-002",
  parentVideoId: "arj7oStGLkU",
  channelId: "ch-fixture-001",
  startTime: 120,
  endTime: 158,
  transcript: [
    {
      start: 120,
      end: 126,
      text: "The second part is all about your environment.",
    },
    { start: 126, end: 132, text: "Make the good choice the easy choice." },
    {
      start: 132,
      end: 138,
      text: "If a book sits on your pillow, you will read it.",
    },
    { start: 138, end: 144, text: "Design beats willpower almost every time." },
    { start: 144, end: 150, text: "That is the whole trick in one sentence." },
    {
      start: 150,
      end: 158,
      text: "Thanks for watching, and see you next week.",
    },
  ],
  wpm: 124,
  bandCoverage: {
    beginner: 0.58,
    basic: 0.27,
    conversation: 0.11,
    professional: 0.04,
  },
  topicTags: ["habits", "environment"],
  selfContained: true,
  difficultyScore: 2,
  createdAt: "2026-06-15T00:00:00.000Z",
};

export const ciSessionFixture = {
  id: "ci-fixture-001",
  date: "2026-06-15",
  readingPiece,
  segments: [segmentOne, segmentTwo],
  assemblyMeta: { source: "fixture" } as Record<string, unknown>,
};
