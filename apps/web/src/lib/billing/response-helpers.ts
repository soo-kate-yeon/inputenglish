// @MX:NOTE: [AUTO] Shared "200 OK, optionally with a reconciliation warning" response shape,
//   used by both /api/billing/confirm and /api/billing/webhook when the primary write
//   (subscriptions) succeeds but the secondary users.plan sync fails.

import { NextResponse } from "next/server";

/**
 * Returns a 200 response body, adding a `warning` field only when one is provided
 * (falsy values are omitted). Keeps the two dual-write success paths (confirm/webhook)
 * from re-deriving the same "success + optional warning" branch independently.
 */
export function withOptionalWarning<T extends object>(
  body: T,
  warning?: string | null,
): NextResponse {
  return NextResponse.json(warning ? { ...body, warning } : body, {
    status: 200,
  });
}
