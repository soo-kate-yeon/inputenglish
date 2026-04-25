-- Add talk-show, vlog, scripted-drama to source_type check constraint
ALTER TABLE public.learning_sessions
  DROP CONSTRAINT IF EXISTS learning_sessions_source_type_check;

ALTER TABLE public.learning_sessions
  ADD CONSTRAINT learning_sessions_source_type_check
  CHECK (
    source_type IS NULL OR source_type IN (
      'keynote',
      'demo',
      'earnings-call',
      'podcast',
      'interview',
      'panel',
      'public-speech',
      'talk-show',
      'vlog',
      'scripted-drama'
    )
  );
