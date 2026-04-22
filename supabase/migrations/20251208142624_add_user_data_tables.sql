-- Remove old tables
drop table if exists public.archives cascade;
drop table if exists public.sessions cascade;
drop table if exists public.highlights cascade;
drop table if exists public.saved_sentences cascade;
drop table if exists public.ai_notes cascade;

-- Ensure the user profile table exists before early foreign keys reference it.
create table if not exists public.users (
  id uuid references auth.users on delete cascade not null primary key,
  email text,
  full_name text,
  avatar_url text,
  plan text default 'FREE' check (plan in ('FREE', 'STANDARD', 'MASTER')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Create sessions table for tracking user progress
create table if not exists public.sessions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  video_id text not null,
  progress int default 0, -- 0-100 (deprecated but kept for compatibility)
  last_accessed_at timestamptz default now() not null,
  total_sentences int not null,
  time_left text,
  current_step smallint check (current_step in (1, 2)) not null, -- 1 = listen, 2 = script
  current_sentence int, -- last viewed sentence index
  created_at timestamptz default now() not null
);

-- Create highlights table for user-highlighted sentences
create table if not exists public.highlights (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  video_id text not null,
  original_text text not null,
  user_note text,
  created_at timestamptz default now() not null
);

-- Create saved_sentences table
create table if not exists public.saved_sentences (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  video_id text not null,
  sentence_id text not null, -- Reference to sentence in video
  sentence_text text not null,
  start_time numeric not null, -- in seconds
  end_time numeric not null, -- in seconds
  created_at timestamptz default now() not null
);

-- Create ai_notes table for AI-generated learning notes
create table if not exists public.ai_notes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.users(id) on delete cascade not null,
  video_id text not null,
  sentence_id text not null,
  sentence_text text not null,
  user_feedback jsonb default '[]'::jsonb, -- array of feedback tags
  ai_response jsonb not null, -- {analysis, tips, focusPoint}
  created_at timestamptz default now() not null
);

-- Set up RLS for sessions
alter table public.sessions enable row level security;

do $$ begin
  create policy "Users can view their own sessions"
    on public.sessions for select
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can insert their own sessions"
    on public.sessions for insert
    with check ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can update their own sessions"
    on public.sessions for update
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can delete their own sessions"
    on public.sessions for delete
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

-- Set up RLS for highlights
alter table public.highlights enable row level security;

do $$ begin
  create policy "Users can view their own highlights"
    on public.highlights for select
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can insert their own highlights"
    on public.highlights for insert
    with check ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can update their own highlights"
    on public.highlights for update
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can delete their own highlights"
    on public.highlights for delete
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

-- Set up RLS for saved_sentences
alter table public.saved_sentences enable row level security;

do $$ begin
  create policy "Users can view their own saved sentences"
    on public.saved_sentences for select
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can insert their own saved sentences"
    on public.saved_sentences for insert
    with check ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can update their own saved sentences"
    on public.saved_sentences for update
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can delete their own saved sentences"
    on public.saved_sentences for delete
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

-- Set up RLS for ai_notes
alter table public.ai_notes enable row level security;

do $$ begin
  create policy "Users can view their own ai notes"
    on public.ai_notes for select
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can insert their own ai notes"
    on public.ai_notes for insert
    with check ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can update their own ai notes"
    on public.ai_notes for update
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

do $$ begin
  create policy "Users can delete their own ai notes"
    on public.ai_notes for delete
    using ( auth.uid() = user_id );
exception when duplicate_object then null; end $$;

-- Create unique constraint for sessions (one session per user per video)
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_user_video_unique'
      and conrelid = 'public.sessions'::regclass
  ) then
    alter table public.sessions
      add constraint sessions_user_video_unique unique (user_id, video_id);
  end if;
end $$;

-- Create indexes for better query performance
create index if not exists sessions_user_id_idx on public.sessions(user_id);
create index if not exists sessions_video_id_idx on public.sessions(video_id);
create index if not exists highlights_user_id_idx on public.highlights(user_id);
create index if not exists saved_sentences_user_id_idx on public.saved_sentences(user_id);
create index if not exists ai_notes_user_id_idx on public.ai_notes(user_id);
