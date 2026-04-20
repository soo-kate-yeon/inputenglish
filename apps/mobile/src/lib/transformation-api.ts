// @MX:NOTE: [AUTO] Supabase data access layer for transformation practice (SPEC-MOBILE-011).
// Fetches TransformationSet with nested exercises; uploads recordings and saves user attempts.
import { supabase } from "./supabase";
import {
  inferAudioUploadMeta,
  normalizeAudioBlobForUpload,
} from "./audio-upload";
import { captureException } from "./sentry";
import type {
  TransformationSet,
  TransformationAttempt,
} from "@inputenglish/shared";

function getReadableTransformationUploadErrorMessage(message: string): string {
  const normalized = message.toLowerCase();

  if (normalized.includes("bucket not found")) {
    return "개발 환경의 recordings 버킷이 아직 생성되지 않았어요. 로컬 Supabase를 다시 시작하거나 마이그레이션을 적용해주세요.";
  }

  if (
    normalized.includes("row-level security") ||
    normalized.includes("permission denied") ||
    normalized.includes("not allowed")
  ) {
    return "녹음 업로드 권한이 없어요. 로그인 상태를 확인한 뒤 다시 시도해주세요.";
  }

  if (normalized.includes("failed to read recording file")) {
    return "녹음 파일을 읽지 못했어요. 다시 녹음한 뒤 한 번 더 시도해주세요.";
  }

  return "녹음 업로드에 실패했어요. 다시 시도해주세요.";
}

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
    .order("created_at", { ascending: false })
    .order("page_order", { referencedTable: "transformation_exercises" })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "[transformation-api] fetchTransformationSet error:",
      error.message,
      error.code,
      error.details,
      error.hint,
    );
    return null;
  }

  if (!data) return null;

  // Remap nested join key to 'exercises'
  const { transformation_exercises, ...rest } = data as typeof data & {
    transformation_exercises: TransformationSet["exercises"];
  };

  // Ensure source_sentence_ids is always a proper array
  const rawIds = (rest as Record<string, unknown>).source_sentence_ids;
  const source_sentence_ids = Array.isArray(rawIds) ? rawIds : [];

  return {
    ...rest,
    source_sentence_ids,
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
  // @MX:NOTE: Diagnostic logs mirror ai-api.uploadRecording — see that file
  //           for context on Hermes file:// fetch quirks.
  const uriPreview = uri.length > 80 ? `${uri.slice(0, 80)}...` : uri;
  let blob: Blob;
  try {
    const fileResponse = await fetch(uri);
    blob = await fileResponse.blob();
  } catch (err) {
    console.error("[transformation-api] fetch(uri) failed", {
      uri: uriPreview,
      err,
    });
    throw new Error(
      `[transformation-api] Failed to read recording file: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  console.warn("[transformation-api] blob read", {
    uri: uriPreview,
    size: blob.size,
    type: blob.type || "(empty)",
  });

  if (blob.size === 0) {
    throw new Error(
      `[transformation-api] Recording blob is empty (uri=${uriPreview}, type=${blob.type || "unknown"})`,
    );
  }

  const timestamp = Date.now();
  const uploadMeta = inferAudioUploadMeta(uri, blob.type);
  const storagePath = `${userId}/transformation/${exerciseId}/${timestamp}.${uploadMeta.extension}`;
  const uploadBlob = normalizeAudioBlobForUpload(blob, uploadMeta);

  console.warn("[transformation-api] upload start", {
    storagePath,
    contentType: uploadMeta.contentType,
    extension: uploadMeta.extension,
    blobSize: uploadBlob.size,
    originalBlobType: blob.type,
    normalizedBlobType: uploadBlob.type,
  });

  const { data, error } = await supabase.storage
    .from("recordings")
    .upload(storagePath, uploadBlob, {
      contentType: uploadMeta.contentType,
      upsert: false,
    });

  if (error) {
    console.error("[transformation-api] supabase upload failed", {
      storagePath,
      contentType: uploadMeta.contentType,
      blobSize: blob.size,
      error,
    });
    captureException(error, {
      location: "uploadTransformationRecording",
      storagePath,
      contentType: uploadMeta.contentType,
      blobSize: blob.size,
      blobType: blob.type,
      uri: uriPreview,
    });
    throw new Error(
      `[transformation-api] Storage upload failed: ${error.message} (path=${storagePath}, size=${blob.size}, type=${uploadMeta.contentType})`,
    );
  }

  console.warn("[transformation-api] upload success", { path: data.path });

  const { data: urlData } = supabase.storage
    .from("recordings")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

export function getReadableTransformationUploadError(error: unknown): string {
  if (error instanceof Error) {
    return getReadableTransformationUploadErrorMessage(error.message);
  }

  return "녹음 업로드에 실패했어요. 다시 시도해주세요.";
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
