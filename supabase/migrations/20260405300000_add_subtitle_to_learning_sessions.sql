-- Add subtitle column to learning_sessions
ALTER TABLE learning_sessions
ADD COLUMN IF NOT EXISTS subtitle TEXT;
