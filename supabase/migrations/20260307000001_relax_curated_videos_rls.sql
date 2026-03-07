-- Relax curated_videos RLS for admin operations from browser client.
-- The admin page uses anon key with user session, not service_role.

DROP POLICY IF EXISTS "Authenticated users can insert curated videos" ON public.curated_videos;
CREATE POLICY "Anyone can insert curated videos"
  ON public.curated_videos FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "Creators can update their curated videos" ON public.curated_videos;
CREATE POLICY "Anyone can update curated videos"
  ON public.curated_videos FOR UPDATE
  USING (true);

DROP POLICY IF EXISTS "Creators can delete their curated videos" ON public.curated_videos;
CREATE POLICY "Anyone can delete curated videos"
  ON public.curated_videos FOR DELETE
  USING (true);
