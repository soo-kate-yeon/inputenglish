-- Migration: Add transformation practice prompts, attempts, and playbook entries

CREATE TABLE IF NOT EXISTS public.practice_prompts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  mode text NOT NULL CHECK (mode IN ('slot-in', 'role-play', 'my-briefing')),
  title text NOT NULL,
  prompt_text text NOT NULL,
  guidance jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE (session_id, mode)
);

CREATE TABLE IF NOT EXISTS public.practice_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  source_video_id text NOT NULL,
  source_sentence text NOT NULL,
  speaking_function text,
  mode text NOT NULL CHECK (mode IN ('slot-in', 'role-play', 'my-briefing')),
  response_text text,
  recording_url text,
  coaching_summary jsonb,
  attempt_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE TABLE IF NOT EXISTS public.playbook_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  session_id uuid NOT NULL REFERENCES public.learning_sessions(id) ON DELETE CASCADE,
  source_video_id text NOT NULL,
  source_sentence text NOT NULL,
  speaking_function text,
  practice_mode text NOT NULL CHECK (practice_mode IN ('slot-in', 'role-play', 'my-briefing')),
  user_rewrite text NOT NULL,
  attempt_metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  mastery_status text NOT NULL DEFAULT 'new' CHECK (mastery_status IN ('new', 'practicing', 'mastered')),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.practice_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.playbook_entries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'practice_prompts'
      AND policyname = 'Practice prompts are viewable by everyone.'
  ) THEN
    CREATE POLICY "Practice prompts are viewable by everyone."
      ON public.practice_prompts
      FOR SELECT
      USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'practice_prompts'
      AND policyname = 'Authenticated users can manage practice prompts.'
  ) THEN
    CREATE POLICY "Authenticated users can manage practice prompts."
      ON public.practice_prompts
      FOR ALL
      USING (auth.role() = 'authenticated')
      WITH CHECK (auth.role() = 'authenticated');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'practice_attempts'
      AND policyname = 'Users can view their own practice attempts.'
  ) THEN
    CREATE POLICY "Users can view their own practice attempts."
      ON public.practice_attempts
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'practice_attempts'
      AND policyname = 'Users can insert their own practice attempts.'
  ) THEN
    CREATE POLICY "Users can insert their own practice attempts."
      ON public.practice_attempts
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'playbook_entries'
      AND policyname = 'Users can view their own playbook entries.'
  ) THEN
    CREATE POLICY "Users can view their own playbook entries."
      ON public.playbook_entries
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'playbook_entries'
      AND policyname = 'Users can insert their own playbook entries.'
  ) THEN
    CREATE POLICY "Users can insert their own playbook entries."
      ON public.playbook_entries
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'playbook_entries'
      AND policyname = 'Users can update their own playbook entries.'
  ) THEN
    CREATE POLICY "Users can update their own playbook entries."
      ON public.playbook_entries
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'playbook_entries'
      AND policyname = 'Users can delete their own playbook entries.'
  ) THEN
    CREATE POLICY "Users can delete their own playbook entries."
      ON public.playbook_entries
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_practice_prompts_session_id
  ON public.practice_prompts(session_id);

CREATE INDEX IF NOT EXISTS idx_practice_attempts_user_id
  ON public.practice_attempts(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_practice_attempts_session_id
  ON public.practice_attempts(session_id, mode);

CREATE INDEX IF NOT EXISTS idx_playbook_entries_user_id
  ON public.playbook_entries(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_playbook_entries_speaking_function
  ON public.playbook_entries(user_id, speaking_function);
