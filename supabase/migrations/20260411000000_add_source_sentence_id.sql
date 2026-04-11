-- Add source_sentence_ids to transformation_sets so ExpressionPage
-- can show the exact transcript sentences containing the target pattern.
ALTER TABLE transformation_sets
  ADD COLUMN IF NOT EXISTS source_sentence_ids text[] DEFAULT '{}';
