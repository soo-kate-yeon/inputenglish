-- Expand the recordings bucket allowed_mime_types to tolerate MIME variants
-- reported by iOS clients.
--
-- Sentry issue 7427328797 (INPUTENGLISH-MOBILE-1) showed iOS returning
-- "audio/vnd.wave" as the Blob type for WAV recordings. The mobile client
-- now force-normalizes the Content-Type to "audio/wav" before upload,
-- but we widen the bucket whitelist too so unexpected variants from
-- other platforms (or future iOS changes) do not cause the same outage.

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
    'audio/m4a',
    'audio/mp4',
    'audio/x-m4a',
    'audio/aac',
    'audio/wav',
    'audio/x-wav',
    'audio/wave',
    'audio/vnd.wave',
    'audio/webm',
    'audio/caf',
    'audio/x-caf'
  ]
WHERE id = 'recordings';
