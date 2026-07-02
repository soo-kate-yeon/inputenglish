/**
 * TDD tests for Task 7.4 — Alimtalk template pre-review fixture (SPEC-WEB-001 Phase 7)
 *
 * RED -> GREEN -> REFACTOR
 *
 * This documents (does not submit) the exact template text that would be
 * sent to Solapi's 알림톡 template review queue. Actual submission is a
 * manual/external step (Solapi requires human review before an Alimtalk
 * template can be used) — no real template-registration API is called here.
 */
import { describe, expect, it } from "vitest";
import {
  ALIMTALK_TEMPLATE_PRE_REVIEW_FIXTURE,
  buildReminderMessage,
} from "./alimtalk-template";

describe("ALIMTALK_TEMPLATE_PRE_REVIEW_FIXTURE", () => {
  it("is built from Task 7.2's message builder (single source of truth)", () => {
    const rebuilt = buildReminderMessage(
      ALIMTALK_TEMPLATE_PRE_REVIEW_FIXTURE.sampleInput,
    );
    expect(ALIMTALK_TEMPLATE_PRE_REVIEW_FIXTURE.sampleText).toBe(rebuilt);
  });

  it("documents that submission is a manual/external step", () => {
    expect(ALIMTALK_TEMPLATE_PRE_REVIEW_FIXTURE.submissionStatus).toBe(
      "manual_external_step_required",
    );
  });

  it("contains no promotional/sales call-to-action language (EC-007-C)", () => {
    const promoPatterns = [
      "지금 가입",
      "지금 시작",
      "할인",
      "무료체험",
      "이벤트",
      "쿠폰",
    ];
    for (const pattern of promoPatterns) {
      expect(ALIMTALK_TEMPLATE_PRE_REVIEW_FIXTURE.sampleText).not.toContain(
        pattern,
      );
    }
  });
});
