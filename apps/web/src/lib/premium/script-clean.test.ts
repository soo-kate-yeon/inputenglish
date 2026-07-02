import { describe, expect, it } from "vitest";
import { buildScriptClean } from "./script-clean";
import type { TranscriptLine } from "@inputenglish/shared";

describe("buildScriptClean (REQ-WEB-003-U2, D7, AC-003-1)", () => {
  it("joins transcript lines into a single reading-ready clean script", () => {
    const lines: TranscriptLine[] = [
      { start: 0, end: 2, text: "Hello everyone," },
      { start: 2, end: 5, text: "welcome back to the show." },
    ];

    const result = buildScriptClean(lines);

    expect(result).toBe("Hello everyone, welcome back to the show.");
  });

  it("strips timestamp-like artifacts embedded in line text", () => {
    const lines: TranscriptLine[] = [
      { start: 0, end: 2, text: "[00:01] Hello there." },
    ];

    const result = buildScriptClean(lines);

    expect(result).toBe("Hello there.");
  });

  it("strips speaker-tag artifacts like 'SPEAKER 1:' prefixes", () => {
    const lines: TranscriptLine[] = [
      { start: 0, end: 2, text: "SPEAKER 1: Thanks for joining us." },
      { start: 2, end: 4, text: "HOST: Great to be here." },
    ];

    const result = buildScriptClean(lines);

    expect(result).toBe("Thanks for joining us. Great to be here.");
  });

  it("strips filler artifacts like [Music] and [Applause]", () => {
    const lines: TranscriptLine[] = [
      { start: 0, end: 2, text: "[Music] Let's get started." },
      { start: 2, end: 4, text: "That was great! [Applause]" },
    ];

    const result = buildScriptClean(lines);

    expect(result).toBe("Let's get started. That was great!");
  });

  it("collapses whitespace and returns an empty string for no lines", () => {
    expect(buildScriptClean([])).toBe("");
  });
});
