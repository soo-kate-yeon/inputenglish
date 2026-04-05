// @MX:NOTE: [AUTO] Supabase data access layer for transformation practice (SPEC-MOBILE-011).
// Fetches TransformationSet with nested exercises; uploads recordings and saves user attempts.
import { supabase } from "./supabase";
import type {
  TransformationSet,
  TransformationAttempt,
} from "@inputenglish/shared";

/**
 * Fetches the transformation set for a given session, including all exercises.
 * Returns null if no set exists yet.
 */
export async function fetchTransformationSet(
  sessionId: string,
): Promise<TransformationSet | null> {
  const { data, error } = await supabase
    .from("transformation_sets")
    .select(
      `
      *,
      transformation_exercises (*)
    `,
    )
    .eq("session_id", sessionId)
    .order("page_order", { referencedTable: "transformation_exercises" })
    .maybeSingle();

  if (error) {
    console.error("[transformation-api] fetchTransformationSet error:", error);
    return null;
  }

  if (!data) return null;

  // Remap nested join key to 'exercises'
  const { transformation_exercises, ...rest } = data as typeof data & {
    transformation_exercises: TransformationSet["exercises"];
  };

  return {
    ...rest,
    exercises: transformation_exercises ?? [],
  } as TransformationSet;
}

/**
 * Uploads a transformation recording to Supabase Storage and returns the public URL.
 * Path: {userId}/transformation/{exerciseId}/{timestamp}.m4a
 */
export async function uploadTransformationRecording(
  uri: string,
  userId: string,
  exerciseId: string,
): Promise<string> {
  let blob: Blob;
  try {
    const fileResponse = await fetch(uri);
    blob = await fileResponse.blob();
  } catch (err) {
    throw new Error(
      `[transformation-api] Failed to read recording file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  const timestamp = Date.now();
  const storagePath = `${userId}/transformation/${exerciseId}/${timestamp}.m4a`;

  const { data, error } = await supabase.storage
    .from("recordings")
    .upload(storagePath, blob, {
      contentType: "audio/m4a",
      upsert: false,
    });

  if (error) {
    throw new Error(
      `[transformation-api] Storage upload failed: ${error.message}`,
    );
  }

  const { data: urlData } = supabase.storage
    .from("recordings")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

/**
 * Saves a user's recording attempt for an exercise.
 */
export async function saveTransformationAttempt(
  params: Omit<TransformationAttempt, "id" | "completed_at">,
): Promise<TransformationAttempt> {
  const { data, error } = await supabase
    .from("transformation_attempts")
    .insert({
      user_id: params.user_id,
      exercise_id: params.exercise_id,
      recording_url: params.recording_url ?? null,
      recording_duration: params.recording_duration ?? null,
      attempt_metadata: params.attempt_metadata ?? {},
    })
    .select()
    .single();

  if (error) {
    throw new Error(
      `[transformation-api] saveTransformationAttempt: ${error.message}`,
    );
  }

  return data as TransformationAttempt;
}
