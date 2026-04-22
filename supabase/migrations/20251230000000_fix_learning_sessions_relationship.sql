-- Migration: Fix relationship between learning_sessions and curated_videos
-- Date: 2025-12-30

-- 1. Ensure curated_videos.video_id is unique so it can be referenced as a foreign key
-- We use a name that describes the constraint
DO $$ 
BEGIN
    IF to_regclass('public.curated_videos') IS NOT NULL
       AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'curated_videos_video_id_unique'
    ) THEN
        ALTER TABLE public.curated_videos ADD CONSTRAINT curated_videos_video_id_unique UNIQUE (video_id);
    END IF;
END $$;

-- 2. Add foreign key from learning_sessions to curated_videos
-- This allows PostgREST to perform joins (embedding)
DO $$ 
BEGIN
    IF to_regclass('public.curated_videos') IS NOT NULL
       AND NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'learning_sessions_source_video_id_fkey'
    ) THEN
        ALTER TABLE public.learning_sessions
        ADD CONSTRAINT learning_sessions_source_video_id_fkey
        FOREIGN KEY (source_video_id)
        REFERENCES public.curated_videos(video_id)
        ON DELETE CASCADE;
    END IF;
END $$;
