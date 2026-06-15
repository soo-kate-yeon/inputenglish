import { describe, expect, it } from "vitest";

// These imports will fail until segment-scorer.ts is implemented (RED state)
import {
  calculateWpm,
  scoreSegmentDifficulty,
  isSelfContained,
} from "../segment-scorer";

import type { TranscriptLine } from "@inputenglish/shared";

describe("calculateWpm", () => {
  it("returns ~130 wpm for 130 words over 60 seconds", () => {
    const text = "word ".repeat(130).trim();
    const lines: TranscriptLine[] = [{ start: 0, end: 60, text }];
    const result = calculateWpm(lines);
    // 130 words / 60s * 60 = 130 wpm
    expect(result).toBe(130);
  });

  it("returns 0 when fewer than 2 lines and duration cannot be determined from single line", () => {
    // single line with start == end => duration is 0 => wpm should handle gracefully
    const lines: TranscriptLine[] = [{ start: 0, end: 0, text: "hello world" }];
    expect(calculateWpm(lines)).toBe(0);
  });

  it("returns 0 for empty array", () => {
    expect(calculateWpm([])).toBe(0);
  });

  it("calculates correctly across multiple lines", () => {
    // 2 lines, 10 words each, from 0 to 30 seconds => 20 words / 30s * 60 = 40 wpm
    const lines: TranscriptLine[] = [
      {
        start: 0,
        end: 15,
        text: "one two three four five six seven eight nine ten",
      },
      {
        start: 15,
        end: 30,
        text: "one two three four five six seven eight nine ten",
      },
    ];
    expect(calculateWpm(lines)).toBe(40);
  });
});

describe("scoreSegmentDifficulty", () => {
  it("returns 3 for mid-range wpm (130) and low-mid unknown ratio (0.03)", () => {
    // wpmScore for 130: 3 (120 <= 130 < 140)
    // coverageScore for 0.03: 3 (0.02 < 0.03 <= 0.05)
    // average: (3+3)/2 = 3
    expect(scoreSegmentDifficulty(130, 0.03)).toBe(3);
  });

  it("returns 5 for very fast wpm (170) and high unknown ratio (0.12)", () => {
    // wpmScore for 170: 5 (>= 160)
    // coverageScore for 0.12: 5 (> 0.10)
    // average: (5+5)/2 = 5
    expect(scoreSegmentDifficulty(170, 0.12)).toBe(5);
  });

  it("returns 1 for very slow wpm (80) and very low unknown ratio (0.005)", () => {
    // wpmScore for 80: 1 (< 100)
    // coverageScore for 0.005: 1 (<= 0.01)
    // average: (1+1)/2 = 1
    expect(scoreSegmentDifficulty(80, 0.005)).toBe(1);
  });

  it("returns 2 for slow wpm (105) and low unknown ratio (0.015)", () => {
    // wpmScore for 105: 2 (100 <= 105 < 120)
    // coverageScore for 0.015: 2 (0.01 < 0.015 <= 0.02)
    // average: (2+2)/2 = 2
    expect(scoreSegmentDifficulty(105, 0.015)).toBe(2);
  });

  it("rounds the average to nearest integer", () => {
    // wpmScore for 130: 3, coverageScore for 0.015: 2 => (3+2)/2 = 2.5 => rounds to 3
    expect(scoreSegmentDifficulty(130, 0.015)).toBe(3);
  });
});

describe("isSelfContained", () => {
  it("returns true for a clean opener with no dangling references", () => {
    return expect(
      isSelfContained("Hello everyone, today we explore the universe."),
    ).resolves.toBe(true);
  });

  it("returns false when opener contains a dangling reference like 'as i mentioned earlier'", () => {
    return expect(
      isSelfContained("As I mentioned earlier, that one approach failed."),
    ).resolves.toBe(false);
  });

  it("returns false for 'that one' reference in opener", () => {
    return expect(
      isSelfContained("That one is the key concept we need to revisit."),
    ).resolves.toBe(false);
  });

  it("returns false for 'as we saw' in opener", () => {
    return expect(
      isSelfContained("As we saw previously, the results were clear."),
    ).resolves.toBe(false);
  });

  it("returns true for a transcript that starts with a proper introduction", () => {
    return expect(
      isSelfContained(
        "Welcome back! Today we're going to talk about photosynthesis. Plants use sunlight to make food.",
      ),
    ).resolves.toBe(true);
  });
});
