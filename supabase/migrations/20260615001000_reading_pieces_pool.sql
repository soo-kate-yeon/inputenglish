-- SPEC-INPUT-002 Phase 2 (REQ-AUTO-002): Reading Pieces Pool Extension
-- Adds band + expires_at columns and a partial pool index for daily batch queries.
-- Timestamp 001000 is intentionally after 000900 (drop_premium_legacy).

-- Add band column (nullable — existing rows have no band; pool rows will have one)
ALTER TABLE reading_pieces
  ADD COLUMN band text
  CHECK (band IS NULL OR band IN ('beginner', 'basic', 'conversation', 'professional'));

-- Add expires_at column (nullable) for pool lifecycle management (REQ-AUTO-002-U2)
ALTER TABLE reading_pieces
  ADD COLUMN expires_at timestamptz;

-- Partial index: accelerates pool queries (band + format + recent rows, pool-only)
-- Covers: band filter, format filter, validation_status filter, ordering by created_at DESC
-- WHERE user_id IS NULL limits to pool rows only (D3 band-level shared pool)
CREATE INDEX reading_pieces_pool_idx
  ON reading_pieces (band, format, validation_status, created_at DESC)
  WHERE user_id IS NULL;
