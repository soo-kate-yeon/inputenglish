-- Remap genres: art → entertainment, beauty/fashion → lifestyle

-- Drop old constraint first so data migration doesn't violate it.
-- Assumes no concurrent app writes during this migration window.
ALTER TABLE public.learning_sessions
  DROP CONSTRAINT IF EXISTS learning_sessions_genre_check;

UPDATE learning_sessions
  SET genre = 'entertainment'
  WHERE genre = 'art';

UPDATE learning_sessions
  SET genre = 'lifestyle'
  WHERE genre IN ('beauty', 'fashion');

-- Remap users.preferred_genres
UPDATE users
  SET preferred_genres = (
    SELECT COALESCE(
      jsonb_agg(
        CASE elem
          WHEN 'art'     THEN 'entertainment'
          WHEN 'beauty'  THEN 'lifestyle'
          WHEN 'fashion' THEN 'lifestyle'
          ELSE elem
        END
      ),
      '[]'::jsonb
    )
    FROM jsonb_array_elements_text(preferred_genres) AS elem
  )
  WHERE preferred_genres IS NOT NULL
    AND jsonb_array_length(preferred_genres) > 0;

-- Deduplicate after mapping (beauty + fashion both → lifestyle creates duplicates)
UPDATE users
  SET preferred_genres = (
    SELECT jsonb_agg(DISTINCT val ORDER BY val)
    FROM jsonb_array_elements_text(preferred_genres) AS val
  )
  WHERE preferred_genres IS NOT NULL
    AND jsonb_array_length(preferred_genres) > 0;

-- Recreate constraint with new genre values
ALTER TABLE public.learning_sessions
  ADD CONSTRAINT learning_sessions_genre_check
  CHECK (
    genre IS NULL OR genre IN (
      'politics',
      'tech',
      'economy',
      'current-affairs',
      'news',
      'business',
      'entertainment',
      'lifestyle'
    )
  );
