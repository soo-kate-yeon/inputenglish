-- Migration: Add curated_videos table
-- Date: 2026-03-07
-- Description: Source video table for YouTube-based learning content.
--              learning_sessions references curated_videos.video_id.

CREATE TABLE IF NOT EXISTS public.curated_videos (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  video_id text NOT NULL UNIQUE,
  title text NOT NULL,
  thumbnail_url text,
  channel_name text,
  snippet_start_time numeric NOT NULL DEFAULT 0,
  snippet_end_time numeric NOT NULL DEFAULT 60,
  snippet_duration numeric GENERATED ALWAYS AS (snippet_end_time - snippet_start_time) STORED,
  transcript jsonb NOT NULL DEFAULT '[]',
  difficulty text CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  tags text[],
  source_url text NOT NULL DEFAULT '',
  attribution text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid
);

CREATE INDEX IF NOT EXISTS curated_videos_video_id_idx ON public.curated_videos(video_id);
CREATE INDEX IF NOT EXISTS curated_videos_difficulty_idx ON public.curated_videos(difficulty);
CREATE INDEX IF NOT EXISTS curated_videos_created_at_idx ON public.curated_videos(created_at DESC);

ALTER TABLE public.curated_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view curated videos"
  ON public.curated_videos FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert curated videos"
  ON public.curated_videos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Creators can update their curated videos"
  ON public.curated_videos FOR UPDATE
  USING (auth.uid() = created_by);

CREATE POLICY "Creators can delete their curated videos"
  ON public.curated_videos FOR DELETE
  USING (auth.uid() = created_by);

-- Sample data for development
INSERT INTO public.curated_videos (video_id, title, channel_name, thumbnail_url, snippet_start_time, snippet_end_time, difficulty, source_url, attribution, transcript)
VALUES (
  'qp0HIF3SfI4',
  'How great leaders inspire action | Simon Sinek',
  'TED',
  'https://img.youtube.com/vi/qp0HIF3SfI4/maxresdefault.jpg',
  0,
  60,
  'intermediate',
  'https://www.youtube.com/watch?v=qp0HIF3SfI4',
  'TED Talks',
  '[
    {"id":"s1","text":"How do you explain when things don''t go as we assume?","startTime":0,"endTime":5,"highlights":[]},
    {"id":"s2","text":"Or better, how do you explain when others are able to achieve things that seem to defy all of the assumptions?","startTime":5,"endTime":12,"highlights":[]},
    {"id":"s3","text":"For example: Why is Apple so innovative?","startTime":12,"endTime":16,"highlights":[]},
    {"id":"s4","text":"Year after year, after year, they''re more innovative than all their competition.","startTime":16,"endTime":21,"highlights":[]},
    {"id":"s5","text":"And yet, they''re just a computer company. They''re just like everyone else.","startTime":21,"endTime":28,"highlights":[]},
    {"id":"s6","text":"They have the same access to the same talent, the same agencies, the same media.","startTime":28,"endTime":35,"highlights":[]},
    {"id":"s7","text":"Then why is it that they seem to have something different?","startTime":35,"endTime":41,"highlights":[]},
    {"id":"s8","text":"Why is it that Martin Luther King led the Civil Rights Movement?","startTime":41,"endTime":47,"highlights":[]},
    {"id":"s9","text":"He wasn''t the only man who suffered in pre-civil rights America.","startTime":47,"endTime":53,"highlights":[]},
    {"id":"s10","text":"And he certainly wasn''t the only great orator of the day.","startTime":53,"endTime":60,"highlights":[]}
  ]'
);
