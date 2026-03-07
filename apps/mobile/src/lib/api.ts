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
