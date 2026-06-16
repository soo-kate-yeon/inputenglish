-- Fix delete_user() — 42703 (undefined_column) on account deletion.
--
-- The original delete_user() (20260320000000) deleted from
-- public.practice_prompts and public.learning_sessions by `user_id`. Those
-- tables have since been redesigned into ADMIN CONTENT (learning_sessions uses
-- `created_by`; practice_prompts is keyed by `session_id`) and no longer have a
-- `user_id` column, so the DELETEs raised SQLSTATE 42703 and the whole RPC
-- aborted — account deletion (an App Store requirement) silently failed.
--
-- These two tables are shared content, NOT per-user data, so they must not be
-- deleted when a user deletes their account. All genuine per-user v1.3 tables
-- (user_vocab_profiles, known_words, reading_pieces, ci_sessions, asked_items,
-- video_segments, premium_*, etc.) reference auth.users(id) ON DELETE CASCADE
-- and are removed by the final `delete from auth.users`.

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

  -- Delete per-user data. Content tables (practice_prompts, learning_sessions)
  -- are intentionally NOT touched — they are admin-authored and not user-owned.
  delete from public.push_tokens where user_id = uid;
  delete from public.playbook_entries where user_id = uid;
  delete from public.highlights where user_id = uid;
  delete from public.saved_sentences where user_id = uid;
  delete from public.users where id = uid;

  -- Delete the auth user. Cascades to every table that references
  -- auth.users(id) ON DELETE CASCADE (incl. all v1.3 CI engine tables).
  delete from auth.users where id = uid;
end;
$$;

grant execute on function public.delete_user() to authenticated;
