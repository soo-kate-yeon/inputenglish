-- SPEC-WEB-001 Phase 2 — additive idempotency column for Toss payment confirmation (Task 2.2b).
-- Adds subscriptions.order_id so /api/billing/confirm can detect a re-submitted
-- Toss orderId and return the existing row unchanged (no double-activate, no
-- second Toss call). NULL is allowed for rows that predate this column
-- (e.g. any Phase 0 seed/test rows); uniqueness is only enforced on non-null values.

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS order_id text;

-- Partial unique index (not a table constraint) so multiple NULL order_id rows
-- remain valid, while non-null order_id values must be unique for idempotency.
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_order_id_unique_idx
  ON public.subscriptions (order_id)
  WHERE order_id IS NOT NULL;
