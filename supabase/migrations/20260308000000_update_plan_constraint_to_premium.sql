-- Migrate users.plan constraint from STANDARD/MASTER to PREMIUM
-- SPEC-MOBILE-006: Simplified plan tiers (FREE | PREMIUM)

-- 1. Migrate existing paid plan users to PREMIUM
UPDATE users SET plan = 'PREMIUM' WHERE plan IN ('STANDARD', 'MASTER');

-- 2. Drop old constraint
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_plan_check;

-- 3. Add new constraint
ALTER TABLE users ADD CONSTRAINT users_plan_check
  CHECK (plan IN ('FREE', 'PREMIUM'));
