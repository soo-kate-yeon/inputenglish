import { describe, it, expect } from "vitest";
import {
  getCapStatus,
  selectQuestionModel,
  MONTHLY_QUESTION_CAP,
} from "../question-cap";

describe("question-cap", () => {
  describe("MONTHLY_QUESTION_CAP", () => {
    it("should be 100", () => {
      expect(MONTHLY_QUESTION_CAP).toBe(100);
    });
  });

  describe("getCapStatus", () => {
    it("returns correct remaining and no notice when under cap", () => {
      const result = getCapStatus(50);
      expect(result.remaining).toBe(50);
      expect(result.isExceeded).toBe(false);
      expect(result.notice).toBeUndefined();
    });

    it("returns low-count notice when remaining <= 10", () => {
      const result = getCapStatus(95);
      expect(result.remaining).toBe(5);
      expect(result.isExceeded).toBe(false);
      expect(result.notice).toBe("이번 달 질문 5개 남음");
    });

    it("returns exceeded notice when count == 100", () => {
      const result = getCapStatus(100);
      expect(result.remaining).toBe(0);
      expect(result.isExceeded).toBe(true);
      expect(result.notice).toContain("모두 사용");
    });

    it("returns exceeded notice when count > 100", () => {
      const result = getCapStatus(105);
      expect(result.remaining).toBe(0);
      expect(result.isExceeded).toBe(true);
      expect(result.notice).toContain("모두 사용");
    });

    it("returns remaining=10 and notice when exactly 10 remaining", () => {
      const result = getCapStatus(90);
      expect(result.remaining).toBe(10);
      expect(result.isExceeded).toBe(false);
      expect(result.notice).toBe("이번 달 질문 10개 남음");
    });

    it("returns no notice when 11 remaining (just above threshold)", () => {
      const result = getCapStatus(89);
      expect(result.remaining).toBe(11);
      expect(result.notice).toBeUndefined();
    });

    it("returns no notice and correct remaining when count is 0", () => {
      const result = getCapStatus(0);
      expect(result.remaining).toBe(100);
      expect(result.isExceeded).toBe(false);
      expect(result.notice).toBeUndefined();
    });
  });

  describe("selectQuestionModel", () => {
    it("returns flash for a short question when cap not exceeded", () => {
      const result = selectQuestionModel("short", false);
      expect(result).toBe("gemini-2.5-flash");
    });

    it("returns pro when question length > 200 chars", () => {
      const longQuestion = "why does this happen? " + "x".repeat(200);
      const result = selectQuestionModel(longQuestion, false);
      expect(result).toBe("gemini-2.5-pro");
    });

    it("returns pro when question contains 'explain'", () => {
      const result = selectQuestionModel(
        "Can you explain this expression?",
        false,
      );
      expect(result).toBe("gemini-2.5-pro");
    });

    it("returns pro when question contains 'why'", () => {
      const result = selectQuestionModel("Why is this used here?", false);
      expect(result).toBe("gemini-2.5-pro");
    });

    it("returns pro when question contains 'how does'", () => {
      const result = selectQuestionModel("How does this grammar work?", false);
      expect(result).toBe("gemini-2.5-pro");
    });

    it("returns pro when question contains 'what causes'", () => {
      const result = selectQuestionModel("What causes this change?", false);
      expect(result).toBe("gemini-2.5-pro");
    });

    it("forces flash (demotion) when cap is exceeded regardless of question complexity", () => {
      const complexQuestion = "why does " + "x".repeat(300);
      const result = selectQuestionModel(complexQuestion, true);
      expect(result).toBe("gemini-2.5-flash");
    });

    it("forces flash for any question when cap is exceeded", () => {
      const result = selectQuestionModel("any question", true);
      expect(result).toBe("gemini-2.5-flash");
    });
  });
});
