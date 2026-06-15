CREATE TABLE ci_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  reading_piece_id uuid REFERENCES reading_pieces(id) ON DELETE SET NULL,
  segment_ids uuid[] NOT NULL DEFAULT '{}',
  assembly_meta jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, session_date)
);
ALTER TABLE ci_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_only" ON ci_sessions FOR ALL USING (auth.uid() = user_id);
