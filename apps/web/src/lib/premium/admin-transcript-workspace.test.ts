import { describe, expect, it } from "vitest";
import {
  attachPremiumTranscriptToDraft,
  applyPremiumTranscriptTranslations,
  getPremiumTranscriptStats,
  parsePremiumTranscriptJson,
  shiftPremiumTranscriptTiming,
  stringifyPremiumTranscript,
  updatePremiumTranscriptLine,
} from "./admin-transcript-workspace";

const lines = [
  {
    id: "line-1",
    text: " Thank you for having me here. ",
    startTime: 1,
    endTime: 3,
  },
  {
    id: "line-2",
    text: "I had the privilege of working with this team.",
    startTime: 5,
    endTime: 8,
  },
];

describe("premium admin transcript workspace helpers", () => {
  it("parses transcript JSON with the premium line schema", () => {
    const result = parsePremiumTranscriptJson(JSON.stringify(lines));

    expect(result.error).toBeNull();
    expect(result.lines).toHaveLength(2);
    expect(result.lines[0].text).toBe(" Thank you for having me here. ");
  });

  it("reports invalid transcript JSON without throwing", () => {
    const result = parsePremiumTranscriptJson("{");

    expect(result.lines).toEqual([]);
    expect(result.error).toContain("Expected property name");
  });

  it("shifts timing while keeping line duration when negative offsets clamp", () => {
    expect(shiftPremiumTranscriptTiming(lines, -2)).toEqual([
      {
        id: "line-1",
        text: "Thank you for having me here.",
        startTime: 0,
        endTime: 1,
      },
      {
        id: "line-2",
        text: "I had the privilege of working with this team.",
        startTime: 3,
        endTime: 6,
      },
    ]);
  });

  it("updates a single line and normalizes text", () => {
    const updated = updatePremiumTranscriptLine(lines, "line-1", {
      translation: "오늘 초대해 주셔서 감사합니다.",
      startTime: 1.234,
    });

    expect(updated[0]).toMatchObject({
      text: "Thank you for having me here.",
      translation: "오늘 초대해 주셔서 감사합니다.",
      startTime: 1.23,
    });
  });

  it("merges translations by line index", () => {
    expect(
      applyPremiumTranscriptTranslations(lines, [
        "오늘 초대해 주셔서 감사합니다.",
        "이 팀과 함께할 수 있어 영광이었어요.",
      ]),
    ).toEqual([
      expect.objectContaining({
        translation: "오늘 초대해 주셔서 감사합니다.",
      }),
      expect.objectContaining({
        translation: "이 팀과 함께할 수 있어 영광이었어요.",
      }),
    ]);
  });

  it("summarizes transcript readiness", () => {
    const translated = applyPremiumTranscriptTranslations(lines, [
      "오늘 초대해 주셔서 감사합니다.",
    ]);

    expect(getPremiumTranscriptStats(translated)).toEqual({
      count: 2,
      translatedCount: 1,
      startTime: 1,
      endTime: 8,
      durationSeconds: 7,
    });
  });

  it("stringifies transcript lines for draft input", () => {
    expect(stringifyPremiumTranscript(lines)).toContain('"line-1"');
  });

  it("attaches the edited transcript workspace to the draft payload", () => {
    const draft = {
      title: "Sample draft",
      source_video_id: "old-video",
      transcript: [{ id: "old", text: "old", startTime: 0, endTime: 1 }],
    };

    const attached = attachPremiumTranscriptToDraft({
      draft,
      lines,
      sourceUrl: "https://www.youtube.com/watch?v=G96-xYqw0rQ",
      title: "Jonny Kim | Harvard Alumni Day 2026",
      durationSeconds: 909,
    });

    expect(attached).toMatchObject({
      title: "Jonny Kim | Harvard Alumni Day 2026",
      source_url: "https://www.youtube.com/watch?v=G96-xYqw0rQ",
      source_video_id: "G96-xYqw0rQ",
      thumbnail_url: "https://img.youtube.com/vi/G96-xYqw0rQ/hqdefault.jpg",
      duration_seconds: 909,
      segment_start_time: 1,
      segment_end_time: 8,
    });
    expect(attached.transcript).toHaveLength(2);
    expect(attached.transcript[0].text).toBe("Thank you for having me here.");
  });
});
