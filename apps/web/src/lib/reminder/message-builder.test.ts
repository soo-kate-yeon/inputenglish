/**
 * TDD tests for Task 7.2 — reminder message builder (SPEC-WEB-001 Phase 7)
 *
 * RED -> GREEN -> REFACTOR
 *
 * Covers AC-007-2 (value-complete — one expression + one sentence reach the
 * user even without a click) and EC-007-C (informational tone — no
 * promotional/sales call-to-action language, since 알림톡 promotional
 * templates require separate review from informational ones).
 */
import { describe, expect, it } from "vitest";
import { buildReminderMessage } from "./message-builder";

const PROMO_PATTERNS = [
  "지금 가입",
  "지금 시작",
  "할인",
  "무료체험",
  "이벤트",
  "쿠폰",
  "특가",
  "한정",
];

describe("buildReminderMessage", () => {
  it("leads with topic curiosity before the expression/sentence payload (AC-007-1 tone)", () => {
    const result = buildReminderMessage({
      topicTeaser: "BBC에서 이런 일이 있었는데",
      expression: "break the ice",
      sourceSentence: "She told a joke to break the ice.",
      sourceLabel: "BBC Learning English",
    });

    const teaserIndex = result.indexOf("BBC에서 이런 일이 있었는데");
    const expressionIndex = result.indexOf("break the ice");
    expect(teaserIndex).toBeGreaterThanOrEqual(0);
    expect(expressionIndex).toBeGreaterThan(teaserIndex);
  });

  it("is value-complete: contains one expression and one full sentence even without a click (AC-007-2)", () => {
    const result = buildReminderMessage({
      topicTeaser: "오늘 CNN10에서 이런 소식이",
      expression: "turn the tables",
      sourceSentence:
        "The underdog team turned the tables in the final minutes.",
      sourceLabel: "CNN10",
    });

    expect(result).toContain("turn the tables");
    expect(result).toContain(
      "The underdog team turned the tables in the final minutes.",
    );
  });

  it("does not contain promotional/sales call-to-action language (EC-007-C)", () => {
    const result = buildReminderMessage({
      topicTeaser: "오늘 VOA에서 이런 일이",
      expression: "a game changer",
      sourceSentence: "The new policy was a game changer for the industry.",
      sourceLabel: "VOA",
    });

    for (const pattern of PROMO_PATTERNS) {
      expect(result).not.toContain(pattern);
    }
  });

  it("includes the source label for context without extra generation", () => {
    const result = buildReminderMessage({
      topicTeaser: "오늘 BBC에서 이런 일이",
      expression: "break the ice",
      sourceSentence: "She told a joke to break the ice.",
      sourceLabel: "BBC Learning English",
    });

    expect(result).toContain("BBC Learning English");
  });
});
