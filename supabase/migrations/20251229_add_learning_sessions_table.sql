-- Migration: Add learning_sessions table for short video clips
-- Date: 2025-12-29
-- Description: Creates learning_sessions table to store extracted video segments
--              while keeping curated_videos as the source

-- Create learning_sessions table
CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  
  -- Reference to source video
  source_video_id text NOT NULL,
  -- Note: We reference video_id (text) instead of id (uuid) from curated_videos
  
  -- Session metadata
  title text NOT NULL,
  description text,
  
  -- Time boundaries
  start_time numeric NOT NULL, -- seconds, from first selected sentence
  end_time numeric NOT NULL,   -- seconds, from last selected sentence
  duration numeric GENERATED ALWAYS AS (end_time - start_time) STORED,
  
  -- Selected sentences
  sentence_ids text[] NOT NULL DEFAULT '{}', -- array of sentence IDs
  
  -- Display metadata
  thumbnail_url text,
  difficulty text CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  order_index int DEFAULT 0, -- for sorting multiple sessions from same video
  
  -- Audit fields
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid REFERENCES public.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now() NOT NULL
);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add trigger for updated_at
DROP TRIGGER IF EXISTS update_learning_sessions_updated_at ON public.learning_sessions;
CREATE TRIGGER update_learning_sessions_updated_at
    BEFORE UPDATE ON public.learning_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS learning_sessions_source_video_idx 
    ON public.learning_sessions(source_video_id);
CREATE INDEX IF NOT EXISTS learning_sessions_difficulty_idx 
    ON public.learning_sessions(difficulty);
CREATE INDEX IF NOT EXISTS learning_sessions_created_at_idx 
    ON public.learning_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS learning_sessions_order_idx 
    ON public.learning_sessions(source_video_id, order_index);

-- Set up Row Level Security
ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;

-- Public read access (all users can view published sessions)
DO $$ BEGIN
  CREATE POLICY "Anyone can view learning sessions"
    ON public.learning_sessions FOR SELECT
    USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only authenticated users can insert (admins will be checked in app layer)
DO $$ BEGIN
  CREATE POLICY "Authenticated users can insert learning sessions"
    ON public.learning_sessions FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only creators or admins can update (admin check in app layer)
DO $$ BEGIN
  CREATE POLICY "Creators can update their learning sessions"
    ON public.learning_sessions FOR UPDATE
    USING (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Only creators or admins can delete (admin check in app layer)
DO $$ BEGIN
  CREATE POLICY "Creators can delete their learning sessions"
    ON public.learning_sessions FOR DELETE
    USING (auth.uid() = created_by);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Add comment for documentation
COMMENT ON TABLE public.learning_sessions IS 'Stores extracted learning sessions (short clips) from curated videos';
COMMENT ON COLUMN public.learning_sessions.source_video_id IS 'References curated_videos.video_id (text field, not id)';
COMMENT ON COLUMN public.learning_sessions.sentence_ids IS 'Array of sentence.id values selected for this session';
COMMENT ON COLUMN public.learning_sessions.duration IS 'Auto-calculated from end_time - start_time';
