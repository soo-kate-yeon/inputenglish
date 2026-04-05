-- Add plan column to users table if missing (was omitted in bootstrap migration)
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS plan text DEFAULT 'FREE'
CHECK (plan IN ('FREE', 'PREMIUM'));
