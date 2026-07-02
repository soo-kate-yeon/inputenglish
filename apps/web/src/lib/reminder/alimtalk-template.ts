// @MX:NOTE: [AUTO] Alimtalk template pre-review fixture — documents (does not submit) the
//   exact message text that would go to Solapi's 알림톡 template review queue.
// @MX:REASON: Task 7.4 is an operational/business process (submitting a message template
//   to Solapi's review dashboard/API), not a testable code artifact. Real submission is a
//   manual/external step requiring human review before an Alimtalk template can be used —
//   this module intentionally does NOT call any real Solapi template-registration API in
//   tests or code. It only fixes a representative example built via Task 7.2's message
//   builder, so the fixture and the runtime message stay in sync (single source of truth).
// @MX:SPEC: SPEC-WEB-001 Phase 7 Task 7.4 (REQ-WEB-007, EC-007-C)
import {
  buildReminderMessage,
  type ReminderMessageInput,
} from "./message-builder";

export { buildReminderMessage };

export interface AlimtalkTemplatePreReviewFixture {
  /** The exact input used to build the representative sample template text. */
  sampleInput: ReminderMessageInput;
  /** The rendered message text as it would be submitted for Solapi's review. */
  sampleText: string;
  /**
   * Documents that actual submission to Solapi's template review queue is a
   * manual/external step (human review required) — never performed by code.
   */
  submissionStatus: "manual_external_step_required";
}

const SAMPLE_INPUT: ReminderMessageInput = {
  topicTeaser: "오늘 BBC Learning English에서 이런 일이 있었는데",
  expression: "break the ice",
  sourceSentence: "She told a joke to break the ice at the meeting.",
  sourceLabel: "BBC Learning English",
};

/**
 * Fixed representative example of what would be submitted to Solapi's
 * Alimtalk template pre-review queue (via their dashboard or API — not
 * implemented here). This is documentation/fixture only.
 */
export const ALIMTALK_TEMPLATE_PRE_REVIEW_FIXTURE: AlimtalkTemplatePreReviewFixture =
  {
    sampleInput: SAMPLE_INPUT,
    sampleText: buildReminderMessage(SAMPLE_INPUT),
    submissionStatus: "manual_external_step_required",
  };
