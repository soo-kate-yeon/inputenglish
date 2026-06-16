import { describe, expect, it } from "vitest";
import {
  buildQuestionPrompt,
  extractLineContext,
  extractSentenceContext,
} from "../lib/premium-question-prompt";

describe("extractSentenceContext", () => {
  const body =
    "Climate change is a global challenge. Scientists report rising temperatures. Action is needed now.";

  // offset of the first character of `word`'s nth occurrence within `body`.
  const offsetOf = (text: string, word: string, nth = 0): number => {
    let idx = -1;
    for (let i = 0; i <= nth; i += 1) idx = text.indexOf(word, idx + 1);
    return idx;
  };

  it("returns the tapped sentence plus one neighbor on each side", () => {
    const ctx = extractSentenceContext(body, offsetOf(body, "Scientists"));
    expect(ctx).toBe(
      "Climate change is a global challenge. Scientists report rising temperatures. Action is needed now.",
    );
  });

  it("clamps the window at the start of the text", () => {
    const ctx = extractSentenceContext(body, offsetOf(body, "Climate"));
    expect(ctx).toBe(
      "Climate change is a global challenge. Scientists report rising temperatures.",
    );
  });

  it("resolves repeated words to the exact tapped occurrence (window 0)", () => {
    const repeated = "I run daily. The run was long. We run again.";
    expect(
      extractSentenceContext(repeated, offsetOf(repeated, "run", 0), {
        window: 0,
      }),
    ).toBe("I run daily.");
    expect(
      extractSentenceContext(repeated, offsetOf(repeated, "run", 1), {
        window: 0,
      }),
    ).toBe("The run was long.");
    expect(
      extractSentenceContext(repeated, offsetOf(repeated, "run", 2), {
        window: 0,
      }),
    ).toBe("We run again.");
  });

  it("returns the whole text when there is no sentence boundary", () => {
    expect(extractSentenceContext("Scientists study climate data", 0)).toBe(
      "Scientists study climate data",
    );
  });

  it("clamps an out-of-range offset to the last sentence", () => {
    expect(extractSentenceContext(body, 9999, { window: 0 })).toBe(
      "Action is needed now.",
    );
  });

  it("returns undefined for empty text", () => {
    expect(extractSentenceContext("", 0)).toBeUndefined();
    expect(extractSentenceContext("   ", 0)).toBeUndefined();
  });
});

describe("extractLineContext", () => {
  const lines = ["Hello everyone", "today we explore", "the universe together"];

  it("returns the tapped line plus one neighbor on each side", () => {
    expect(extractLineContext(lines, 1)).toBe(
      "Hello everyone today we explore the universe together",
    );
  });

  it("clamps the window at the boundaries", () => {
    expect(extractLineContext(lines, 0)).toBe(
      "Hello everyone today we explore",
    );
    expect(extractLineContext(lines, 2)).toBe(
      "today we explore the universe together",
    );
  });

  it("supports a custom window of 0 (tapped line only)", () => {
    expect(extractLineContext(lines, 1, { window: 0 })).toBe(
      "today we explore",
    );
  });

  it("returns undefined for out-of-range or empty input", () => {
    expect(extractLineContext(lines, -1)).toBeUndefined();
    expect(extractLineContext(lines, 5)).toBeUndefined();
    expect(extractLineContext([], 0)).toBeUndefined();
  });
});

describe("buildQuestionPrompt", () => {
  it("omits the context block when no context is provided", () => {
    const prompt = buildQuestionPrompt({
      highlightText: "run",
      question: "이게 무슨 뜻이야?",
    });
    expect(prompt).not.toContain("문맥 (이 하이라이트가 등장한 원문)");
    expect(prompt).toContain("'run'");
  });

  it("includes the context block when context is provided", () => {
    const prompt = buildQuestionPrompt({
      highlightText: "run the gamut",
      question: "이게 무슨 뜻이야?",
      context: "Prices run the gamut from cheap to luxury.",
    });
    expect(prompt).toContain("문맥 (이 하이라이트가 등장한 원문)");
    expect(prompt).toContain("Prices run the gamut from cheap to luxury.");
  });

  it("instructs the model to answer in Korean only, never English", () => {
    const prompt = buildQuestionPrompt({
      highlightText: "run",
      question: "이게 무슨 뜻이야?",
    });
    expect(prompt).toContain("절대 영어로 답하지 마");
  });
});
