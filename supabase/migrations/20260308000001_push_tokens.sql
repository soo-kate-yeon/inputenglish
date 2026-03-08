-- Push tokens table for Expo push notifications
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, token)
);

-- RLS
alter table public.push_tokens enable row level security;

create policy "Users can manage their own push tokens"
  on public.push_tokens
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Index for fast lookup by user
create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
