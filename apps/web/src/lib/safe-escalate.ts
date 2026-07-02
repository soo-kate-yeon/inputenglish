// @MX:NOTE: [AUTO] Shared "run this side-effect, never let its own failure propagate"
//   helper. Extracted after the same inline try/catch pattern appeared twice
//   (lib/premium/weekly-prep-send.ts's failure-status write, lib/reminder/reminder-batch.ts's
//   onDualFailure hook call) — both needed "if this best-effort action itself throws, log
//   and continue, don't abort the surrounding batch loop." A third occurrence would make
//   the duplication a real maintenance burden, so this was pulled out at the second one.

/**
 * Runs `action`, swallowing (and logging) any error it throws instead of letting
 * it propagate. Use for best-effort side effects inside a batch loop — e.g.
 * recording a failure status, or firing an escalation hook — where the action
 * failing must never abort processing of the remaining batch items.
 */
export async function safeEscalate(
  label: string,
  action: () => Promise<void>,
): Promise<void> {
  try {
    await action();
  } catch (err) {
    console.error(`[${label}] best-effort action failed`, err);
  }
}
