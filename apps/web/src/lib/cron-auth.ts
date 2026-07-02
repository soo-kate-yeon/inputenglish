// @MX:ANCHOR: [AUTO] Shared CRON_SECRET auth check for all /api/cron/* routes.
// @MX:REASON: [AUTO] Extracted after this exact function body was duplicated verbatim
//   across 4 route files (reading-batch, subscription-renewal, weekly-prep-send,
//   daily-reminder) — each route's docstring already said "mirrors X exactly," which
//   is itself the signal this belonged in one place. This is a security-critical
//   boundary (billing charges, mass messaging, content ingest all gate on it), so a
//   future fix (e.g. timing-safe comparison, a new header scheme) now only needs to
//   change one file instead of four in lockstep.
export interface CronAuthorizableRequest {
  headers: Pick<Headers, "get">;
}

/**
 * Validates cron authorization.
 * Accepts:
 *   - Authorization: Bearer <CRON_SECRET>  (Vercel Cron standard)
 *   - x-cron-secret: <CRON_SECRET>         (manual/agent/Render trigger)
 *
 * Fail-closed: if CRON_SECRET env is not set, every request is rejected.
 */
export function isCronAuthorized(request: CronAuthorizableRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  // Fail-closed: no secret configured -> reject all
  if (!cronSecret) {
    return false;
  }

  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  const xCronSecret = request.headers.get("x-cron-secret");

  return bearerSecret === cronSecret || xCronSecret === cronSecret;
}
