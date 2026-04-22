-- Ensure longform hierarchy tables/columns exist even if a previous rollout was only partially applied.

CREATE TABLE IF NOT EXISTS public.longform_packs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_video_id text NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  start_time numeric NOT NULL,
  end_time numeric NOT NULL,
  duration numeric GENERATED ALWAYS AS (end_time - start_time) STORED,
  sentence_ids text[] NOT NULL DEFAULT '{}',
  primary_speaker_id uuid REFERENCES public.speakers(id) ON DELETE SET NULL,
  speaker_summary text,
  talk_summary text,
  topic_tags text[] NOT NULL DEFAULT '{}',
  content_tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS public.longform_contexts (
  longform_pack_id uuid PRIMARY KEY REFERENCES public.longform_packs(id) ON DELETE CASCADE,
  speaker_snapshot text NOT NULL DEFAULT '',
  conversation_type text NOT NULL DEFAULT '',
  core_topics jsonb NOT NULL DEFAULT '[]'::jsonb,
  why_this_segment text NOT NULL DEFAULT '',
  listening_takeaway text NOT NULL DEFAULT '',
  generated_by text NOT NULL DEFAULT 'manual',
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.learning_sessions
  ADD COLUMN IF NOT EXISTS longform_pack_id uuid REFERENCES public.longform_packs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS longform_packs_source_video_idx
  ON public.longform_packs(source_video_id);

CREATE INDEX IF NOT EXISTS longform_packs_created_at_idx
  ON public.longform_packs(created_at DESC);

CREATE INDEX IF NOT EXISTS learning_sessions_longform_pack_idx
  ON public.learning_sessions(longform_pack_id);

ALTER TABLE public.longform_packs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.longform_contexts ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Anyone can view longform packs"
    ON public.longform_packs FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can insert longform packs"
    ON public.longform_packs FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can update longform packs"
    ON public.longform_packs FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can delete longform packs"
    ON public.longform_packs FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can view longform contexts"
    ON public.longform_contexts FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can insert longform contexts"
    ON public.longform_contexts FOR INSERT WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can update longform contexts"
    ON public.longform_contexts FOR UPDATE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE POLICY "Anyone can delete longform contexts"
    ON public.longform_contexts FOR DELETE USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DROP TRIGGER IF EXISTS update_longform_packs_updated_at ON public.longform_packs;
CREATE TRIGGER update_longform_packs_updated_at
  BEFORE UPDATE ON public.longform_packs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_longform_contexts_updated_at ON public.longform_contexts;
CREATE TRIGGER update_longform_contexts_updated_at
  BEFORE UPDATE ON public.longform_contexts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
