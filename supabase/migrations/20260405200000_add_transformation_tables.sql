-- transformation_sets: groups of exercises per session
CREATE TABLE transformation_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES learning_sessions(id) ON DELETE CASCADE,
  target_pattern text NOT NULL,
  pattern_type text NOT NULL CHECK (pattern_type IN ('declarative', 'interrogative')),
  generated_by text NOT NULL DEFAULT 'ai' CHECK (generated_by IN ('ai', 'manual')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- transformation_exercises: individual exercise pages (2-5)
CREATE TABLE transformation_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  set_id uuid NOT NULL REFERENCES transformation_sets(id) ON DELETE CASCADE,
  page_order int NOT NULL CHECK (page_order BETWEEN 2 AND 5),
  exercise_type text NOT NULL CHECK (exercise_type IN ('kr-to-en', 'qa-response', 'dialog-completion')),
  instruction_text text NOT NULL,
  source_korean text,
  question_text text,
  dialog_lines jsonb,
  reference_answer text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (set_id, page_order)
);

-- transformation_attempts: user recording attempts
CREATE TABLE transformation_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id uuid NOT NULL REFERENCES transformation_exercises(id) ON DELETE CASCADE,
  recording_url text,
  recording_duration int,
  completed_at timestamptz DEFAULT now(),
  attempt_metadata jsonb DEFAULT '{}'
);

-- RLS policies
ALTER TABLE transformation_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE transformation_attempts ENABLE ROW LEVEL SECURITY;

-- transformation_sets: admin write, all read
CREATE POLICY "transformation_sets_select" ON transformation_sets
  FOR SELECT USING (true);

CREATE POLICY "transformation_sets_insert" ON transformation_sets
  FOR INSERT WITH CHECK (true);

CREATE POLICY "transformation_sets_update" ON transformation_sets
  FOR UPDATE USING (true);

-- transformation_exercises: admin write, all read
CREATE POLICY "transformation_exercises_select" ON transformation_exercises
  FOR SELECT USING (true);

CREATE POLICY "transformation_exercises_insert" ON transformation_exercises
  FOR INSERT WITH CHECK (true);

CREATE POLICY "transformation_exercises_update" ON transformation_exercises
  FOR UPDATE USING (true);

-- transformation_attempts: users manage own attempts
CREATE POLICY "transformation_attempts_select" ON transformation_attempts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "transformation_attempts_insert" ON transformation_attempts
  FOR INSERT WITH CHECK (auth.uid() = user_id);
