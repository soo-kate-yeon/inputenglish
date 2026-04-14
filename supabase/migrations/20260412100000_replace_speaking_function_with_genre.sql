-- Migration: Remove speaking_function, add genre column
-- Date: 2026-04-12
-- Reason: speaking_function schema replaced by genre-based categorization.
-- source_type stays unchanged.

-- 1. Drop speaking_function constraints and indexes
ALTER TABLE public.learning_sessions
  DROP CONSTRAINT IF EXISTS learning_sessions_speaking_function_check;

DROP INDEX IF EXISTS learning_sessions_speaking_function_idx;

ALTER TABLE public.session_contexts
  DROP CONSTRAINT IF EXISTS session_contexts_speaking_function_check;

-- 2. Drop speaking_function columns
ALTER TABLE public.learning_sessions
  DROP COLUMN IF EXISTS speaking_function;

ALTER TABLE public.session_contexts
  DROP COLUMN IF EXISTS speaking_function;

DROP INDEX IF EXISTS idx_playbook_entries_speaking_function;

ALTER TABLE public.playbook_entries
  DROP COLUMN IF EXISTS speaking_function;

-- 3. Add genre column to learning_sessions
ALTER TABLE public.learning_sessions
  ADD COLUMN IF NOT EXISTS genre text;

ALTER TABLE public.learning_sessions
  ADD CONSTRAINT learning_sessions_genre_check
  CHECK (
    genre IS NULL OR genre IN (
      'politics',
      'fashion',
      'tech',
      'economy',
      'current-affairs',
      'news',
      'beauty',
      'art',
      'business'
    )
  );

CREATE INDEX IF NOT EXISTS learning_sessions_genre_idx
  ON public.learning_sessions(genre);
