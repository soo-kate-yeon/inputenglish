DO $$
BEGIN
  INSERT INTO storage.buckets (
    id,
    name,
    public,
    file_size_limit,
    allowed_mime_types
  )
  VALUES (
    'recordings',
    'recordings',
    true,
    52428800,
    ARRAY[
      'audio/m4a',
      'audio/mp4',
      'audio/x-m4a',
      'audio/aac',
      'audio/wav',
      'audio/x-wav',
      'audio/webm'
    ]
  )
  ON CONFLICT (id) DO UPDATE
  SET
    name = EXCLUDED.name,
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can upload their own recordings'
  ) THEN
    CREATE POLICY "Users can upload their own recordings"
      ON storage.objects
      FOR INSERT
      TO authenticated
      WITH CHECK (
        bucket_id = 'recordings'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can view their own recordings'
  ) THEN
    CREATE POLICY "Users can view their own recordings"
      ON storage.objects
      FOR SELECT
      TO authenticated
      USING (
        bucket_id = 'recordings'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can update their own recordings'
  ) THEN
    CREATE POLICY "Users can update their own recordings"
      ON storage.objects
      FOR UPDATE
      TO authenticated
      USING (
        bucket_id = 'recordings'
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
      WITH CHECK (
        bucket_id = 'recordings'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'Users can delete their own recordings'
  ) THEN
    CREATE POLICY "Users can delete their own recordings"
      ON storage.objects
      FOR DELETE
      TO authenticated
      USING (
        bucket_id = 'recordings'
        AND (storage.foldername(name))[1] = auth.uid()::text
      );
  END IF;
END $$;
