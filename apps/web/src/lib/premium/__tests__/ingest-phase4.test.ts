/**
 * Integration tests for SPEC-WEB-001 Phase 4 ingest route extensions.
 *
 * TDD cycle: RED → GREEN → REFACTOR
 *
 * Tests cover:
 * - AC-003-1: video_segments row includes script_clean, subtitle_dependency_stage, il
 * - AC-003-3: listening threshold (stricter than reading) determines subtitle_dependency_stage
 *
 * NOTE: vitest has clearMocks+restoreMocks=true, so all mock implementations
 * must be set up in beforeEach (not at module level).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── all mocks declared before imports ─────────────────────────────────────────

vi.mock("@/utils/supabase/server", () => ({
  createAdminClient: vi.fn(),
}));

vi.mock("@/utils/supabase/admin-auth", () => ({
  requireAdmin: vi.fn(),
}));

vi.mock("@/lib/premium/youtube-transcript", () => ({
  loadTranscriptWithYtDlp: vi.fn(),
}));

vi.mock("@/lib/premium/translation", () => ({
  translateLines: vi.fn(),
}));

vi.mock("@/lib/premium/segment-scorer", () => ({
  calculateWpm: vi.fn(),
  scoreSegmentDifficulty: vi.fn(),
  isSelfContained: vi.fn(),
}));

vi.mock("@/lib/premium/band-coverage", () => ({
  computeBandCoverage: vi.fn(),
  extractTopicTags: vi.fn(),
}));

// ── import mocked modules for vi.mocked() ─────────────────────────────────────
import { createAdminClient } from "@/utils/supabase/server";
import { requireAdmin } from "@/utils/supabase/admin-auth";
import { loadTranscriptWithYtDlp } from "@/lib/premium/youtube-transcript";
import { translateLines } from "@/lib/premium/translation";
import {
  calculateWpm,
  scoreSegmentDifficulty,
  isSelfContained,
} from "@/lib/premium/segment-scorer";
import {
  computeBandCoverage,
  extractTopicTags,
} from "@/lib/premium/band-coverage";

// ── import route AFTER mocks ───────────────────────────────────────────────────
import { POST } from "@/app/api/admin/premium/ingest/route";

const CHANNEL_ID = "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6";
const VIDEO_ID = "test-video-id";

function makeAdminRequest(videoId = VIDEO_ID) {
  return new Request("http://localhost/api/admin/premium/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, channelId: CHANNEL_ID }),
  });
}

// A transcript that spans >60 seconds so splitIntoSegments creates at least 1 segment
const MOCK_TRANSCRIPT = [
  { id: "1", text: "Hello world today", startTime: 0, endTime: 10 },
  { id: "2", text: "Good morning everyone", startTime: 10, endTime: 20 },
  { id: "3", text: "How are you doing", startTime: 20, endTime: 30 },
  { id: "4", text: "I am doing fine", startTime: 30, endTime: 40 },
  { id: "5", text: "Let us begin the talk", startTime: 40, endTime: 50 },
  { id: "6", text: "Today we discuss technology", startTime: 50, endTime: 60 },
  { id: "7", text: "About software and AI", startTime: 60, endTime: 70 },
];

function setupDefaultMocks(bandCoverage: Record<string, number>) {
  vi.mocked(requireAdmin).mockResolvedValue({
    id: "admin-1",
    email: "a@b.com",
  } as never);

  vi.mocked(loadTranscriptWithYtDlp).mockResolvedValue({
    transcript: MOCK_TRANSCRIPT,
  } as never);

  vi.mocked(translateLines).mockImplementation(async (texts: string[]) =>
    texts.map((t) => `[ko] ${t}`),
  );

  vi.mocked(calculateWpm).mockReturnValue(120);
  vi.mocked(scoreSegmentDifficulty).mockReturnValue(3);
  vi.mocked(isSelfContained).mockResolvedValue(true);

  vi.mocked(computeBandCoverage).mockReturnValue(bandCoverage as never);
  vi.mocked(extractTopicTags).mockReturnValue(["technology", "general"]);

  const singleMock = vi
    .fn()
    .mockResolvedValue({ data: { id: "seg-1" }, error: null });
  const selectMock = vi.fn().mockReturnValue({ single: singleMock });
  const insertMock = vi.fn().mockReturnValue({ select: selectMock });
  vi.mocked(createAdminClient).mockReturnValue({
    from: vi.fn().mockReturnValue({ insert: insertMock }),
  } as never);

  return { singleMock, selectMock, insertMock };
}

describe("POST /api/admin/premium/ingest — Phase 4 (script_clean, il, subtitle_dependency_stage)", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.SEGMENT_MIN_SECONDS = "60";
    process.env.SEGMENT_MAX_SECONDS = "120";
  });

  it("AC-003-1: persists a non-empty script_clean built from the segment's transcript lines", async () => {
    const { insertMock } = setupDefaultMocks({
      beginner: 0.99,
      basic: 0.99,
      conversation: 0.99,
      professional: 0.99,
    });

    await POST(makeAdminRequest() as never);

    for (const [payload] of insertMock.mock.calls) {
      const { script_clean } = payload as { script_clean: string };
      expect(typeof script_clean).toBe("string");
      expect(script_clean.length).toBeGreaterThan(0);
      // Reading-ready text should not retain raw line-array structure
      expect(script_clean).toContain("Hello world today");
    }
  });

  it("AC-003-3: subtitle_dependency_stage reflects listening-gate pass (0) at 99% coverage", async () => {
    const { insertMock } = setupDefaultMocks({
      beginner: 0.99,
      basic: 0.99,
      conversation: 0.99,
      professional: 0.99,
    });

    await POST(makeAdminRequest() as never);

    for (const [payload] of insertMock.mock.calls) {
      const { subtitle_dependency_stage } = payload as {
        subtitle_dependency_stage: number;
      };
      expect(subtitle_dependency_stage).toBe(0);
    }
  });

  it("AC-003-3: subtitle_dependency_stage reflects listening-gate fail (1, RWL-required) at 96% coverage (passes reading's bar but not listening's)", async () => {
    const { insertMock } = setupDefaultMocks({
      beginner: 0.96,
      basic: 0.96,
      conversation: 0.96,
      professional: 0.96,
    });

    await POST(makeAdminRequest() as never);

    for (const [payload] of insertMock.mock.calls) {
      const { subtitle_dependency_stage } = payload as {
        subtitle_dependency_stage: number;
      };
      expect(subtitle_dependency_stage).toBe(1);
    }
  });

  it("persists an il value derived from difficultyScore, within the 1.0-7.0 invariant range", async () => {
    const { insertMock } = setupDefaultMocks({
      beginner: 0.9,
      basic: 0.9,
      conversation: 0.9,
      professional: 0.9,
    });

    await POST(makeAdminRequest() as never);

    for (const [payload] of insertMock.mock.calls) {
      const { il } = payload as { il: number };
      expect(typeof il).toBe("number");
      expect(il).toBeGreaterThanOrEqual(1.0);
      expect(il).toBeLessThanOrEqual(7.0);
    }
  });
});
