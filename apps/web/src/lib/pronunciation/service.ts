import type { PronunciationAnalysisJob } from "@inputenglish/shared";
import {
  downloadRecordingToTempFile,
  ensureWavInput,
  PronunciationAudioError,
} from "./audio";
import {
  AzurePronunciationError,
  runAzurePronunciationAssessment,
} from "./azure";
import { normalizeAzurePronunciationResult } from "./normalize";
import {
  createPronunciationAnalysis,
  updatePronunciationAnalysisStatus,
} from "./repository";

function mapProviderError(error: unknown): { code: string; message: string } {
  if (error instanceof PronunciationAudioError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof AzurePronunciationError) {
    return { code: error.code, message: error.message };
  }

  if (error instanceof Error) {
    return { code: "UNKNOWN", message: error.message };
  }

  return { code: "UNKNOWN", message: "Pronunciation analysis failed" };
}

export async function requestPronunciationAnalysis(input: {
  userId: string;
  sessionId?: string | null;
  videoId: string;
  sentenceId: string;
  source: "daily-input" | "study";
  recordingUrl: string;
  referenceText: string;
  providerLocale?: string;
}): Promise<PronunciationAnalysisJob> {
  const providerLocale = input.providerLocale ?? "en-US";
  return createPronunciationAnalysis({
    userId: input.userId,
    sessionId: input.sessionId,
    videoId: input.videoId,
    sentenceId: input.sentenceId,
    source: input.source,
    providerLocale,
    recordingUrl: input.recordingUrl,
    referenceText: input.referenceText,
  });
}

export async function processPronunciationAnalysis(input: {
  analysisId: string;
  recordingUrl: string;
  referenceText: string;
  providerLocale?: string;
}): Promise<PronunciationAnalysisJob> {
  const providerLocale = input.providerLocale ?? "en-US";

  await updatePronunciationAnalysisStatus({
    analysisId: input.analysisId,
    status: "processing",
  });

  const tempRecording = await downloadRecordingToTempFile(input.recordingUrl);

  try {
    const wavPath = await ensureWavInput(tempRecording.inputPath);
    const providerResult = await runAzurePronunciationAssessment({
      wavFilePath: wavPath,
      referenceText: input.referenceText,
      locale: providerLocale,
    });

    const normalized = normalizeAzurePronunciationResult({
      payload: providerResult.jsonResult,
      referenceText: input.referenceText,
      providerLocale,
    });

    return await updatePronunciationAnalysisStatus({
      analysisId: input.analysisId,
      status: "complete",
      result: normalized,
      recognizedText: providerResult.recognizedText,
      providerPayload: providerResult.jsonResult,
    });
  } catch (error) {
    const mapped = mapProviderError(error);
    // @MX:NOTE: stderr from ffmpeg / Azure SDK is otherwise only visible
    //           in the DB record for this analysis. Log it so Vercel
    //           function logs surface the root cause of transcode or
    //           recognition failures.
    console.error("[pronunciation.service] analysis failed", {
      analysisId: input.analysisId,
      recordingUrl: input.recordingUrl,
      code: mapped.code,
      message: mapped.message,
      raw:
        error instanceof Error
          ? { name: error.name, stack: error.stack }
          : error,
    });
    return updatePronunciationAnalysisStatus({
      analysisId: input.analysisId,
      status: "failed",
      error: mapped,
    });
  } finally {
    await tempRecording.cleanup();
  }
}
