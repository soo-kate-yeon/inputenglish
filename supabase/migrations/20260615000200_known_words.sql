CREATE TABLE known_words (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lemma text NOT NULL,
  frequency_band text NOT NULL CHECK (frequency_band IN ('beginner','basic','conversation','professional','advanced')),
  source text NOT NULL CHECK (source IN ('seed','tap','inferred')),
  last_seen timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, lemma)
);
ALTER TABLE known_words ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_only" ON known_words FOR ALL USING (auth.uid() = user_id);
