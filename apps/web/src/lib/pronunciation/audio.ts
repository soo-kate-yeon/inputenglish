import { promises as fs } from "node:fs";
import { constants as fsConstants } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { execFile } from "node:child_process";
import type { ExecFileException } from "node:child_process";
import ffmpegPath from "ffmpeg-static";

export class PronunciationAudioError extends Error {
  constructor(
    message: string,
    public readonly code:
      | "DOWNLOAD_FAILED"
      | "TRANSCODE_FAILED"
      | "UNSUPPORTED_AUDIO"
      | "MISSING_TRANSCODER",
  ) {
    super(message);
    this.name = "PronunciationAudioError";
  }
}

function inferDownloadedAudioExtension(
  recordingUrl: string,
  contentType: string,
): string {
  const normalizedContentType = contentType.toLowerCase();
  const normalizedUrl = recordingUrl.split("?")[0].toLowerCase();

  if (normalizedContentType.includes("wav") || normalizedUrl.endsWith(".wav")) {
    return ".wav";
  }

  if (
    normalizedContentType.includes("audio/x-caf") ||
    normalizedContentType.includes("audio/caf") ||
    normalizedUrl.endsWith(".caf")
  ) {
    return ".caf";
  }

  return ".m4a";
}

async function writeBufferToTempFile(
  buffer: Buffer,
  extension: string,
): Promise<string> {
  const tempDir = await fs.mkdtemp(
    path.join(os.tmpdir(), "inputenglish-pronunciation-"),
  );
  const filePath = path.join(tempDir, `${randomUUID()}${extension}`);
  await fs.writeFile(filePath, buffer);
  return filePath;
}

export async function downloadRecordingToTempFile(
  recordingUrl: string,
): Promise<{ inputPath: string; cleanup: () => Promise<void> }> {
  const response = await fetch(recordingUrl);
  if (!response.ok) {
    throw new PronunciationAudioError(
      `Failed to download recording (${response.status})`,
      "DOWNLOAD_FAILED",
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
  const extension = inferDownloadedAudioExtension(recordingUrl, contentType);
  const inputPath = await writeBufferToTempFile(
    Buffer.from(arrayBuffer),
    extension,
  );

  return {
    inputPath,
    cleanup: async () => {
      await fs.rm(path.dirname(inputPath), { recursive: true, force: true });
    },
  };
}

// @MX:ANCHOR: Always transcode the incoming recording to canonical
//             16kHz / mono / PCM_S16LE WAV before handing to Azure.
// @MX:REASON: iOS expo-av with outputFormat=lpcm and extension=.wav does
//             NOT emit a RIFF-compliant header; Azure SDK's
//             fromWavFileInput then throws "offset is outside the bounds
//             of the dataview" while parsing. Transcoding through ffmpeg
//             always produces a proper RIFF WAV and normalizes sample
//             rate/channels/bit depth to exactly what the Azure
//             pronunciation assessment expects.
export async function ensureWavInput(inputPath: string): Promise<string> {
  if (!ffmpegPath) {
    throw new PronunciationAudioError(
      "FFmpeg binary is not available for audio transcoding",
      "MISSING_TRANSCODER",
    );
  }
  const transcoderPath = ffmpegPath;

  try {
    await fs.access(transcoderPath, fsConstants.F_OK | fsConstants.X_OK);
  } catch {
    throw new PronunciationAudioError(
      `FFmpeg binary is missing or not executable at ${transcoderPath}`,
      "MISSING_TRANSCODER",
    );
  }

  // Distinct output path to avoid overwriting the input (which may itself
  // be a .wav that ffmpeg is still reading).
  const dir = path.dirname(inputPath);
  const base = path.basename(inputPath, path.extname(inputPath));
  const wavPath = path.join(dir, `${base}.normalized.wav`);

  await new Promise<void>((resolve, reject) => {
    execFile(
      transcoderPath,
      [
        "-y",
        "-i",
        inputPath,
        "-ac",
        "1",
        "-ar",
        "16000",
        "-acodec",
        "pcm_s16le",
        wavPath,
      ],
      (error: ExecFileException | null, _stdout: string, stderr: string) => {
        if (!error) {
          resolve();
          return;
        }

        reject(
          new PronunciationAudioError(
            stderr?.trim() || error.message || "Failed to transcode recording",
            "TRANSCODE_FAILED",
          ),
        );
      },
    );
  });

  return wavPath;
}
