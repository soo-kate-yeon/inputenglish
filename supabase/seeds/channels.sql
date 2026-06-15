-- Channel whitelist seed for SPEC-INPUT-001 Listening Track
-- These channels are selected for: clear pronunciation (~130 wpm), visual cues, CI-friendly content
-- YouTube channel IDs are realistic placeholders — replace with real IDs before production use
INSERT INTO channels (name, youtube_channel_id, level_band, visual_accent_tags, topics, active) VALUES
  (
    'TED-Ed',
    'UCsooa4yRKGN_zEE8iknghZA',
    'conversation',
    ARRAY['animation', 'visual-cues'],
    ARRAY['science', 'history', 'psychology'],
    true
  ),
  (
    'Kurzgesagt',
    'UCsXVk37bltHxD1rDPwtNM8Q',
    'basic',
    ARRAY['animation', 'visual-cues'],
    ARRAY['science', 'technology'],
    true
  ),
  (
    'Crash Course',
    'UCX6b17PVsYBQ0ip5gyeme-Q',
    'professional',
    ARRAY['visual-cues', 'subtitles'],
    ARRAY['history', 'economics', 'science'],
    true
  )
ON CONFLICT (youtube_channel_id) DO NOTHING;
