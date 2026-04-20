// @MX:NOTE: [AUTO] AI API client for web endpoint communication and Supabase recording uploads.
// Handles tip generation, sentence analysis, recording upload, and pronunciation scoring.
// @MX:SPEC: SPEC-MOBILE-006

import { supabase } from "./supabase";
import {
  inferAudioUploadMeta,
  normalizeAudioBlobForUpload,
} from "./audio-upload";
import { captureException } from "./sentry";
import * as Device from "expo-device";
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

function buildSimulatorPronunciationJob(
  input: RequestPronunciationAnalysisInput,
): PronunciationAnalysisJob {
  const now = new Date().toISOString();
  return {
    analysis_id: `simulator-${input.sentenceId}-${Date.now()}`,
    status: "complete",
    provider: "azure",
    provider_locale: input.providerLocale ?? "en-US",
    requested_at: now,
    completed_at: now,
    error: null,
    result: {
      status: "complete",
      provider: "azure",
      reference_text: input.referenceText,
      recognized_text: input.referenceText,
      overall_score: 84,
      accuracy_score: 86,
      fluency_score: 80,
      completeness_score: 92,
      prosody_score: 78,
      summary:
        "시뮬레이터 샘플 기준으로는 핵심 문장은 잘 전달됐지만, 강세와 문장 끝 처리에는 더 여지가 있어요.",
      pacing_note:
        "문장 중간은 안정적이지만 끝으로 갈수록 속도가 조금 빨라져요.",
      chunking_note: "의미 단위마다 짧게 끊어 읽으면 더 또렷하게 들려요.",
      stress_note: "핵심 정보가 들어 있는 단어에 강세를 조금 더 실어보세요.",
      ending_tone_note:
        "문장 끝을 급하게 내리지 말고 마지막 단어를 조금 더 길게 유지해보세요.",
      clarity_note:
        "자음이 겹치는 구간을 조금 더 분리해서 발음하면 명료도가 올라가요.",
      next_focus:
        "강세를 줄 단어를 먼저 정한 뒤, 마지막 단어의 길이를 살려 다시 말해보세요.",
      confidence: 0.88,
      word_issues: [],
    },
  };
}

// ---- Helpers ----

function createDebugRequestId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

type AuthHeaderDebugInfo = {
  requestId: string;
  sessionUserId: string | null;
  expiresAt: number | null;
  hasAccessToken: boolean;
  accessTokenLength: number;
};

async function getAuthHeader(requestId: string): Promise<{
  headers: Record<string, string>;
  debug: AuthHeaderDebugInfo;
}> {
  const { data, error } = await supabase.auth.getSession();
  const session = data.session;
  const token = session?.access_token;

  const debug: AuthHeaderDebugInfo = {
    requestId,
    sessionUserId: session?.user?.id ?? null,
    expiresAt: session?.expires_at ?? null,
    hasAccessToken: Boolean(token),
    accessTokenLength: token?.length ?? 0,
  };

  if (error) {
    console.warn("[AiApi] Failed to read auth session before API request:", {
      requestId,
      message: error.message,
    });
  }

  return {
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      "X-Request-Id": requestId,
    },
    debug,
  };
}

function getWebApiUrlOrThrow(): string {
  const trimmed = WEB_API_URL.trim();
  if (!trimmed) {
    throw new AiApiError("EXPO_PUBLIC_WEB_API_URL is not configured", "CONFIG");
  }
  return trimmed;
}

