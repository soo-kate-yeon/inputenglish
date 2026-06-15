CREATE TABLE reading_pieces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  level text NOT NULL,
  format text NOT NULL,
  topic text NOT NULL,
  body text NOT NULL,
  coverage_pct numeric(5,2),
  validation_status text NOT NULL DEFAULT 'pending' CHECK (validation_status IN ('pending','approved','rejected')),
  source_facts jsonb DEFAULT '{}',
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE reading_pieces ENABLE ROW LEVEL SECURITY;
-- Server-only: no public SELECT
CREATE POLICY "service_role_only" ON reading_pieces FOR ALL USING (auth.role() = 'service_role');
