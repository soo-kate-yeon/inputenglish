-- SPEC-WEB-001 Phase 7 — reminder opt-out flag (Task 7.3, REQ-WEB-007-W1, EC-007-A).
-- Additive only: existing users rows default to reminder_opt_out=false (still receive
-- reminders unless they explicitly opt out). No other columns touched.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS reminder_opt_out boolean NOT NULL DEFAULT false;
