-- RPC function for user self-deletion (Apple App Store requirement)
-- Deletes all user data and the auth account
create or replace function public.delete_user()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Delete user data from all tables
  delete from public.push_tokens where user_id = uid;
  delete from public.playbook_entries where user_id = uid;
  delete from public.practice_prompts where user_id = uid;
  delete from public.highlights where user_id = uid;
  delete from public.saved_sentences where user_id = uid;
  delete from public.learning_sessions where user_id = uid;
  delete from public.users where id = uid;

  -- Delete the auth user (requires service_role via security definer)
  delete from auth.users where id = uid;
end;
$$;

-- Allow authenticated users to call this function
grant execute on function public.delete_user() to authenticated;
