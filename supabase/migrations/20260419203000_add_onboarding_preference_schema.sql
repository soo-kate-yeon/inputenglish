ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS preferred_video_categories jsonb DEFAULT '[]'::jsonb NOT NULL;

ALTER TABLE public.learning_sessions
  ADD COLUMN IF NOT EXISTS video_categories text[] DEFAULT '{}'::text[] NOT NULL,
  ADD COLUMN IF NOT EXISTS speaking_situations text[] DEFAULT '{}'::text[] NOT NULL;

CREATE INDEX IF NOT EXISTS learning_sessions_video_categories_idx
  ON public.learning_sessions
  USING gin (video_categories);

CREATE INDEX IF NOT EXISTS learning_sessions_speaking_situations_idx
  ON public.learning_sessions
  USING gin (speaking_situations);
