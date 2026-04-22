-- Bootstrap all missing tables that were marked as 'applied' via repair
-- but never actually executed on the remote database.

-- 1. Users table (from initial_schema)
CREATE TABLE IF NOT EXISTS public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  plan text default 'FREE' check (plan in ('FREE', 'STANDARD', 'MASTER')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  CREATE POLICY "Public profiles are viewable by everyone." ON public.users FOR SELECT USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can insert their own profile." ON public.users FOR INSERT WITH CHECK (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE POLICY "Users can update own profile." ON public.users FOR UPDATE USING (auth.uid() = id);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name, avatar_url)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'avatar_url');
  RETURN new;
END;
$$ language plpgsql security definer;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Sessions table (from add_user_data_tables)
CREATE TABLE IF NOT EXISTS public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  video_id text not null,
  progress int default 0,
  last_accessed_at timestamptz default now() not null,
  total_sentences int not null,
  time_left text,
  current_step smallint check (current_step in (1, 2)) not null,
  current_sentence int,
  created_at timestamptz default now() not null
);
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view their own sessions" ON public.sessions FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can insert their own sessions" ON public.sessions FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own sessions" ON public.sessions FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own sessions" ON public.sessions FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Unique constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'sessions_user_video_unique'
      AND conrelid = 'public.sessions'::regclass
  ) THEN
    ALTER TABLE public.sessions
      ADD CONSTRAINT sessions_user_video_unique UNIQUE (user_id, video_id);
  END IF;
END $$;

-- 3. Highlights table
CREATE TABLE IF NOT EXISTS public.highlights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  video_id text not null,
  sentence_id text,
  original_text text not null,
  user_note text,
  created_at timestamptz default now() not null
);
ALTER TABLE public.highlights ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view their own highlights" ON public.highlights FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can insert their own highlights" ON public.highlights FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own highlights" ON public.highlights FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own highlights" ON public.highlights FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Saved sentences table
CREATE TABLE IF NOT EXISTS public.saved_sentences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  video_id text not null,
  sentence_id text not null,
  sentence_text text not null,
  start_time numeric not null,
  end_time numeric not null,
  created_at timestamptz default now() not null
);
ALTER TABLE public.saved_sentences ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view their own saved sentences" ON public.saved_sentences FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can insert their own saved sentences" ON public.saved_sentences FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own saved sentences" ON public.saved_sentences FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own saved sentences" ON public.saved_sentences FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 5. AI notes table
CREATE TABLE IF NOT EXISTS public.ai_notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  video_id text not null,
  sentence_id text not null,
  sentence_text text not null,
  user_feedback jsonb default '[]'::jsonb,
  ai_response jsonb not null,
  created_at timestamptz default now() not null
);
ALTER TABLE public.ai_notes ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Users can view their own ai notes" ON public.ai_notes FOR SELECT USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can insert their own ai notes" ON public.ai_notes FOR INSERT WITH CHECK (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can update their own ai notes" ON public.ai_notes FOR UPDATE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Users can delete their own ai notes" ON public.ai_notes FOR DELETE USING (auth.uid() = user_id); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 6. Learning sessions table
CREATE TABLE IF NOT EXISTS public.learning_sessions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source_video_id text NOT NULL,
  title text NOT NULL,
  description text,
  start_time numeric NOT NULL,
  end_time numeric NOT NULL,
  duration numeric GENERATED ALWAYS AS (end_time - start_time) STORED,
  sentence_ids text[] NOT NULL DEFAULT '{}',
  thumbnail_url text,
  difficulty text CHECK (difficulty IN ('beginner', 'intermediate', 'advanced')),
  order_index int DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  created_by uuid,
  updated_at timestamptz DEFAULT now() NOT NULL
);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_learning_sessions_updated_at ON public.learning_sessions;
CREATE TRIGGER update_learning_sessions_updated_at
  BEFORE UPDATE ON public.learning_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.learning_sessions ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN CREATE POLICY "Anyone can view learning sessions" ON public.learning_sessions FOR SELECT USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can insert learning sessions" ON public.learning_sessions FOR INSERT WITH CHECK (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can update learning sessions" ON public.learning_sessions FOR UPDATE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "Anyone can delete learning sessions" ON public.learning_sessions FOR DELETE USING (true); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON public.sessions(user_id);
CREATE INDEX IF NOT EXISTS sessions_video_id_idx ON public.sessions(video_id);
CREATE INDEX IF NOT EXISTS highlights_user_id_idx ON public.highlights(user_id);
CREATE INDEX IF NOT EXISTS saved_sentences_user_id_idx ON public.saved_sentences(user_id);
CREATE INDEX IF NOT EXISTS ai_notes_user_id_idx ON public.ai_notes(user_id);
CREATE INDEX IF NOT EXISTS learning_sessions_source_video_idx ON public.learning_sessions(source_video_id);
CREATE INDEX IF NOT EXISTS learning_sessions_difficulty_idx ON public.learning_sessions(difficulty);
CREATE INDEX IF NOT EXISTS learning_sessions_created_at_idx ON public.learning_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS learning_sessions_order_idx ON public.learning_sessions(source_video_id, order_index);
