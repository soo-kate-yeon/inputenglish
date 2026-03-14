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

