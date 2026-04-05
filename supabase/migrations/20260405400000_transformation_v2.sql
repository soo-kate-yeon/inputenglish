-- transformation v2: pattern_type/exercise_type enum 확장, 새 컬럼 추가

-- 1. pattern_type CHECK 제약 확장
ALTER TABLE transformation_sets
  DROP CONSTRAINT IF EXISTS transformation_sets_pattern_type_check;
ALTER TABLE transformation_sets
  ADD CONSTRAINT transformation_sets_pattern_type_check
  CHECK (pattern_type IN (
    'declarative', 'interrogative',
    'framing', 'hedging', 'transitioning', 'responding'
  ));

-- 2. pattern_rationale 컬럼 추가 (이 패턴을 고른 이유)
ALTER TABLE transformation_sets
  ADD COLUMN IF NOT EXISTS pattern_rationale text;

-- 3. exercise_type CHECK 제약 확장
ALTER TABLE transformation_exercises
  DROP CONSTRAINT IF EXISTS transformation_exercises_exercise_type_check;
ALTER TABLE transformation_exercises
  ADD CONSTRAINT transformation_exercises_exercise_type_check
  CHECK (exercise_type IN (
    'kr-to-en', 'qa-response', 'dialog-completion', 'situation-response'
  ));

-- 4. situation_text 컬럼 추가 (situation-response 문제용)
ALTER TABLE transformation_exercises
  ADD COLUMN IF NOT EXISTS situation_text text;

-- 5. page_order 범위 확장 (향후 문제 수 유연하게 대응)
ALTER TABLE transformation_exercises
  DROP CONSTRAINT IF EXISTS transformation_exercises_page_order_check;
ALTER TABLE transformation_exercises
  ADD CONSTRAINT transformation_exercises_page_order_check
  CHECK (page_order BETWEEN 1 AND 10);
