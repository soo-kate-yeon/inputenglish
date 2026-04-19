import { describe, expect, it } from "vitest";
import { normalizeAzurePronunciationResult } from "./normalize";

describe("normalizeAzurePronunciationResult", () => {
  it("maps Azure pronunciation payload into app feedback", () => {
    const result = normalizeAzurePronunciationResult({
      referenceText: "Thanks for joining us today.",
      providerLocale: "en-US",
      payload: {
        NBest: [
          {
            Display: "Thanks for joining us today.",
            PronunciationAssessment: {
              AccuracyScore: 82,
              FluencyScore: 61,
              CompletenessScore: 96,
              ProsodyScore: 64,
            },
            Words: [
              {
                Word: "Thanks",
                ErrorType: "None",
                PronunciationAssessment: { AccuracyScore: 90 },
              },
              {
                Word: "joining",
                ErrorType: "Mispronunciation",
                PronunciationAssessment: { AccuracyScore: 58 },
              },
            ],
          },
        ],
      },
    });

    expect(result.status).toBe("complete");
    expect(result.provider).toBe("azure");
    expect(result.reference_text).toBe("Thanks for joining us today.");
    expect(result.recognized_text).toBe("Thanks for joining us today.");
    expect(result.fluency_score).toBe(61);
    expect(result.prosody_score).toBe(64);
    expect(result.pacing_note).toContain("천천히");
    expect(result.stress_note).toContain("강세");
    expect(result.clarity_note).toContain("joining");
    expect(result.next_focus).toBe("핵심 단어 강세");
    expect(result.word_issues?.[1]?.word).toBe("joining");
  });

  it("falls back gracefully when prosody details are missing", () => {
    const result = normalizeAzurePronunciationResult({
      referenceText: "We should talk next week.",
      providerLocale: "en-US",
      payload: {
        NBest: [
          {
            Display: "We should talk next week.",
            PronunciationAssessment: {
              AccuracyScore: 79,
              FluencyScore: 84,
              CompletenessScore: 100,
            },
            Words: [],
          },
        ],
      },
    });

    expect(result.status).toBe("complete");
    expect(result.prosody_score).toBeNull();
    expect(result.summary).toBeTruthy();
    expect(result.next_focus).toBe("문장 첫머리 리듬");
  });
});
