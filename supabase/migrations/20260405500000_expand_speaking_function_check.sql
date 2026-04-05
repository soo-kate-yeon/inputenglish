-- Migration: Expand speaking_function check constraints with v2 values
-- Date: 2026-04-05
-- Reason: TypeScript SESSION_SPEAKING_FUNCTIONS added v2 values (buy-time, clarify,
-- recover, build-rapport, redirect) but DB check constraints were not updated,
-- causing "violates check constraint learning_sessions_speaking_function_check".

-- learning_sessions table
ALTER TABLE public.learning_sessions
  DROP CONSTRAINT IF EXISTS learning_sessions_speaking_function_check;

ALTER TABLE public.learning_sessions
  ADD CONSTRAINT learning_sessions_speaking_function_check
  CHECK (
    speaking_function IS NULL OR speaking_function IN (
      'persuade',
      'explain-metric',
      'summarize',
      'hedge',
      'disagree',
      'propose',
      'answer-question',
      'buy-time',
      'clarify',
      'recover',
      'build-rapport',
      'redirect'
    )
  );

-- session_contexts table
ALTER TABLE public.session_contexts
  DROP CONSTRAINT IF EXISTS session_contexts_speaking_function_check;

ALTER TABLE public.session_contexts
  ADD CONSTRAINT session_contexts_speaking_function_check
  CHECK (
    speaking_function IS NULL OR speaking_function IN (
      'persuade',
      'explain-metric',
      'summarize',
      'hedge',
      'disagree',
      'propose',
      'answer-question',
      'buy-time',
      'clarify',
      'recover',
      'build-rapport',
      'redirect'
    )
  );
