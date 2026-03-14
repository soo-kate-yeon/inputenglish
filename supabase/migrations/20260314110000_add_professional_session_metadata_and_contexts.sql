-- Migration: Add professional session metadata and pre-learning contexts
-- Date: 2026-03-14

ALTER TABLE public.learning_sessions
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS speaking_function text,
  ADD COLUMN IF NOT EXISTS role_relevance text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS premium_required boolean NOT NULL DEFAULT false;

ALTER TABLE public.learning_sessions
  DROP CONSTRAINT IF EXISTS learning_sessions_source_type_check;

ALTER TABLE public.learning_sessions
  ADD CONSTRAINT learning_sessions_source_type_check
  CHECK (
    source_type IS NULL OR source_type IN (
      'keynote',
      'demo',
      'earnings-call',
      'podcast',
      'interview',
      'panel'
    )
  );

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
      'answer-question'
    )
  );

CREATE TABLE IF NOT EXISTS public.session_contexts (
  session_id uuid PRIMARY KEY REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  strategic_intent text NOT NULL DEFAULT '',
  speaking_function text,
  reusable_scenarios jsonb NOT NULL DEFAULT '[]'::jsonb,
  key_vocabulary jsonb NOT NULL DEFAULT '[]'::jsonb,
  grammar_rhetoric_note text NOT NULL DEFAULT '',
  expected_takeaway text NOT NULL DEFAULT '',
  generated_by text NOT NULL DEFAULT 'manual',
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

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
      'answer-question'
    )
  );

DROP TRIGGER IF EXISTS update_session_contexts_updated_at ON public.session_contexts;
CREATE TRIGGER update_session_contexts_updated_at
  BEFORE UPDATE ON public.session_contexts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.session_contexts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view session contexts"
    ON public.session_contexts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can insert session contexts"
    ON public.session_contexts FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can update session contexts"
    ON public.session_contexts FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can delete session contexts"
    ON public.session_contexts FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS learning_sessions_source_type_idx
  ON public.learning_sessions(source_type);

CREATE INDEX IF NOT EXISTS learning_sessions_speaking_function_idx
  ON public.learning_sessions(speaking_function);

CREATE INDEX IF NOT EXISTS learning_sessions_premium_required_idx
  ON public.learning_sessions(premium_required);

