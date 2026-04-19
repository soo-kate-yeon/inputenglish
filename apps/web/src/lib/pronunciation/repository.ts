import type {
  PronunciationAnalysisJob,
  PronunciationAnalysisStatus,
  PronunciationFeedback,
} from "@inputenglish/shared";
import { createAdminClient } from "@/utils/supabase/server";

type ErrorPayload = { code: string; message: string } | null;

interface AnalysisRow {
  id: string;
  provider: "azure";
  provider_locale: string;
  status: PronunciationAnalysisStatus;
  coaching_json: PronunciationFeedback | null;
  error_code: string | null;
  error_message: string | null;
  requested_at: string;
  completed_at: string | null;
}

function toJob(row: AnalysisRow): PronunciationAnalysisJob {
  return {
    analysis_id: row.id,
    status: row.status,
    provider: row.provider,
    provider_locale: row.provider_locale,
    result: row.coaching_json,
    error:
      row.error_code && row.error_message
        ? { code: row.error_code, message: row.error_message }
        : null,
    requested_at: row.requested_at,
    completed_at: row.completed_at,
  };
}

export async function createPronunciationAnalysis(input: {
  userId: string;
  sessionId?: string | null;
  videoId: string;
  sentenceId: string;
  source: "daily-input" | "study";
  providerLocale: string;
  recordingUrl: string;
  referenceText: string;
}): Promise<PronunciationAnalysisJob> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pronunciation_analyses")
    .insert({
      user_id: input.userId,
      session_id: input.sessionId ?? null,
      video_id: input.videoId,
      sentence_id: input.sentenceId,
      source: input.source,
      provider: "azure",
      provider_locale: input.providerLocale,
      recording_url: input.recordingUrl,
      reference_text: input.referenceText,
      status: "queued",
    })
    .select(
      "id, provider, provider_locale, status, coaching_json, error_code, error_message, requested_at, completed_at",
    )
    .single();

  if (error) throw error;
  return toJob(data as AnalysisRow);
}

export async function updatePronunciationAnalysisStatus(input: {
  analysisId: string;
  status: PronunciationAnalysisStatus;
  result?: PronunciationFeedback | null;
  recognizedText?: string | null;
  error?: ErrorPayload;
  providerPayload?: Record<string, unknown> | null;
}): Promise<PronunciationAnalysisJob> {
  const supabase = createAdminClient();
  const updates: Record<string, unknown> = {
    status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.status === "complete") {
    updates.completed_at = new Date().toISOString();
    updates.coaching_json = input.result ?? null;
    updates.recognized_text = input.recognizedText ?? null;
    updates.overall_score = input.result?.overall_score ?? null;
    updates.accuracy_score = input.result?.accuracy_score ?? null;
    updates.fluency_score = input.result?.fluency_score ?? null;
    updates.completeness_score = input.result?.completeness_score ?? null;
    updates.prosody_score = input.result?.prosody_score ?? null;
    updates.next_focus = input.result?.next_focus ?? null;
    updates.provider_payload = input.providerPayload ?? null;
    updates.error_code = null;
    updates.error_message = null;
  }

  if (input.status === "failed") {
    updates.completed_at = new Date().toISOString();
    updates.error_code = input.error?.code ?? "UNKNOWN";
    updates.error_message =
      input.error?.message ?? "Pronunciation analysis failed";
  }

  const { data, error } = await supabase
    .from("pronunciation_analyses")
    .update(updates)
    .eq("id", input.analysisId)
    .select(
      "id, provider, provider_locale, status, coaching_json, error_code, error_message, requested_at, completed_at",
    )
    .single();

  if (error) throw error;
  return toJob(data as AnalysisRow);
}

export async function getPronunciationAnalysisForUser(
  analysisId: string,
  userId: string,
): Promise<PronunciationAnalysisJob | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pronunciation_analyses")
    .select(
      "id, provider, provider_locale, status, coaching_json, error_code, error_message, requested_at, completed_at",
    )
    .eq("id", analysisId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;
  return toJob(data as AnalysisRow);
}
