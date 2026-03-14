// @MX:ANCHOR: api - Mobile Supabase direct query client for curated videos
// @MX:REASON: [AUTO] fan_in >= 3: used by HomeScreen, ListeningScreen, and future screens
// @MX:SPEC: SPEC-MOBILE-003 - direct Supabase queries bypassing web API server
import { supabase } from "./supabase";
import type { CuratedVideo } from "@shadowoo/shared";

export interface VideoListItem {
  video_id: string;
  title: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  thumbnail_url?: string;
  snippet_duration?: number;
  channel_name?: string;
}

export async function fetchCuratedVideos(): Promise<VideoListItem[]> {
  const { data, error } = await supabase
    .from("curated_videos")
    .select(
      "video_id, title, difficulty, thumbnail_url, snippet_duration, channel_name",
    )
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as VideoListItem[];
}

export interface SessionListItem {
  id: string;
  source_video_id: string;
  title: string;
  description?: string;
  duration: number;
  difficulty?: "beginner" | "intermediate" | "advanced";
  thumbnail_url?: string;
  order_index: number;
  channel_name?: string;
}

export async function fetchLearningSessions(): Promise<SessionListItem[]> {
  // Fetch sessions
  const { data: sessions, error: sessionsError } = await supabase
    .from("learning_sessions")
    .select(
      "id, source_video_id, title, description, duration, difficulty, thumbnail_url, order_index",
    )
    .order("created_at", { ascending: false });

  if (sessionsError) throw sessionsError;
  if (!sessions || sessions.length === 0) return [];

  // Fetch source videos for thumbnails/channel names
  const videoIds = [...new Set(sessions.map((s) => s.source_video_id))];
  const { data: videos } = await supabase
    .from("curated_videos")
    .select("video_id, thumbnail_url, channel_name")
    .in("video_id", videoIds);

  const videoMap = new Map((videos ?? []).map((v) => [v.video_id, v]));

  return sessions.map((s) => {
    const video = videoMap.get(s.source_video_id);
    return {
      id: s.id,
      source_video_id: s.source_video_id,
      title: s.title,
      description: s.description || undefined,
      duration: Number(s.duration),
      difficulty: s.difficulty as SessionListItem["difficulty"],
      thumbnail_url:
        s.thumbnail_url ||
        video?.thumbnail_url ||
        `https://img.youtube.com/vi/${s.source_video_id}/hqdefault.jpg`,
      order_index: s.order_index,
      channel_name: video?.channel_name || undefined,
    };
  });
}

export async function fetchCuratedVideo(
  videoId: string,
): Promise<CuratedVideo> {
  const { data, error } = await supabase
    .from("curated_videos")
    .select("*")
    .eq("video_id", videoId)
    .single();

  if (error) throw error;
  return data as CuratedVideo;
}
