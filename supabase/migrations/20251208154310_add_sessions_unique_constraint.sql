-- Add unique constraint for sessions (one session per user per video)
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
