-- Ensure a user can save a given sentence only once per video.
-- This matches the application-level identity used by the archive UI.
ALTER TABLE public.saved_sentences
ADD CONSTRAINT saved_sentences_user_video_sentence_unique
UNIQUE (user_id, video_id, sentence_id);
