CREATE TABLE IF NOT EXISTS public.premium_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text UNIQUE,
  source_video_id text NOT NULL,
  source_url text NOT NULL,
  title text NOT NULL,
  subtitle text,
  description text,
  thumbnail_url text,
  channel_name text,
  speaker_name text,
  source_type text,
  genre text,
  speaking_situations text[] NOT NULL DEFAULT '{}',
  interest_tags text[] NOT NULL DEFAULT '{}',
  difficulty_level integer CHECK (difficulty_level BETWEEN 1 AND 5),
  duration_seconds integer NOT NULL DEFAULT 0,
  segment_start_time numeric(10,3) NOT NULL DEFAULT 0,
  segment_end_time numeric(10,3) NOT NULL DEFAULT 0,
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  article jsonb NOT NULL DEFAULT '{}'::jsonb,
  delivery_analysis jsonb NOT NULL DEFAULT '[]'::jsonb,
  roleplay jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  reviewed boolean NOT NULL DEFAULT false,
  published_on date,
  published_at timestamptz,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT premium_sessions_segment_check
    CHECK (segment_end_time >= segment_start_time)
);

CREATE TABLE IF NOT EXISTS public.premium_expression_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.premium_sessions(id) ON DELETE CASCADE,
  source_sentence_id text,
  order_index integer NOT NULL DEFAULT 0,
  depth text NOT NULL CHECK (depth IN ('anchor', 'support')),
  expression text NOT NULL,
  source_line text NOT NULL,
  timestamp text NOT NULL,
  natural_meaning_ko text NOT NULL,
  story text NOT NULL,
  pronunciation jsonb NOT NULL DEFAULT '{}'::jsonb,
  variations jsonb NOT NULL DEFAULT '[]'::jsonb,
  saved_atoms jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  CONSTRAINT premium_expression_cards_order_unique
    UNIQUE (session_id, order_index)
);

CREATE TABLE IF NOT EXISTS public.premium_articles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL UNIQUE
    REFERENCES public.premium_sessions(id) ON DELETE CASCADE,
  title text NOT NULL,
  subtitle text,
  body text NOT NULL,
  summary_bullets jsonb NOT NULL DEFAULT '[]'::jsonb,
  reading_minutes integer CHECK (
    reading_minutes IS NULL OR reading_minutes > 0
  ),
  reviewed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at timestamptz NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.premium_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_expression_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.premium_articles ENABLE ROW LEVEL SECURITY;

-- Premium content is read through the server web API only, where
-- entitlement/trial checks run before a service-role query. No public SELECT
-- policies are created for these tables.

CREATE INDEX IF NOT EXISTS premium_sessions_status_published_on_idx
  ON public.premium_sessions(status, published_on DESC, published_at DESC);

CREATE INDEX IF NOT EXISTS premium_sessions_source_video_idx
  ON public.premium_sessions(source_video_id);

CREATE INDEX IF NOT EXISTS premium_expression_cards_session_order_idx
  ON public.premium_expression_cards(session_id, order_index);

CREATE INDEX IF NOT EXISTS premium_articles_session_idx
  ON public.premium_articles(session_id);

ALTER TABLE public.pronunciation_analyses
  ADD COLUMN IF NOT EXISTS premium_session_id uuid
    REFERENCES public.premium_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.pronunciation_analyses
  DROP CONSTRAINT IF EXISTS pronunciation_analyses_source_check;

ALTER TABLE public.pronunciation_analyses
  ADD CONSTRAINT pronunciation_analyses_source_check
    CHECK (source IN ('daily-input', 'study', 'premium-roleplay'));

CREATE INDEX IF NOT EXISTS idx_pronunciation_analyses_premium_session
  ON public.pronunciation_analyses(user_id, premium_session_id, created_at DESC);