function getReadableRecordingUploadErrorMessage(message: string): string {
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

  return "녹음 파일 업로드에 실패했어요. 다시 녹음한 뒤 한 번 더 시도해주세요.";
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
      return getReadableRecordingUploadErrorMessage(error.message);
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

export function getReadablePronunciationJobError(
  error:
    | {
        code?: string | null;
        message?: string | null;
      }
    | null
    | undefined,
): string {
  switch (error?.code) {
    case "MISSING_CONFIG":
      return "발음 분석 기능이 아직 프로덕션에 완전히 설정되지 않았어요. 서버 설정을 마친 뒤 다시 시도해주세요.";
    case "MISSING_TRANSCODER":
      return "발음 분석 서버의 오디오 변환기가 아직 준비되지 않았어요. 잠시 후 다시 시도해주세요.";
    case "DOWNLOAD_FAILED":
      return "업로드된 녹음 파일을 불러오지 못했어요. 다시 녹음한 뒤 한 번 더 시도해주세요.";
    case "NO_MATCH":
      return "음성이 충분히 인식되지 않았어요. 더 또렷하게 다시 말해보세요.";
    case "CANCELED":
    case "RECOGNITION_FAILED":
      return "발음 분석 엔진이 이번 녹음을 처리하지 못했어요. 잠시 후 다시 시도해주세요.";
    case "TRANSCODE_FAILED":
      return "녹음 파일 형식을 변환하지 못했어요. 다시 녹음한 뒤 한 번 더 시도해주세요.";
    default:
      return (
        error?.message ??
        "발음 분석을 완료하지 못했어요. 잠시 후 다시 시도해주세요."
      );
  }
}

export function getReadableRecordingUploadError(error: unknown): string {
  if (error instanceof AiApiError) {
    return getReadableAiApiErrorMessage(error);
  }

  if (error instanceof Error) {
    return getReadableRecordingUploadErrorMessage(error.message);
  }

  return "녹음 파일 업로드에 실패했어요. 다시 녹음한 뒤 한 번 더 시도해주세요.";
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

async function readBlobAsDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => {
      reject(new Error("Failed to convert recording file to data URL"));
    };
    reader.onloadend = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Failed to convert recording file to data URL"));
    };
    reader.readAsDataURL(blob);
  });
}

// ---- R-AI-001: POST /api/ai-tip ----

export async function fetchAiTip(req: AiTipRequest): Promise<AiTipResponse> {
  const { headers: authHeader } = await getAuthHeader(
    createDebugRequestId("ai-tip"),
  );
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
  const { headers: authHeader } = await getAuthHeader(
    createDebugRequestId("analyze"),
  );
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
  // @MX:NOTE: Diagnostic logs added to narrow down TestFlight upload failures.
  //           Known risk: fetch('file://') on Hermes release builds may return
  //           empty Blob. Keep until root cause is confirmed.
  const uriPreview = uri.length > 80 ? `${uri.slice(0, 80)}...` : uri;
  let blob: Blob;
  try {
    const fileResponse = await fetch(uri);
    blob = await fileResponse.blob();
  } catch (err) {
    console.error("[uploadRecording] fetch(uri) failed", {
      uri: uriPreview,
      err,
    });
    throw new AiApiError(
      err instanceof Error
        ? `fetch(file) failed: ${err.message}`
        : "Failed to read recording file",
      "UPLOAD",
    );
  }

  console.warn("[uploadRecording] blob read", {
    uri: uriPreview,
    size: blob.size,
    type: blob.type || "(empty)",
  });

  if (blob.size === 0) {
    throw new AiApiError(
      `Recording blob is empty (uri=${uriPreview}, type=${blob.type || "unknown"})`,
      "UPLOAD",
    );
  }

  if (!Device.isDevice) {
    try {
      return await readBlobAsDataUrl(blob);
    } catch (error) {
      throw new AiApiError(
        error instanceof Error ? error.message : "Failed to encode recording",
        "UPLOAD",
      );
    }
  }

  const timestamp = Date.now();
  const uploadMeta = inferAudioUploadMeta(uri, blob.type);
  const storagePath = `${userId}/${videoId}/${sentenceId}/${timestamp}.${uploadMeta.extension}`;
  const uploadBlob = normalizeAudioBlobForUpload(blob, uploadMeta);

  console.warn("[uploadRecording] upload start", {
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
    console.error("[uploadRecording] supabase upload failed", {
      storagePath,
      contentType: uploadMeta.contentType,
      blobSize: blob.size,
      error,
    });
    captureException(error, {
      location: "uploadRecording",
      storagePath,
      contentType: uploadMeta.contentType,
      blobSize: blob.size,
      blobType: blob.type,
      uri: uriPreview,
    });
    throw new AiApiError(
      `${error.message} (path=${storagePath}, size=${blob.size}, type=${uploadMeta.contentType})`,
      "UPLOAD",
    );
  }

  console.warn("[uploadRecording] upload success", { path: data.path });

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
  if (!Device.isDevice) {
    return {
      score: 84,
      feedback:
        "시뮬레이터에서는 샘플 발음 분석 결과를 보여주고 있어요. 실제 기기에서는 업로드한 음성을 기준으로 점수를 계산해요.",
    };
  }

  const requestId = createDebugRequestId("pron-score");
  const { headers: authHeader, debug } = await getAuthHeader(requestId);
  console.log("[AiApi] Sending pronunciation score request:", {
    ...debug,
    webApiUrl: getWebApiUrlOrThrow(),
  });
  const url = `${getWebApiUrlOrThrow()}/api/pronunciation`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    body: JSON.stringify({ recordingUrl, sentenceText }),
  });
  if (!response.ok) {
    const responseText = await response
      .clone()
      .text()
      .catch(() => null);
    console.warn("[AiApi] Pronunciation score request rejected:", {
      ...debug,
      status: response.status,
      responseText,
    });
  }
  return parseJsonOrThrow<PronunciationResult>(response);
}

