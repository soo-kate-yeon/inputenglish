CREATE TABLE channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  youtube_channel_id text NOT NULL UNIQUE,
  level_band text NOT NULL CHECK (level_band IN ('beginner','basic','conversation','professional')),
  visual_accent_tags text[] NOT NULL DEFAULT '{}',
  topics text[] NOT NULL DEFAULT '{}',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON channels FOR ALL USING (auth.role() = 'service_role');
