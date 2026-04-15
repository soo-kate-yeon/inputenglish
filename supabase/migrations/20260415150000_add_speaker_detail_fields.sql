ALTER TABLE public.speakers
  ADD COLUMN IF NOT EXISTS description_long text,
  ADD COLUMN IF NOT EXISTS speaking_focus text;
