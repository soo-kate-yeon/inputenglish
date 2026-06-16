/**
 * Integration tests for Phase 1 ingest route changes.
 *
 * TDD cycle: RED → GREEN → REFACTOR
 *
 * Tests cover:
 * - AC-001-2: translation filled on every transcript line
 * - AC-001-3: band_coverage non-empty, topic_tags non-empty
 * - EC-001-A: partial failure isolation
 * - EC-001-C: CRON_SECRET auth path
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
import { NextResponse } from "next/server";

// ── import route AFTER mocks ───────────────────────────────────────────────────
import { POST } from "@/app/api/admin/premium/ingest/route";

// ── helpers ───────────────────────────────────────────────────────────────────
// Valid UUID v4 (required by Zod's strict UUID validation)
const CHANNEL_ID = "a1b2c3d4-e5f6-47a8-b9c0-d1e2f3a4b5c6";
const VIDEO_ID = "test-video-id";

function makeAdminRequest(videoId = VIDEO_ID) {
  return new Request("http://localhost/api/admin/premium/ingest", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, channelId: CHANNEL_ID }),
  });
}

function makeCronRequest(videoId = VIDEO_ID, cronSecret = "test-cron-secret") {
  return new Request("http://localhost/api/admin/premium/ingest", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-cron-secret": cronSecret,
    },
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

const DEFAULT_BAND_COVERAGE = {
  beginner: 0.8,
  basic: 0.6,
  conversation: 0.4,
  professional: 0.2,
};

function setupDefaultMocks() {
  // Admin auth succeeds by default
  vi.mocked(requireAdmin).mockResolvedValue({
    id: "admin-1",
    email: "a@b.com",
  } as never);

  // Transcript
  vi.mocked(loadTranscriptWithYtDlp).mockResolvedValue({
    transcript: MOCK_TRANSCRIPT,
  } as never);

  // Translation: fixture mode — return "[ko] {text}" per line
  vi.mocked(translateLines).mockImplementation(async (texts: string[]) =>
    texts.map((t) => `[ko] ${t}`),
  );

  // Scoring
  vi.mocked(calculateWpm).mockReturnValue(120);
  vi.mocked(scoreSegmentDifficulty).mockReturnValue(3);
  vi.mocked(isSelfContained).mockResolvedValue(true);

  // Band coverage / topics
  vi.mocked(computeBandCoverage).mockReturnValue(DEFAULT_BAND_COVERAGE);
  vi.mocked(extractTopicTags).mockReturnValue(["technology", "general"]);

  // Supabase: insert succeeds
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

// ── test suite ────────────────────────────────────────────────────────────────
describe("POST /api/admin/premium/ingest — Phase 1", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test-cron-secret";
    process.env.SEGMENT_MIN_SECONDS = "60";
    process.env.SEGMENT_MAX_SECONDS = "120";
  });

  // ── AC-001-2: translation fill ──────────────────────────────────────────────
  it("AC-001-2: persists transcript lines with translation field filled", async () => {
    const { insertMock } = setupDefaultMocks();

    const response = await POST(makeAdminRequest() as never);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.count).toBeGreaterThan(0);

    // Every insert call must have transcript lines with non-empty translation
    const insertCalls = insertMock.mock.calls;
    expect(insertCalls.length).toBeGreaterThan(0);

    for (const [payload] of insertCalls) {
      const { transcript } = payload as {
        transcript: Array<{ translation?: string }>;
      };
      expect(Array.isArray(transcript)).toBe(true);
      expect(transcript.length).toBeGreaterThan(0);
      for (const line of transcript) {
        expect(line.translation).toBeDefined();
        expect(typeof line.translation).toBe("string");
        expect(line.translation!.length).toBeGreaterThan(0);
      }
    }
  });

  // ── AC-001-3: band_coverage non-empty ────────────────────────────────────
  it("AC-001-3: persists non-empty band_coverage (not {})", async () => {
    const { insertMock } = setupDefaultMocks();

    await POST(makeAdminRequest() as never);

    for (const [payload] of insertMock.mock.calls) {
      const { band_coverage } = payload as {
        band_coverage: Record<string, number>;
      };
      expect(band_coverage).not.toEqual({});
      expect(Object.keys(band_coverage).length).toBeGreaterThan(0);
    }
  });

  // ── AC-001-3: topic_tags non-empty ────────────────────────────────────────
  it("AC-001-3: persists non-empty topic_tags (not [])", async () => {
    const { insertMock } = setupDefaultMocks();

    await POST(makeAdminRequest() as never);

    for (const [payload] of insertMock.mock.calls) {
      const { topic_tags } = payload as { topic_tags: string[] };
      expect(Array.isArray(topic_tags)).toBe(true);
      expect(topic_tags.length).toBeGreaterThan(0);
    }
  });

  // ── EC-001-A: partial failure isolation ───────────────────────────────────
  it("EC-001-A: one segment DB insert failure does not abort the whole ingest", async () => {
    setupDefaultMocks();

    // Override DB to fail first insert, succeed second
    const singleMock = vi
      .fn()
      .mockResolvedValueOnce({ data: null, error: { message: "DB error" } })
      .mockResolvedValue({ data: { id: "seg-ok" }, error: null });
    const selectMock = vi.fn().mockReturnValue({ single: singleMock });
    const insertMock = vi.fn().mockReturnValue({ select: selectMock });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: insertMock }),
    } as never);

    // Use a transcript that generates exactly 2 segments (>120s total)
    vi.mocked(loadTranscriptWithYtDlp).mockResolvedValue({
      transcript: [
        ...MOCK_TRANSCRIPT,
        { id: "8", text: "Second segment starts", startTime: 70, endTime: 80 },
        { id: "9", text: "More content here", startTime: 80, endTime: 90 },
        { id: "10", text: "And more content", startTime: 90, endTime: 100 },
        { id: "11", text: "Still going strong", startTime: 100, endTime: 110 },
        { id: "12", text: "Almost done now", startTime: 110, endTime: 125 },
        { id: "13", text: "Final words here", startTime: 125, endTime: 135 },
      ],
    } as never);

    const response = await POST(makeAdminRequest() as never);
    const body = await response.json();

    // Should complete without crashing
    expect(response.status).toBe(200);
    expect(Array.isArray(body.inserted)).toBe(true);
    // At least one segment should succeed (not all fail)
  });

  // ── EC-001-C: CRON_SECRET auth path ──────────────────────────────────────
  it("EC-001-C: accepts ingest with valid x-cron-secret header", async () => {
    setupDefaultMocks();
    // Admin auth fails → cron secret path should work
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as never,
    );

    const response = await POST(makeCronRequest() as never);
    expect(response.status).toBe(200);
  });

  it("EC-001-C: rejects ingest with invalid CRON_SECRET", async () => {
    setupDefaultMocks();
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as never,
    );

    const response = await POST(
      makeCronRequest(VIDEO_ID, "wrong-secret") as never,
    );
    expect([401, 403]).toContain(response.status);
  });

  it("EC-001-C: rejects request with no auth and no cron secret", async () => {
    setupDefaultMocks();
    vi.mocked(requireAdmin).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }) as never,
    );

    const request = new Request("http://localhost/api/admin/premium/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ videoId: VIDEO_ID, channelId: CHANNEL_ID }),
    });

    const response = await POST(request as never);
    expect([401, 403]).toContain(response.status);
  });

  // ── Admin auth happy path ─────────────────────────────────────────────────
  it("accepts ingest from authenticated admin (legacy path)", async () => {
    setupDefaultMocks();

    const response = await POST(makeAdminRequest() as never);
    expect(response.status).toBe(200);
  });
});
