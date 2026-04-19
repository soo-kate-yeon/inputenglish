import { promises as fs } from "node:fs";
import * as SpeechSDK from "microsoft-cognitiveservices-speech-sdk";

export interface AzurePronunciationAssessmentResponse {
  recognizedText: string;
  providerLocale: string;
  sdkResultReason: string;
  jsonResult: Record<string, unknown>;
}

export class AzurePronunciationError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "MISSING_CONFIG"
      | "RECOGNITION_FAILED"
      | "NO_MATCH"
      | "CANCELED",
  ) {
    super(message);
    this.name = "AzurePronunciationError";
  }
}

export async function runAzurePronunciationAssessment(params: {
  wavFilePath: string;
  referenceText: string;
  locale?: string;
}): Promise<AzurePronunciationAssessmentResponse> {
  const speechKey = process.env.AZURE_SPEECH_KEY;
  const speechRegion = process.env.AZURE_SPEECH_REGION;

  if (!speechKey || !speechRegion) {
    throw new AzurePronunciationError(
      "Azure Speech credentials are not configured",
      "MISSING_CONFIG",
    );
  }

  const locale = params.locale ?? "en-US";
  const speechConfig = SpeechSDK.SpeechConfig.fromSubscription(
    speechKey,
    speechRegion,
  );
  speechConfig.speechRecognitionLanguage = locale;
  speechConfig.outputFormat = SpeechSDK.OutputFormat.Detailed;
  const wavBuffer = await fs.readFile(params.wavFilePath);

  const audioConfig = SpeechSDK.AudioConfig.fromWavFileInput(wavBuffer);
  const recognizer = new SpeechSDK.SpeechRecognizer(speechConfig, audioConfig);

  const pronunciationConfig = new SpeechSDK.PronunciationAssessmentConfig(
    params.referenceText,
    SpeechSDK.PronunciationAssessmentGradingSystem.HundredMark,
    SpeechSDK.PronunciationAssessmentGranularity.Phoneme,
    true,
  );
  pronunciationConfig.enableProsodyAssessment = true;
  pronunciationConfig.applyTo(recognizer);

  try {
    const result = await new Promise<SpeechSDK.SpeechRecognitionResult>(
      (resolve, reject) => {
        recognizer.recognizeOnceAsync(
          (recognitionResult) => resolve(recognitionResult),
          (error) =>
            reject(
              new AzurePronunciationError(
                typeof error === "string" ? error : "Recognition failed",
                "RECOGNITION_FAILED",
              ),
            ),
        );
      },
    );

    if (result.reason === SpeechSDK.ResultReason.NoMatch) {
      throw new AzurePronunciationError(
        "No speech match was detected in the recording",
        "NO_MATCH",
      );
    }

    if (result.reason === SpeechSDK.ResultReason.Canceled) {
      const cancellation = SpeechSDK.CancellationDetails.fromResult(result);
      throw new AzurePronunciationError(
        cancellation.errorDetails || "Pronunciation recognition was canceled",
        "CANCELED",
      );
    }

    const jsonResult =
      result.properties.getProperty(
        SpeechSDK.PropertyId.SpeechServiceResponse_JsonResult,
      ) ?? "{}";

    return {
      recognizedText: result.text,
      providerLocale: locale,
      sdkResultReason: String(result.reason),
      jsonResult: JSON.parse(jsonResult) as Record<string, unknown>,
    };
  } finally {
    recognizer.close();
    audioConfig.close();
  }
}
