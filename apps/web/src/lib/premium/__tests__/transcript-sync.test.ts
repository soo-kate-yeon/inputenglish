/**
 * SPEC-WEB-001 Phase 5 — Task 5.3: web transcript-to-playback-time sync.
 *
 * Re-implements (does NOT copy) the synchronization logic pattern from
 * apps/mobile/src/lib/premium-transcript-sync.ts for a web iframe player
 * context, operating on VideoSegment's TranscriptLine[] shape
 * ({ start, end, text }) rather than mobile's PremiumTranscriptLine
 * ({ id, startTime, endTime }).
 */
import { describe, expect, it } from "vitest";
import type { TranscriptLine } from "@inputenglish/shared";
import {
  findActiveTranscriptLine,
  getTranscriptScrollIndex,
  TRANSCRIPT_SYNC_INTERVAL_MS,
} from "../transcript-sync";

const lines: TranscriptLine[] = [
  { start: 0, end: 5, text: "Hello there." },
  { start: 5, end: 10, text: "This is the news." },
  { start: 10, end: 15, text: "Thanks for watching." },
];

describe("findActiveTranscriptLine", () => {
  it("returns the line whose [start, end] window contains currentTime", () => {
    expect(findActiveTranscriptLine(lines, 6)?.text).toBe("This is the news.");
  });

  it("returns null when currentTime is outside all line windows", () => {
    expect(findActiveTranscriptLine(lines, 999)).toBeNull();
  });

  it("returns null for an empty transcript", () => {
    expect(findActiveTranscriptLine([], 5)).toBeNull();
  });
});

describe("getTranscriptScrollIndex", () => {
  it("returns the index of the active line by matching start/end/text identity", () => {
    const index = getTranscriptScrollIndex(lines, lines[1]);
    expect(index).toBe(1);
  });

  it("returns 0 when activeLine is null", () => {
    expect(getTranscriptScrollIndex(lines, null)).toBe(0);
  });

  it("returns 0 when activeLine is not found in lines", () => {
    expect(
      getTranscriptScrollIndex(lines, { start: 99, end: 100, text: "x" }),
    ).toBe(0);
  });
});

describe("TRANSCRIPT_SYNC_INTERVAL_MS", () => {
  it("is a positive polling interval in milliseconds", () => {
    expect(TRANSCRIPT_SYNC_INTERVAL_MS).toBeGreaterThan(0);
  });
});
