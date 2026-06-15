ALTER TABLE public.saved_sentences
ADD COLUMN IF NOT EXISTS premium_session_id uuid REFERENCES public.premium_sessions(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS session_title text;

CREATE INDEX IF NOT EXISTS saved_sentences_premium_session_id_idx
ON public.saved_sentences(premium_session_id);
