// @MX:NOTE: [AUTO] AI API client for web endpoint communication and Supabase recording uploads.
// Handles tip generation, sentence analysis, recording upload, and pronunciation scoring.
// @MX:SPEC: SPEC-MOBILE-006

import { supabase } from "./supabase";
import type {
  PronunciationAnalysisJob,
  PronunciationFeedback,
} from "@inputenglish/shared";

const WEB_API_URL = process.env.EXPO_PUBLIC_WEB_API_URL ?? "";
const REQUEST_TIMEOUT_MS = 30_000;

// ---- Typed error ----

export class AiApiError extends Error {
  constructor(
    message: string,
    public readonly code: "TIMEOUT" | "NETWORK" | "API" | "UPLOAD" | "CONFIG",
    public readonly status?: number,
  ) {
    super(message);
    this.name = "AiApiError";
  }
}

// ---- Request / Response interfaces ----

export interface AiTipRequest {
  sentenceId: string;
  videoId: string;
  tags: string[]; // ['연음', '문법', '발음', '속도']
  sentenceText: string;
}

export interface AiTipResponse {
  tip: string;
  tags: string[];
}

export interface AnalyzeRequest {
  sentenceText: string;
  feedbackType: string;
  videoId: string;
}

export interface AnalyzeResponse {
  analysis: string;
  tips: string[];
  focusPoint: string;
}

export interface PronunciationResult {
  score: number; // 0-100
  feedback: string;
}

export interface RequestPronunciationAnalysisInput {
  recordingUrl: string;
  referenceText: string;
  sentenceId: string;
  videoId: string;
  sessionId?: string | null;
  source: "daily-input" | "study";
  providerLocale?: string;
}

// ---- Helpers ----

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getWebApiUrlOrThrow(): string {
  const trimmed = WEB_API_URL.trim();
  if (!trimmed) {
    throw new AiApiError("EXPO_PUBLIC_WEB_API_URL is not configured", "CONFIG");
  }
  return trimmed;
}

export function getReadableAiApiErrorMessage(error: unknown): string {
  if (error instanceof AiApiError) {
    if (error.code === "CONFIG") {
      return "앱 설정이 아직 완전히 배포되지 않았어요. 잠시 후 다시 시도해주세요.";
    }

    if (error.code === "TIMEOUT") {
      return "분석 응답이 늦어지고 있어요. 네트워크 상태를 확인한 뒤 다시 시도해주세요.";
    }

    if (error.code === "UPLOAD") {
      return "녹음 파일 업로드에 실패했어요. 다시 녹음한 뒤 한 번 더 시도해주세요.";
    }

    if (error.status === 404) {
      return "발음 분석 서버가 아직 최신 버전으로 배포되지 않았어요. 조금 뒤 다시 시도해주세요.";
    }

    if (error.code === "NETWORK") {
      return "발음 분석 서버에 연결하지 못했어요. 인터넷 연결이나 서버 배포 상태를 확인해주세요.";
    }

    return error.message;
  }

  return "분석 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.";
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timerId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    return response;
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new AiApiError("Request timed out after 30s", "TIMEOUT");
    }
    throw new AiApiError(
      err instanceof Error ? err.message : "Network error",
      "NETWORK",
    );
  } finally {
    clearTimeout(timerId);
  }
}

async function parseJsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const body = (await response.json()) as {
        message?: string;
        error?: string;
      };
      message = body.message ?? body.error ?? message;
    } catch {
      // ignore JSON parse error
    }
    throw new AiApiError(message, "API", response.status);
  }
  return response.json() as Promise<T>;
}

// ---- R-AI-001: POST /api/ai-tip ----

export async function fetchAiTip(req: AiTipRequest): Promise<AiTipResponse> {
  const authHeader = await getAuthHeader();
  const url = `${getWebApiUrlOrThrow()}/api/ai-tip`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    body: JSON.stringify({
      sentence: req.sentenceText,
      tags: req.tags,
    }),
  });
  const data = await parseJsonOrThrow<{ tip: string }>(response);
  return { tip: data.tip, tags: req.tags };
}

// ---- R-AI-002: POST /api/analyze ----

export async function analyzeSentence(
  req: AnalyzeRequest,
): Promise<AnalyzeResponse> {
  const authHeader = await getAuthHeader();
  const url = `${getWebApiUrlOrThrow()}/api/analyze`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    body: JSON.stringify({
      sentence: req.sentenceText,
      feedbackTypes: [req.feedbackType],
      videoId: req.videoId,
    }),
  });
  return parseJsonOrThrow<AnalyzeResponse>(response);
}

// ---- R-AI-006: Upload recording to Supabase Storage ----

export async function uploadRecording(
  uri: string,
  userId: string,
  videoId: string,
  sentenceId: string,
  _duration: number,
): Promise<string> {
  // Fetch the local file as a blob
  let blob: Blob;
  try {
    const fileResponse = await fetch(uri);
    blob = await fileResponse.blob();
  } catch (err) {
    throw new AiApiError(
      err instanceof Error ? err.message : "Failed to read recording file",
      "UPLOAD",
    );
  }

  const timestamp = Date.now();
  const storagePath = `${userId}/${videoId}/${sentenceId}/${timestamp}.m4a`;

  const { data, error } = await supabase.storage
    .from("recordings")
    .upload(storagePath, blob, {
      contentType: "audio/m4a",
      upsert: false,
    });

  if (error) {
    throw new AiApiError(error.message, "UPLOAD");
  }

  const { data: urlData } = supabase.storage
    .from("recordings")
    .getPublicUrl(data.path);

  return urlData.publicUrl;
}

// ---- R-AI-007: Pronunciation score ----

export async function getPronunciationScore(
  recordingUrl: string,
  sentenceText: string,
): Promise<PronunciationResult> {
  const authHeader = await getAuthHeader();
  const url = `${getWebApiUrlOrThrow()}/api/pronunciation`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    body: JSON.stringify({ recordingUrl, sentenceText }),
  });
  return parseJsonOrThrow<PronunciationResult>(response);
}

export async function requestPronunciationAnalysis(
  input: RequestPronunciationAnalysisInput,
): Promise<PronunciationAnalysisJob> {
  const authHeader = await getAuthHeader();
  const url = `${getWebApiUrlOrThrow()}/api/pronunciation/analyses`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    body: JSON.stringify(input),
  });
  return parseJsonOrThrow<PronunciationAnalysisJob>(response);
}

export async function fetchPronunciationAnalysis(
  analysisId: string,
): Promise<PronunciationAnalysisJob> {
  const authHeader = await getAuthHeader();
  const url = `${getWebApiUrlOrThrow()}/api/pronunciation/analyses/${analysisId}`;
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      ...authHeader,
    },
  });
  return parseJsonOrThrow<PronunciationAnalysisJob>(response);
}

export async function waitForPronunciationAnalysisCompletion(
  analysisId: string,
  options?: {
    intervalMs?: number;
    maxAttempts?: number;
  },
): Promise<PronunciationAnalysisJob> {
  const intervalMs = options?.intervalMs ?? 1200;
  const maxAttempts = options?.maxAttempts ?? 8;

  let latestJob = await fetchPronunciationAnalysis(analysisId);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (latestJob.status === "complete" || latestJob.status === "failed") {
      return latestJob;
    }

    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    latestJob = await fetchPronunciationAnalysis(analysisId);
  }

  return latestJob;
}

export function isPronunciationFeedbackComplete(
  feedback: PronunciationFeedback | null | undefined,
): feedback is PronunciationFeedback & { status: "complete" } {
  return Boolean(feedback && feedback.status === "complete");
}
