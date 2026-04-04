-- Migration: Add card_comments table for inline comment threads on archive cards

CREATE TABLE IF NOT EXISTS public.card_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('saved_sentence', 'highlight')),
  target_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) > 0 AND char_length(body) <= 500),
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.card_comments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'card_comments'
      AND policyname = 'Users can view their own card comments.'
  ) THEN
    CREATE POLICY "Users can view their own card comments."
      ON public.card_comments
      FOR SELECT
      USING (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'card_comments'
      AND policyname = 'Users can insert their own card comments.'
  ) THEN
    CREATE POLICY "Users can insert their own card comments."
      ON public.card_comments
      FOR INSERT
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'card_comments'
      AND policyname = 'Users can update their own card comments.'
  ) THEN
    CREATE POLICY "Users can update their own card comments."
      ON public.card_comments
      FOR UPDATE
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'card_comments'
      AND policyname = 'Users can delete their own card comments.'
  ) THEN
    CREATE POLICY "Users can delete their own card comments."
      ON public.card_comments
      FOR DELETE
      USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_card_comments_user_target
  ON public.card_comments(user_id, target_type, target_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_card_comments_target
  ON public.card_comments(target_id, created_at ASC);

-- Update delete_user() to include card_comments cleanup
CREATE OR REPLACE FUNCTION public.delete_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Delete user data from all tables
  DELETE FROM public.card_comments WHERE user_id = uid;
  DELETE FROM public.push_tokens WHERE user_id = uid;
  DELETE FROM public.playbook_entries WHERE user_id = uid;
  DELETE FROM public.practice_prompts WHERE user_id = uid;
  DELETE FROM public.highlights WHERE user_id = uid;
  DELETE FROM public.saved_sentences WHERE user_id = uid;
  DELETE FROM public.learning_sessions WHERE user_id = uid;
  DELETE FROM public.users WHERE id = uid;

  -- Delete the auth user (requires service_role via security definer)
  DELETE FROM auth.users WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user() TO authenticated;
