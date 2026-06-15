CREATE TABLE user_vocab_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  estimated_band text NOT NULL CHECK (estimated_band IN ('beginner','basic','conversation','professional')),
  estimated_level text NOT NULL DEFAULT 'A2',
  update_history jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);
ALTER TABLE user_vocab_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_only" ON user_vocab_profiles FOR ALL USING (auth.uid() = user_id);
