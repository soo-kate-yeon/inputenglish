-- SPEC-WEB-001 Phase 0 — foundation schema for web subscription launch (PRD v1.4).
-- New tables: subscriptions, courses, weekly_prep, daily_question_counts, referrals.
-- Column extensions: users (il_index/vocab_estimate/selected_course),
-- channels (legal_status), video_segments (script_clean/subtitle_dependency_stage/il).
-- 4-band -> IL 7-band seed-compatible mapping (REQ-WEB-002, EC-002-C): additive only,
-- existing level_band / VocabBand path (today/route.ts) is untouched.

-- ── users: IL index + vocab estimate + selected course (REQ-WEB-002-U1) ─────────
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS il_index numeric(3,1),
  ADD COLUMN IF NOT EXISTS vocab_estimate integer,
  ADD COLUMN IF NOT EXISTS selected_course text;

ALTER TABLE public.users
  DROP CONSTRAINT IF EXISTS users_il_index_check;

ALTER TABLE public.users
  ADD CONSTRAINT users_il_index_check
  CHECK (il_index IS NULL OR (il_index >= 1.0 AND il_index <= 7.0));

-- ── channels: legal_status (REQ-WEB-003-U1, U3) ─────────────────────────────────
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS legal_status text NOT NULL DEFAULT 'official';

ALTER TABLE public.channels
  DROP CONSTRAINT IF EXISTS channels_legal_status_check;

ALTER TABLE public.channels
  ADD CONSTRAINT channels_legal_status_check
  CHECK (legal_status IN ('official', 'unofficial_reupload', 'embed_disabled', 'major_ip_excluded'));

-- ── video_segments: script_clean + subtitle dependency stage + IL (REQ-WEB-003-U2, D7) ──
ALTER TABLE public.video_segments
  ADD COLUMN IF NOT EXISTS script_clean text,
  ADD COLUMN IF NOT EXISTS subtitle_dependency_stage integer,
  ADD COLUMN IF NOT EXISTS il numeric(3,1);

ALTER TABLE public.video_segments
  DROP CONSTRAINT IF EXISTS video_segments_subtitle_dependency_stage_check;

ALTER TABLE public.video_segments
  ADD CONSTRAINT video_segments_subtitle_dependency_stage_check
  CHECK (subtitle_dependency_stage IS NULL OR subtitle_dependency_stage BETWEEN 0 AND 2);

ALTER TABLE public.video_segments
  DROP CONSTRAINT IF EXISTS video_segments_il_check;

ALTER TABLE public.video_segments
  ADD CONSTRAINT video_segments_il_check
  CHECK (il IS NULL OR (il >= 1.0 AND il <= 7.0));

-- ── subscriptions (new, REQ-WEB-008) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_type text NOT NULL CHECK (plan_type IN ('annual', 'semiannual', 'quarterly')),
  start_date timestamptz NOT NULL DEFAULT now(),
  expiry_date timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'expired', 'cancelled')),
  billing_key text,
  customer_key text,
  next_renewal_date timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
-- Own-row SELECT only; billing_key must never be client-writable/readable via anon role.
-- Server (service_role) performs all writes and may select billing_key for renewal Cron.
CREATE POLICY "self_select_only" ON public.subscriptions
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_role_write" ON public.subscriptions
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_update" ON public.subscriptions
  FOR UPDATE USING (auth.role() = 'service_role');
CREATE POLICY "service_role_delete" ON public.subscriptions
  FOR DELETE USING (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS subscriptions_user_id_idx ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON public.subscriptions(status);

-- ── courses (new, REQ-WEB-005) ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  domain_lane text NOT NULL,
  il_range_low numeric(3,1) NOT NULL,
  il_range_high numeric(3,1) NOT NULL,
  before_goal text,
  after_goal text,
  narrative_frame text,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
-- Server-only content table (no public SELECT), matches channels/video_segments pattern.
CREATE POLICY "service_role_only" ON public.courses FOR ALL USING (auth.role() = 'service_role');

-- ── weekly_prep (new, REQ-WEB-006) ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.weekly_prep (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  course_id uuid REFERENCES public.courses(id) ON DELETE SET NULL,
  vocab jsonb NOT NULL DEFAULT '[]',
  expressions jsonb NOT NULL DEFAULT '[]',
  source_sentences jsonb NOT NULL DEFAULT '[]',
  send_status text NOT NULL DEFAULT 'pending' CHECK (send_status IN ('pending', 'sent', 'failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.weekly_prep ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_select_only" ON public.weekly_prep
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_role_write" ON public.weekly_prep
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_update" ON public.weekly_prep
  FOR UPDATE USING (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS weekly_prep_user_id_idx ON public.weekly_prep(user_id);
CREATE INDEX IF NOT EXISTS weekly_prep_week_start_idx ON public.weekly_prep(week_start_date);

-- ── daily_question_counts (new, D15 / REQ-WEB-004-W2) ───────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_question_counts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL,
  count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, date)
);
ALTER TABLE public.daily_question_counts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_select_only" ON public.daily_question_counts
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "service_role_write" ON public.daily_question_counts
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "service_role_update" ON public.daily_question_counts
  FOR UPDATE USING (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS daily_question_counts_user_date_idx
  ON public.daily_question_counts(user_id, date);

-- ── referrals (new, schema only — O-1 Deferred, no payout logic) ───────────────
CREATE TABLE IF NOT EXISTS public.referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL UNIQUE,
  referrer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "self_select_only" ON public.referrals
  FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referee_id);
CREATE POLICY "service_role_write" ON public.referrals
  FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE INDEX IF NOT EXISTS referrals_referrer_id_idx ON public.referrals(referrer_id);