export async function requestPronunciationAnalysis(
  input: RequestPronunciationAnalysisInput,
): Promise<PronunciationAnalysisJob> {
  if (!Device.isDevice) {
    return buildSimulatorPronunciationJob(input);
  }

  const requestId = createDebugRequestId("pron-analysis");
  const { headers: authHeader, debug } = await getAuthHeader(requestId);
  console.log("[AiApi] Sending pronunciation analysis request:", {
    ...debug,
    source: input.source,
    sentenceId: input.sentenceId,
    sessionId: input.sessionId ?? null,
    videoId: input.videoId,
    webApiUrl: getWebApiUrlOrThrow(),
  });

  const url = `${getWebApiUrlOrThrow()}/api/pronunciation/analyses`;
  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
    },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    const responseText = await response
      .clone()
      .text()
      .catch(() => null);
    console.warn("[AiApi] Pronunciation analysis request rejected:", {
      ...debug,
      status: response.status,
      responseText,
    });
  }
  return parseJsonOrThrow<PronunciationAnalysisJob>(response);
}

export async function fetchPronunciationAnalysis(
  analysisId: string,
): Promise<PronunciationAnalysisJob> {
  if (!Device.isDevice && analysisId.startsWith("simulator-")) {
    const now = new Date().toISOString();
    return {
      analysis_id: analysisId,
      status: "complete",
      provider: "azure",
      provider_locale: "en-US",
      requested_at: now,
      completed_at: now,
      error: null,
      result: {
        status: "complete",
        provider: "azure",
        reference_text: "",
        recognized_text: "",
        overall_score: 84,
        accuracy_score: 86,
        fluency_score: 80,
        completeness_score: 92,
        prosody_score: 78,
        summary: "시뮬레이터 샘플 발음 분석 결과예요.",
        pacing_note: "말의 속도는 전반적으로 안정적이에요.",
        chunking_note: "의미 단위마다 나누어 읽는 감각을 유지해보세요.",
        stress_note: "핵심 단어에 조금 더 강세를 실어보세요.",
        ending_tone_note: "문장 끝을 또렷하게 마무리해보세요.",
        clarity_note: "자음이 뭉치지 않도록 분리해서 발음해보세요.",
        next_focus: "강세와 문장 끝 처리를 우선 연습해보세요.",
        confidence: 0.88,
        word_issues: [],
      },
    };
  }

  const requestId = createDebugRequestId("pron-poll");
  const { headers: authHeader, debug } = await getAuthHeader(requestId);
  const url = `${getWebApiUrlOrThrow()}/api/pronunciation/analyses/${analysisId}`;
  const response = await fetchWithTimeout(url, {
    method: "GET",
    headers: {
      ...authHeader,
    },
  });
  if (!response.ok) {
    const responseText = await response
      .clone()
      .text()
      .catch(() => null);
    console.warn("[AiApi] Pronunciation analysis polling rejected:", {
      ...debug,
      analysisId,
      status: response.status,
      responseText,
    });
  }
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
