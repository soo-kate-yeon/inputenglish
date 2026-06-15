-- Stage B(4): Drop PREMIUM-001 legacy tables and columns
-- Prerequisite: No active users (dev/staging only data)
-- premium_expression_cards and premium_articles have no production data
-- SPEC-INPUT-001: supersedes SPEC-PREMIUM-001 legacy content model

-- Drop dependent tables first (foreign keys reference premium_sessions)
DROP TABLE IF EXISTS premium_expression_cards;
DROP TABLE IF EXISTS premium_articles;

-- Remove roleplay and delivery_analysis columns from premium_sessions
-- (these columns exist per 20260614000100_add_premium_sessions.sql)
ALTER TABLE premium_sessions
  DROP COLUMN IF EXISTS roleplay,
  DROP COLUMN IF EXISTS delivery_analysis;

-- Remove premium-roleplay from pronunciation_analyses source CHECK constraint
-- The constraint was added in 20260614000100_add_premium_sessions.sql.
-- We drop and recreate it without 'premium-roleplay'.
ALTER TABLE pronunciation_analyses
  DROP CONSTRAINT IF EXISTS pronunciation_analyses_source_check;

ALTER TABLE pronunciation_analyses
  ADD CONSTRAINT pronunciation_analyses_source_check
    CHECK (source IN ('daily-input', 'study'));
