-- Content tagging schema migration
-- Removes role_relevance / video_categories, adds difficulty_level / speaking_situations
-- Updates users table: preferred_video_categories → preferred_source_types + preferred_genres

-- learning_sessions: add new tagging columns
ALTER TABLE learning_sessions
  ADD COLUMN IF NOT EXISTS difficulty_level smallint CHECK (difficulty_level BETWEEN 1 AND 5);

-- users: add new preference columns (jsonb, consistent with existing preferred_* columns)
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS preferred_source_types jsonb DEFAULT '[]'::jsonb NOT NULL,
  ADD COLUMN IF NOT EXISTS preferred_genres jsonb DEFAULT '[]'::jsonb NOT NULL;

-- Migrate preferred_situations: Korean labels → English keys (jsonb)
UPDATE users
SET preferred_situations = (
  SELECT jsonb_agg(mapped) FILTER (WHERE mapped IS NOT NULL)
  FROM jsonb_array_elements_text(preferred_situations) AS elem
  CROSS JOIN LATERAL (
    SELECT
      CASE elem
        WHEN '일상 잡담'         THEN 'daily-chat'
        WHEN '친구/연애'          THEN 'friendship-romance'
        WHEN '학교/업무'          THEN 'school-work'
        WHEN '발표/회의'          THEN 'presentation-meeting'
        WHEN '인터뷰'             THEN 'interview'
        WHEN '서비스직'           THEN 'service-industry'
        WHEN '자기소개/스몰토크'  THEN 'self-intro-smalltalk'
        ELSE NULL
      END AS mapped
  ) m
)
WHERE jsonb_array_length(preferred_situations) > 0;

-- Migrate preferred_video_categories → preferred_genres (jsonb)
UPDATE users
SET preferred_genres = (
  SELECT COALESCE(jsonb_agg(DISTINCT mapped) FILTER (WHERE mapped IS NOT NULL), '[]'::jsonb)
  FROM jsonb_array_elements_text(preferred_video_categories) AS elem
  CROSS JOIN LATERAL (
    SELECT
      CASE elem
        WHEN '최신 시사 이슈'                          THEN 'current-affairs'
        WHEN '티키타카를 배울 수 있는 팟캐스트/토크쇼'  THEN 'news'
        WHEN '정보성 팟캐스트/인터뷰'                  THEN 'business'
        WHEN '셀럽 인터뷰'                             THEN 'art'
        WHEN '브이로그'                                THEN 'art'
        WHEN '영화 속 장면들'                          THEN 'art'
        WHEN '드라마 속 장면들'                        THEN 'art'
        WHEN '연설이나 강단 발표'                      THEN 'business'
        ELSE NULL
      END AS mapped
  ) m
)
WHERE jsonb_array_length(preferred_video_categories) > 0;

-- Migrate learning_sessions.speaking_situations: Korean labels → English keys (text[])
UPDATE learning_sessions
SET speaking_situations = (
  SELECT array_agg(
    CASE elem
      WHEN '일상 잡담'         THEN 'daily-chat'
      WHEN '친구/연애'          THEN 'friendship-romance'
      WHEN '학교/업무'          THEN 'school-work'
      WHEN '발표/회의'          THEN 'presentation-meeting'
      WHEN '인터뷰'             THEN 'interview'
      WHEN '서비스직'           THEN 'service-industry'
      WHEN '자기소개/스몰토크'  THEN 'self-intro-smalltalk'
      ELSE elem
    END
  )
  FROM unnest(speaking_situations) AS elem
)
WHERE array_length(speaking_situations, 1) > 0;

-- Index for new columns
CREATE INDEX IF NOT EXISTS learning_sessions_speaking_situations_dl_idx
  ON learning_sessions (difficulty_level)
  WHERE difficulty_level IS NOT NULL;

-- Deprecated columns: kept for data safety, no longer read by app code
-- To drop later (after confirming no rollback needed):
--   ALTER TABLE learning_sessions DROP COLUMN IF EXISTS role_relevance;
--   ALTER TABLE learning_sessions DROP COLUMN IF EXISTS video_categories;
--   ALTER TABLE users DROP COLUMN IF EXISTS preferred_video_categories;
