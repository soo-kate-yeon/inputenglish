ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS level_band text,
  ADD COLUMN IF NOT EXISTS goal_mode text,
  ADD COLUMN IF NOT EXISTS focus_tags jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS preferred_speakers jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS preferred_situations jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_level_band_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_level_band_check
  CHECK (
    level_band IS NULL
    OR level_band IN ('beginner', 'basic', 'conversation', 'professional')
  );

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_goal_mode_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_goal_mode_check
  CHECK (goal_mode IS NULL OR goal_mode IN ('pronunciation', 'expression'));

CREATE INDEX IF NOT EXISTS users_goal_mode_idx ON public.users(goal_mode);
CREATE INDEX IF NOT EXISTS users_onboarding_completed_idx
  ON public.users(onboarding_completed_at);
