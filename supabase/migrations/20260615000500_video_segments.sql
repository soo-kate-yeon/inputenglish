CREATE TABLE video_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_video_id text NOT NULL,
  channel_id uuid NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  start_time numeric NOT NULL,
  end_time numeric NOT NULL,
  transcript jsonb NOT NULL DEFAULT '[]',
  wpm numeric(6,2),
  band_coverage jsonb NOT NULL DEFAULT '{}',
  topic_tags text[] NOT NULL DEFAULT '{}',
  self_contained boolean NOT NULL DEFAULT false,
  difficulty_score integer CHECK (difficulty_score BETWEEN 1 AND 5),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE video_segments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON video_segments FOR ALL USING (auth.role() = 'service_role');
CREATE INDEX ON video_segments (parent_video_id);
CREATE INDEX ON video_segments (channel_id);
