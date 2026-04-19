CREATE TABLE IF NOT EXISTS public.pronunciation_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.learning_sessions(id) ON DELETE SET NULL,
  video_id text NOT NULL,
  sentence_id text NOT NULL,
  source text NOT NULL CHECK (source IN ('daily-input', 'study')),
  provider text NOT NULL DEFAULT 'azure' CHECK (provider IN ('azure')),
  provider_locale text NOT NULL DEFAULT 'en-US',
  recording_url text NOT NULL,
  reference_text text NOT NULL,
  recognized_text text,
  status text NOT NULL CHECK (status IN ('queued', 'processing', 'complete', 'failed')),
  overall_score numeric(5,2),
  accuracy_score numeric(5,2),
  fluency_score numeric(5,2),
  completeness_score numeric(5,2),
  prosody_score numeric(5,2),
  next_focus text,
  coaching_json jsonb,
  provider_payload jsonb,
  error_code text,
  error_message text,
  requested_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.pronunciation_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pronunciation_analyses'
      AND policyname = 'Users can view their own pronunciation analyses.'
  ) THEN
    CREATE POLICY "Users can view their own pronunciation analyses."
      ON public.pronunciation_analyses
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pronunciation_analyses'
      AND policyname = 'Users can insert their own pronunciation analyses.'
  ) THEN
    CREATE POLICY "Users can insert their own pronunciation analyses."
      ON public.pronunciation_analyses
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'pronunciation_analyses'
      AND policyname = 'Users can update their own pronunciation analyses.'
  ) THEN
    CREATE POLICY "Users can update their own pronunciation analyses."
      ON public.pronunciation_analyses
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pronunciation_analyses_user_id
  ON public.pronunciation_analyses(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pronunciation_analyses_status
  ON public.pronunciation_analyses(status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_pronunciation_analyses_sentence
  ON public.pronunciation_analyses(user_id, sentence_id, created_at DESC);
