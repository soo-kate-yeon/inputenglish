// @MX:ANCHOR: [AUTO] Pure reminder message body builder — topic-curiosity-first, value-complete.
// @MX:REASON: [AUTO] Implements REQ-WEB-007-U1/U2 and D10: the message must lead with topic
//   curiosity ("오늘 BBC에서 이런 일이—" style) and be value-complete (AC-007-2 — even without
//   a click, the user receives one expression + one sentence from that day's content).
//   EC-007-C: this builder intentionally emits an informational tone only — no
//   promotional/sales call-to-action wording ("지금 가입", "할인", "무료체험", etc.), since
//   알림톡 promotional templates require separate review from informational ones and
//   REQ-WEB-007-U2 explicitly forbids daily-task-assignment framing. Pure function — no I/O,
//   no vendor dependency. Callers: lib/reminder/reminder-batch.ts (Task 7.3), alimtalk-template.ts
//   (Task 7.4 fixture).
// @MX:SPEC: SPEC-WEB-001 Phase 7 Task 7.2 (REQ-WEB-007-U1, REQ-WEB-007-U2, AC-007-1, AC-007-2, EC-007-C)

export interface ReminderMessageInput {
  /** Topic-curiosity teaser, e.g. "오늘 BBC에서 이런 일이 있었는데". */
  topicTeaser: string;
  /** The single expression the message delivers even without a click. */
  expression: string;
  /** The full source sentence containing the expression. */
  sourceSentence: string;
  /** Human-readable content source label, e.g. "BBC Learning English". */
  sourceLabel: string;
}

/**
 * Builds a value-complete, informational-tone reminder message body.
 * Order is intentional: topic teaser first (curiosity), then the
 * expression + sentence payload (value-complete), then the source label.
 * No call-to-action or promotional language is ever emitted.
 */
export function buildReminderMessage(input: ReminderMessageInput): string {
  const { topicTeaser, expression, sourceSentence, sourceLabel } = input;

  return [
    `${topicTeaser} —`,
    `오늘의 표현: "${expression}"`,
    sourceSentence,
    `(${sourceLabel})`,
  ].join("\n");
}
