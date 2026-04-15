-- Speaker curation primitives for mobile speaker rows and admin assignment.

CREATE TABLE IF NOT EXISTS public.speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  name_ko text,
  headline text,
  bio_short text,
  avatar_url text,
  organization text,
  role_title text,
  is_featured boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT speakers_status_check CHECK (status IN ('active', 'hidden'))
);

CREATE TABLE IF NOT EXISTS public.video_speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  video_id text NOT NULL REFERENCES public.curated_videos(video_id) ON DELETE CASCADE,
  speaker_id uuid NOT NULL REFERENCES public.speakers(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT true,
  admin_verified boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (video_id, speaker_id)
);

CREATE INDEX IF NOT EXISTS speakers_slug_idx
  ON public.speakers(slug);

CREATE INDEX IF NOT EXISTS speakers_featured_sort_idx
  ON public.speakers(is_featured, sort_order, created_at DESC);

CREATE INDEX IF NOT EXISTS video_speakers_speaker_idx
  ON public.video_speakers(speaker_id);

CREATE INDEX IF NOT EXISTS video_speakers_video_idx
  ON public.video_speakers(video_id);

CREATE UNIQUE INDEX IF NOT EXISTS video_speakers_primary_video_idx
  ON public.video_speakers(video_id)
  WHERE is_primary = true;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_speakers_updated_at ON public.speakers;
CREATE TRIGGER update_speakers_updated_at
  BEFORE UPDATE ON public.speakers
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.video_speakers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'speakers'
      AND policyname = 'Anyone can view speakers'
  ) THEN
    CREATE POLICY "Anyone can view speakers"
      ON public.speakers FOR SELECT
      USING (true);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'video_speakers'
      AND policyname = 'Anyone can view video speakers'
  ) THEN
    CREATE POLICY "Anyone can view video speakers"
      ON public.video_speakers FOR SELECT
      USING (true);
  END IF;
END
$$;

CREATE OR REPLACE VIEW public.speaker_library_items AS
SELECT
  s.id AS speaker_id,
  s.slug AS speaker_slug,
  s.name AS speaker_name,
  s.name_ko AS speaker_name_ko,
  s.headline AS speaker_headline,
  s.bio_short AS speaker_bio_short,
  s.avatar_url AS speaker_avatar_url,
  s.organization AS speaker_organization,
  s.role_title AS speaker_role_title,
  s.is_featured AS speaker_is_featured,
  s.sort_order AS speaker_sort_order,
  cv.video_id,
  cv.title AS video_title,
  cv.thumbnail_url AS video_thumbnail_url,
  cv.channel_name,
  ls.id AS session_id,
  ls.title AS session_title,
  ls.subtitle AS session_subtitle,
  ls.description AS session_description,
  ls.duration AS session_duration,
  ls.order_index AS session_order_index,
  ls.difficulty AS session_difficulty,
  ls.source_type AS session_source_type,
  ls.genre AS session_genre,
  ls.premium_required AS session_premium_required
FROM public.speakers s
JOIN public.video_speakers vs
  ON vs.speaker_id = s.id
 AND vs.is_primary = true
JOIN public.curated_videos cv
  ON cv.video_id = vs.video_id
LEFT JOIN public.learning_sessions ls
  ON ls.source_video_id = cv.video_id;
