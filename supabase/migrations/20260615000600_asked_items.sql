CREATE TABLE asked_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  source_type text NOT NULL CHECK (source_type IN ('reading','segment')),
  source_ref jsonb NOT NULL DEFAULT '{}',
  highlight_text text NOT NULL,
  question text,
  answer text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE asked_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_only" ON asked_items FOR ALL USING (auth.uid() = user_id);
