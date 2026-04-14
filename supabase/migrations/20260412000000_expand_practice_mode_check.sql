-- Migration: Expand practice_mode check constraint to include 'bookmark'
-- Date: 2026-04-12
-- Reason: TypeScript PRACTICE_MODES added 'bookmark' but DB check constraint
-- was not updated, causing "violates check constraint" on playbook_entries insert
-- when bookmarking sentences in the transformation practice tab.

ALTER TABLE public.playbook_entries
  DROP CONSTRAINT IF EXISTS playbook_entries_practice_mode_check;

ALTER TABLE public.playbook_entries
  ADD CONSTRAINT playbook_entries_practice_mode_check
  CHECK (practice_mode IN ('slot-in', 'role-play', 'my-briefing', 'bookmark'));
