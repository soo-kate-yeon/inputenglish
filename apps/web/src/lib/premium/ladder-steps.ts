// @MX:NOTE: [AUTO] Ladder step sequence builder (Task 5.3, REQ-WEB-004-U1, D8).
//   Base ladder: 0 (preview/script_clean reading) -> 1 (RWL captions-on + tap-gloss)
//   -> 2 (no-captions). EC-004-A / W1: an optional 0.5 step (script pre-read) is
//   inserted before RWL only when shouldOfferPrereadStep() (ladder-transition.ts)
//   says content is near the user's IL ceiling with a high tap rate — never forced
//   daily.
export type LadderStep = 0 | 0.5 | 1 | 2;

export interface BuildLadderStepsParams {
  offerPreread: boolean;
}

export function buildLadderSteps(params: BuildLadderStepsParams): LadderStep[] {
  return params.offerPreread ? [0, 0.5, 1, 2] : [0, 1, 2];
}
