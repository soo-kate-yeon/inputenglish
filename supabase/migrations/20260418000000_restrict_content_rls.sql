-- Restrict write RLS policies on content tables.
-- Previously these used USING(true) / WITH CHECK(true) allowing any
-- anonymous client to INSERT, UPDATE, or DELETE.
-- After this migration only authenticated users can write; SELECT remains public.
-- Admin API routes use the service_role key and are unaffected by RLS.

-- =============================================================
-- 1. curated_videos — restrict INSERT / UPDATE / DELETE to auth
-- =============================================================
DROP POLICY IF EXISTS "Anyone can insert curated videos" ON public.curated_videos;
CREATE POLICY "Authenticated users can insert curated videos"
  ON public.curated_videos FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can update curated videos" ON public.curated_videos;
CREATE POLICY "Authenticated users can update curated videos"
  ON public.curated_videos FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can delete curated videos" ON public.curated_videos;
CREATE POLICY "Authenticated users can delete curated videos"
  ON public.curated_videos FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =============================================================
-- 2. learning_sessions — restrict INSERT / UPDATE / DELETE to auth
-- =============================================================
DROP POLICY IF EXISTS "Anyone can insert learning sessions" ON public.learning_sessions;
CREATE POLICY "Authenticated users can insert learning sessions"
  ON public.learning_sessions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can update learning sessions" ON public.learning_sessions;
CREATE POLICY "Authenticated users can update learning sessions"
  ON public.learning_sessions FOR UPDATE
  USING (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Anyone can delete learning sessions" ON public.learning_sessions;
CREATE POLICY "Authenticated users can delete learning sessions"
  ON public.learning_sessions FOR DELETE
  USING (auth.uid() IS NOT NULL);

-- =============================================================
-- 3. transformation_sets — restrict INSERT / UPDATE to auth
-- =============================================================
DROP POLICY IF EXISTS "transformation_sets_insert" ON public.transformation_sets;
CREATE POLICY "transformation_sets_insert"
  ON public.transformation_sets FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "transformation_sets_update" ON public.transformation_sets;
CREATE POLICY "transformation_sets_update"
  ON public.transformation_sets FOR UPDATE
  USING (auth.uid() IS NOT NULL);

-- =============================================================
-- 4. transformation_exercises — restrict INSERT / UPDATE to auth
-- =============================================================
DROP POLICY IF EXISTS "transformation_exercises_insert" ON public.transformation_exercises;
CREATE POLICY "transformation_exercises_insert"
  ON public.transformation_exercises FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "transformation_exercises_update" ON public.transformation_exercises;
CREATE POLICY "transformation_exercises_update"
  ON public.transformation_exercises FOR UPDATE
  USING (auth.uid() IS NOT NULL);
